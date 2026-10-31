// Camera coach: live video + ghost pose overlay + score + photographer ke liye hints.
// Flow: camera stream -> har frame pe MediaPipe body points dhoondta hai -> target pose se compare
//       -> canvas pe ghost (target) + tumhara skeleton draw -> hints update.
import { useEffect, useRef, useState } from 'react'
import { getVideoLandmarker } from '../lib/poseDetector'
import { PRESET_POSES, FRAMING_TIPS, BONES, skeletonFromAngles, fitSkeleton, namedPoints, comparePose, framingHints } from '../lib/poses'
import { referencesDb, loadTaste, photosDb, newId, saveLesson } from '../lib/db'
import { analyzeScene } from '../lib/ai'
import { speak } from '../lib/voice'
import { Spinner, ErrorText, Sheet, List, Lesson } from '../components'

// Score limits: sahi pose ~95+ aata hai, milta-julta pose ~75-85. Isliye "Perfect" 90 se.
const GOOD = 90
const OK = 70

export default function Camera({ goTo }) {
  const videoRef = useRef()
  const canvasRef = useRef()
  const boxRef = useRef()
  const poseRef = useRef(null) // loop ke andar latest pose padhne ke liye (state loop mein stale ho jaata)
  const [facing, setFacing] = useState('environment') // back camera = dost click kar raha hai
  const [poses, setPoses] = useState(PRESET_POSES)
  const [pose, setPose] = useState(PRESET_POSES[0])
  const [grid, setGrid] = useState(true)
  const [live, setLive] = useState({ score: 0, hint: null, frame: [], seen: false })
  const [status, setStatus] = useState('Camera khul raha hai…')
  const [tilt, setTilt] = useState(0)
  const [scene, setScene] = useState(null)
  const [sceneLoading, setSceneLoading] = useState(false)
  const [error, setError] = useState(null)
  const [lastShot, setLastShot] = useState(null)
  const [flash, setFlash] = useState(false)
  const [taste, setTaste] = useState(null)
  const [voiceOn, setVoiceOn] = useState(false) // 🔊 hints bol ke batao
  const [autoOn, setAutoOn] = useState(false) // 🤖 pose match hote hi khud photo
  const [countdown, setCountdown] = useState(null)
  const coachRef = useRef({ since: 0, busy: false, lastText: '', lastAt: 0 })

  poseRef.current = pose
  const mirror = facing === 'user'

  // Pasand ki photos se bane custom poses bhi list mein jodo
  useEffect(() => {
    referencesDb.load().then((refs) => {
      const custom = refs.filter((r) => r.pose).map((r, i) => ({
        id: r.id, name: `Meri pasand #${refs.length - i}`, framing: r.pose.framing, angles: r.pose.angles,
        tip: 'Tumhari pasand ki photo wala pose. Thumbnail dekh ke copy karo.', thumb: r.image,
      }))
      setPoses([...custom, ...PRESET_POSES])
    })
    loadTaste().then(setTaste)
  }, [])

  // Voice coach + auto-capture: live score har ~250ms update hota hai, uspe react karo
  useEffect(() => {
    if (status || error) return
    const c = coachRef.current
    const now = Date.now()
    const good = live.seen && live.score >= GOOD

    if (voiceOn && !c.busy) {
      const text = !live.seen ? 'Pura body frame mein lao' : good ? 'Perfect, aise hi raho' : live.hint || live.frame[0]
      // Nayi baat ho toh 2.5 sec baad bolo, same baat ho toh 6 sec mein ek baar (warna kaan pak jaayenge)
      if (text && now - c.lastAt > 2500 && (text !== c.lastText || now - c.lastAt > 6000)) {
        speak(text); c.lastText = text; c.lastAt = now
      }
    }

    if (autoOn && good && !c.busy) {
      c.since ||= now
      if (now - c.since > 800) { // 0.8 sec tak pose hold kiya -> countdown
        c.busy = true
        runCountdown()
      }
    } else if (!c.busy) c.since = 0
  }, [live]) // eslint-disable-line react-hooks/exhaustive-deps

  async function runCountdown() {
    for (const n of [3, 2, 1]) {
      setCountdown(n)
      if (voiceOn || autoOn) speak(String(n))
      await new Promise((r) => setTimeout(r, 900))
    }
    setCountdown(null)
    await shoot()
    speak('Ho gaya')
    setTimeout(() => { coachRef.current.busy = false; coachRef.current.since = 0 }, 3000) // 3 sec ka break, phir agli
  }

  // Phone kitna tedha hai (level indicator)
  useEffect(() => {
    const onTilt = (e) => setTilt(Math.round(e.gamma || 0))
    window.addEventListener('deviceorientation', onTilt)
    return () => window.removeEventListener('deviceorientation', onTilt)
  }, [])

  // Camera start + detection loop
  useEffect(() => {
    let stream, raf, stopped = false, lastUi = 0
    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1920 } },
          audio: false,
        })
      } catch (e) {
        setStatus(null)
        setError('Camera nahi khula: ' + e.message + '. Browser ko camera permission do (aur site HTTPS pe honi chahiye).')
        return
      }
      if (stopped) return stream.getTracks().forEach((t) => t.stop())
      const video = videoRef.current
      video.srcObject = stream
      await video.play()
      setStatus('Pose AI load ho raha hai…')
      const landmarker = await getVideoLandmarker()
      if (stopped) return
      setStatus(null)

      const loop = () => {
        if (stopped) return
        const canvas = canvasRef.current
        const box = boxRef.current
        if (video.readyState >= 2 && canvas && box) {
          const W = box.clientWidth, H = box.clientHeight
          if (canvas.width !== W) { canvas.width = W; canvas.height = H }
          const res = landmarker.detectForVideo(video, performance.now())
          const lm = res.landmarks?.[0]
          const pts = lm ? namedPoints(toDisplay(lm, video, W, H), W, H, mirror) : null
          const p = poseRef.current
          const result = pts ? comparePose(pts, p.angles, p.framing) : null
          draw(canvas.getContext('2d'), W, H, p, pts, result?.score ?? 0)

          // UI (React state) ko 4 baar/sec update karo, har frame pe nahi: warna phone garam + slow
          const now = performance.now()
          if (now - lastUi > 250) {
            lastUi = now
            setLive(pts ? { ...result, frame: framingHints(pts, p.framing, W, H), seen: true } : { score: 0, hint: null, frame: [], seen: false })
          }
        }
        raf = requestAnimationFrame(loop)
      }
      loop()
    }
    start()
    return () => {
      stopped = true
      cancelAnimationFrame(raf)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [facing])

  function captureVisible(maxSide = 2400) {
    // Screen pe jo dikh raha hai (crop) wahi photo banti hai
    const video = videoRef.current, box = boxRef.current
    const W = box.clientWidth, H = box.clientHeight
    const vw = video.videoWidth, vh = video.videoHeight
    const s = Math.max(W / vw, H / vh)
    const sw = W / s, sh = H / s, sx = (vw - sw) / 2, sy = (vh - sh) / 2
    const k = Math.min(1, maxSide / Math.max(sw, sh))
    const c = document.createElement('canvas')
    c.width = Math.round(sw * k); c.height = Math.round(sh * k)
    const ctx = c.getContext('2d')
    if (mirror) { ctx.translate(c.width, 0); ctx.scale(-1, 1) }
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, c.width, c.height)
    return c.toDataURL('image/jpeg', 0.92)
  }

  async function shoot() {
    const image = captureVisible()
    setFlash(true); setTimeout(() => setFlash(false), 150)
    const entry = { id: newId(), image, pose: pose.name, score: live.score, createdAt: Date.now() }
    await photosDb.add(entry)
    setLastShot(entry)
  }

  async function analyze() {
    setSceneLoading(true); setError(null)
    try {
      const r = await analyzeScene({ frame: captureVisible(1024), taste, poses })
      setScene(r)
      saveLesson(r.lesson, 'scene')
      const best = poses.find((p) => p.id === r.recommended_pose_ids?.[0])
      if (best) setPose(best)
    } catch (e) {
      setError(e.message)
    }
    setSceneLoading(false)
  }

  const scoreClass = live.score >= GOOD ? 'good' : live.score >= OK ? 'ok' : 'bad'
  const cameraReady = !status && !error

  return (
    <div className="cam">
      <div className="cam-view" ref={boxRef}>
        <video ref={videoRef} playsInline muted className={mirror ? 'mirror' : ''} />
        <canvas ref={canvasRef} />
        {grid && <div className="thirds" />}
        {flash && <div className="flash" />}

        <div className="cam-top">
          {status && <Spinner text={status} />}
          <ErrorText error={error} />
          {cameraReady && (
            <div className="hud">
              {live.seen ? (
                <>
                  <span className={'score ' + scoreClass}>{live.score}%</span>
                  <span className="hud-text">{live.score >= GOOD ? '🔥 Perfect! Ab click karo' : live.hint || 'Ghost outline ke saath match karo'}</span>
                </>
              ) : (
                <span className="hud-text">Pura banda frame mein lao, ghost outline dikh raha hai</span>
              )}
            </div>
          )}
          {live.frame.map((h) => <div key={h} className="hud hud-small">{h}</div>)}
          {Math.abs(tilt) > 4 && Math.abs(tilt) < 60 && <div className="hud hud-small">📐 Phone tedha hai ({tilt}°): seedha pakdo</div>}
        </div>
        {countdown && <div className="countdown">{countdown}</div>}
      </div>

      <div className="cam-panel">
        <div className="pose-strip">
          {poses.map((p) => (
            <button key={p.id} className={'pose-chip' + (p.id === pose.id ? ' active' : '')} onClick={() => setPose(p)}>
              {p.thumb && <img src={p.thumb} alt="" />}
              <span>{p.name}</span>
            </button>
          ))}
        </div>
        <p className="small pose-tip">🧍 {pose.tip}<br />{FRAMING_TIPS[pose.framing]}</p>
        <div className="chips">
          <button className={'chip' + (voiceOn ? ' active' : '')} onClick={() => { setVoiceOn((v) => !v); speak(voiceOn ? '' : 'Voice coach on') }}>🔊 Voice coach</button>
          <button className={'chip' + (autoOn ? ' active' : '')} onClick={() => setAutoOn((v) => !v)}>🤖 Auto photo (pose match pe)</button>
        </div>

        <div className="cam-controls">
          <button className="round" onClick={() => setFacing((f) => (f === 'user' ? 'environment' : 'user'))} title="Camera badlo">🔄</button>
          <button className="round" onClick={() => setGrid((g) => !g)} title="Grid">#</button>
          <button className="shutter" onClick={shoot} disabled={!cameraReady} aria-label="Photo lo" />
          <button className="round" onClick={analyze} disabled={sceneLoading || !cameraReady} title="Scene analyze">{sceneLoading ? '…' : '🧠'}</button>
          <button className="round thumb" onClick={() => goTo('photos')} title="Photos">
            {lastShot ? <img src={lastShot.image} alt="" /> : '🖼️'}
          </button>
        </div>
      </div>

      {scene && (
        <Sheet onClose={() => setScene(null)}>
          <h2>Scene report <span className="badge">{scene.score_now}/10</span></h2>
          <p><b>💡 Light:</b> {scene.lighting}<br /><b>Fix:</b> {scene.light_fix}</p>
          <p><b>🏙 Background:</b> {scene.background}</p>
          <p><b>📍 Best spot:</b> {scene.spot_tip}</p>
          <p><b>📱 Photographer:</b></p>
          <List items={[scene.camera_height, scene.camera_distance, `Framing: ${scene.framing} body`]} />
          <p><b>🧍 Pose:</b> {scene.pose_direction}</p>
          <p className="muted small">Recommended pose select kar diya hai. Ghost ko follow karo.</p>
          <Lesson text={scene.lesson} />
        </Sheet>
      )}
    </div>
  )
}

// MediaPipe ke points pure video frame ke hisaab se hote hain, par screen pe video "cover" crop hokar dikhta hai.
// Isliye points ko screen ke coordinates (0-1) mein badalte hain.
function toDisplay(lm, video, W, H) {
  const vw = video.videoWidth, vh = video.videoHeight
  const s = Math.max(W / vw, H / vh)
  const offX = (W - vw * s) / 2, offY = (H - vh * s) / 2
  return lm.map((p) => ({ ...p, x: (p.x * vw * s + offX) / W, y: (p.y * vh * s + offY) / H }))
}

function draw(ctx, W, H, pose, pts, score) {
  ctx.clearRect(0, 0, W, H)
  // 1. Ghost (target pose)
  const g = fitSkeleton(skeletonFromAngles(pose.angles), pose.framing, W, H)
  ctx.lineCap = 'round'
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'
  ctx.lineWidth = Math.max(10, W / 28)
  ctx.setLineDash([])
  for (const [a, b] of BONES) {
    if (pose.framing !== 'full' && /Knee|Ankle/.test(b)) continue
    ctx.beginPath(); ctx.moveTo(g[a].x, g[a].y); ctx.lineTo(g[b].x, g[b].y); ctx.stroke()
  }
  ctx.beginPath(); ctx.arc(g.head.x, g.head.y, g.headRadius, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fill()

  // 2. Live skeleton (tum) - colour score ke hisaab se
  if (!pts) return
  const color = score >= GOOD ? '#3ddc84' : score >= OK ? '#e8c27a' : '#ff6b6b'
  ctx.strokeStyle = color
  ctx.lineWidth = 4
  for (const [a, b] of BONES) {
    if (pts[a].v < 0.5 || pts[b].v < 0.5) continue
    ctx.beginPath(); ctx.moveTo(pts[a].x, pts[a].y); ctx.lineTo(pts[b].x, pts[b].y); ctx.stroke()
  }
  ctx.fillStyle = color
  for (const k of Object.keys(pts)) {
    if (pts[k].v < 0.5) continue
    ctx.beginPath(); ctx.arc(pts[k].x, pts[k].y, 5, 0, Math.PI * 2); ctx.fill()
  }
}
