// Pose ki "geometry". Har pose = body ke har hisse ka angle (degree mein).
// Angle screen ke hisaab se: 0 = right, 90 = neeche, 180 = left, -90 = upar.
// "L" = screen pe LEFT dikhne wala haath/pair, "R" = screen pe RIGHT wala.
// (Isse photographer ko confusion nahi hota ki "tumhara left ya mera left".)

// MediaPipe landmark numbers
const NOSE = 0
const SH = [11, 12], EL = [13, 14], WR = [15, 16], HIP = [23, 24], KN = [25, 26], AN = [27, 28]

// Body ke hisso ki lambai, torso (kandhe se kamar) = 1 maan ke
const LEN = { upperArm: 0.6, forearm: 0.55, thigh: 0.85, shin: 0.8, head: 0.38 }

// 51 poses ab poseLibrary.js mein hain (pehle wale 6 bhi wahin, same id ke saath)
import { POSE_LIBRARY } from './poseLibrary'
export const PRESET_POSES = POSE_LIBRARY

export const FRAMING_TIPS = {
  full: 'Photographer: phone kamar (waist) ki height pe, halka sa upar tilt. 3-4 kadam door, 2x zoom. Isse legs lambi aur body proportion sahi aata hai.',
  half: 'Photographer: phone chest/aankh ki height pe, seedha. 2-3 kadam door, 2x zoom (paas aake wide lens se face mota dikhta hai).',
  close: 'Selfie: phone aankh se thoda upar, haath poora seedha (paas se chehra mota dikhta hai). 0.5x mat use karo. Light (khidki / sun) chehre ke saamne ho, peeche nahi.',
}

const rad = (d) => (d * Math.PI) / 180
const deg = (r) => (r * 180) / Math.PI
const dir = (a) => ({ x: Math.cos(rad(a)), y: Math.sin(rad(a)) })
const add = (p, a, len) => ({ x: p.x + dir(a).x * len, y: p.y + dir(a).y * len })
const angleOf = (p, q) => deg(Math.atan2(q.y - p.y, q.x - p.x))
const angleDiff = (a, b) => Math.abs(((a - b + 540) % 360) - 180)

// Angles -> skeleton points (unit space). Phir isko screen pe fit karte hain.
export function skeletonFromAngles(A) {
  const k = A.k || {} // lambai multiplier (haath camera ki taraf ho toh chhota dikhta hai)
  const L = (seg, base) => base * (k[seg] ?? 1)
  const hip = { x: 0, y: 0 }
  const shoulder = add(hip, A.torso, 1)
  const perp = A.torso + 90 // torso ke perpendicular (left-right)
  const half = A.sw / 2
  const pts = {
    LShoulder: add(shoulder, perp, half),
    RShoulder: add(shoulder, perp, -half),
    LHip: add(hip, perp, half * 0.75),
    RHip: add(hip, perp, -half * 0.75),
    head: add(shoulder, A.torso, LEN.head),
  }
  // perp = torso+90 = 0° jab torso -90 ho, yaani "right". L side ke liye ulta chahiye:
  ;[pts.LShoulder, pts.RShoulder] = [pts.RShoulder, pts.LShoulder]
  ;[pts.LHip, pts.RHip] = [pts.RHip, pts.LHip]
  pts.LElbow = add(pts.LShoulder, A.LupperArm, L('LupperArm', LEN.upperArm))
  pts.LWrist = add(pts.LElbow, A.Lforearm, L('Lforearm', LEN.forearm))
  pts.RElbow = add(pts.RShoulder, A.RupperArm, L('RupperArm', LEN.upperArm))
  pts.RWrist = add(pts.RElbow, A.Rforearm, L('Rforearm', LEN.forearm))
  pts.LKnee = add(pts.LHip, A.Lthigh, L('Lthigh', LEN.thigh))
  pts.LAnkle = add(pts.LKnee, A.Lshin, L('Lshin', LEN.shin))
  pts.RKnee = add(pts.RHip, A.Rthigh, L('Rthigh', LEN.thigh))
  pts.RAnkle = add(pts.RKnee, A.Rshin, L('Rshin', LEN.shin))
  return pts
}

export const BONES = [
  ['LShoulder', 'RShoulder'], ['LHip', 'RHip'], ['LShoulder', 'LHip'], ['RShoulder', 'RHip'],
  ['LShoulder', 'LElbow'], ['LElbow', 'LWrist'], ['RShoulder', 'RElbow'], ['RElbow', 'RWrist'],
  ['LHip', 'LKnee'], ['LKnee', 'LAnkle'], ['RHip', 'RKnee'], ['RKnee', 'RAnkle'],
]

// Unit skeleton ko screen (W x H pixels) pe framing ke hisaab se fit karo
//   full  = sar se pair tak | half = sar se kamar tak | close = selfie (sar + kandhe, kohni tak)
const FIT = {
  full: { keys: null, top: 0.1, bottom: 0.9 },
  half: { keys: /^(head|.*Shoulder|.*Elbow|.*Wrist|.*Hip)$/, top: 0.14, bottom: 0.97 },
  close: { keys: /^(head|.*Shoulder)$/, top: 0.2, bottom: 0.62 },
}
export function fitSkeleton(pts, framing, W, H) {
  const f = FIT[framing] || FIT.full
  const keys = Object.keys(pts).filter((k) => !f.keys || f.keys.test(k))
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const k of keys) {
    minX = Math.min(minX, pts[k].x); maxX = Math.max(maxX, pts[k].x)
    minY = Math.min(minY, pts[k].y); maxY = Math.max(maxY, pts[k].y)
  }
  minY -= 0.2 // sir ka upar wala hissa
  const scale = ((f.bottom - f.top) * H) / (maxY - minY)
  // full: poore figure ka center; half/close: body ki beech wali line (selfie mein phone wala haath bahar jaata hai)
  const cx = framing === 'full' ? (minX + maxX) / 2 : (pts.LShoulder.x + pts.RShoulder.x) / 2
  const out = {}
  for (const k of Object.keys(pts)) {
    out[k] = { x: W / 2 + (pts[k].x - cx) * scale, y: f.top * H + (pts[k].y - minY) * scale }
  }
  out.headRadius = 0.2 * scale
  out.scale = scale
  return out
}

// ---------- Live landmarks -> named points (display pixels) ----------
// mirror = front camera (screen pe ulta dikhta hai)
export function namedPoints(landmarks, W, H, mirror) {
  const P = (i) => ({ x: (mirror ? 1 - landmarks[i].x : landmarks[i].x) * W, y: landmarks[i].y * H, v: landmarks[i].visibility ?? 1 })
  // Jo kandha screen pe left mein hai, wahi "L" chain hai
  const a = P(SH[0]), b = P(SH[1])
  const s = a.x < b.x ? 0 : 1 // index of screen-left chain
  const o = 1 - s
  return {
    head: P(NOSE),
    LShoulder: P(SH[s]), RShoulder: P(SH[o]),
    LElbow: P(EL[s]), RElbow: P(EL[o]),
    LWrist: P(WR[s]), RWrist: P(WR[o]),
    LHip: P(HIP[s]), RHip: P(HIP[o]),
    LKnee: P(KN[s]), RKnee: P(KN[o]),
    LAnkle: P(AN[s]), RAnkle: P(AN[o]),
  }
}

const mid = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 })

// Kis segment ka angle kin do points se banta hai
const SEGMENTS = {
  LupperArm: ['LShoulder', 'LElbow', 'Screen-left wali kohni'],
  Lforearm: ['LElbow', 'LWrist', 'Screen-left wala haath'],
  RupperArm: ['RShoulder', 'RElbow', 'Screen-right wali kohni'],
  Rforearm: ['RElbow', 'RWrist', 'Screen-right wala haath'],
  Lthigh: ['LHip', 'LKnee', 'Screen-left wala ghutna'],
  Lshin: ['LKnee', 'LAnkle', 'Screen-left wala pair'],
  Rthigh: ['RHip', 'RKnee', 'Screen-right wala ghutna'],
  Rshin: ['RKnee', 'RAnkle', 'Screen-right wala pair'],
}

// useHead = selfie: kamar frame mein nahi hoti, toh body ka angle "kandhe -> sar" se naapte hain
// (ghost mein sar hamesha torso ki line pe hi hai, isliye dono tareeke same angle dete hain)
export function anglesFromPoints(p, useHead = false) {
  const sh = mid(p.LShoulder, p.RShoulder)
  let torso, torsoLen
  if (useHead) {
    torso = angleOf(sh, p.head)
    torsoLen = Math.hypot(p.head.x - sh.x, p.head.y - sh.y) / LEN.head || 1
  } else {
    const hip = mid(p.LHip, p.RHip)
    torso = angleOf(hip, sh)
    torsoLen = Math.hypot(sh.x - hip.x, sh.y - hip.y) || 1
  }
  const A = { torso, sw: Math.hypot(p.LShoulder.x - p.RShoulder.x, p.LShoulder.y - p.RShoulder.y) / torsoLen }
  for (const [k, [from, to]] of Object.entries(SEGMENTS)) A[k] = angleOf(p[from], p[to])
  return A
}

// Live pose vs target pose: score (0-100) + sabse badi galti ka hint
export function comparePose(live, target, framing) {
  const A = anglesFromPoints(live, framing === 'close')
  const T = target
  let total = 0, weight = 0, worst = null
  const segs = Object.entries(SEGMENTS).filter(([k]) => framing === 'full' || !/thigh|shin/.test(k))
  for (const [k, [from, to, label]] of segs) {
    if (live[from].v < 0.5 || live[to].v < 0.5) continue // jo hissa dikh nahi raha, usko skip
    const d = angleDiff(A[k], T[k])
    // 30° ka farak = us hisse ka 0 score. (60° pe galat poses bhi 80%+ le jaate the)
    total += Math.max(0, 1 - d / 30)
    weight += 1
    if (d > 12 && (!worst || d > worst.d)) worst = { k, d, from, to, label }
  }
  const torsoD = angleDiff(A.torso, T.torso)
  total += Math.max(0, 1 - torsoD / 20)
  weight += 1
  // Body kitni ghumi hai (saamne vs side): 0.3 ka farak = 0 score
  const swD = Math.abs(A.sw - T.sw)
  total += Math.max(0, 1 - swD / 0.3)
  weight += 1

  // Selfie: kohni aksar frame ke bahar hoti hai, isliye haath ki JAGAH (chehre/kandhe ke hisaab se) check karo
  let handHint = null
  if (framing === 'close') {
    const h = selfieHands(live, A, target)
    total += h.total
    weight += h.weight
    handHint = h.hint
  }

  const score = weight ? Math.round((total / weight) * 100) : 0
  let hint = null
  if (handHint) {
    hint = handHint
  } else if (worst) {
    // Target angle se joint kahan hona chahiye tha, vs abhi kahan hai
    const len = Math.hypot(live[worst.to].x - live[worst.from].x, live[worst.to].y - live[worst.from].y)
    const want = add(live[worst.from], T[worst.k], len)
    const dx = want.x - live[worst.to].x
    const dy = want.y - live[worst.to].y
    const where = Math.abs(dy) > Math.abs(dx) ? (dy < 0 ? 'thoda upar karo' : 'thoda neeche karo') : dx < 0 ? 'screen ke left ki taraf le jao' : 'screen ke right ki taraf le jao'
    hint = `${worst.label} ${where}`
  } else if (torsoD > 10) {
    hint = T.torso < A.torso ? 'Body thodi screen-left ki taraf jhukao' : 'Body thodi screen-right ki taraf jhukao'
  } else if (T.sw < 0.65 && A.sw > 0.8) {
    hint = 'Body camera se 20-30° side mein ghumao (chehra camera ki taraf rakho)'
  } else if (T.sw > 0.7 && A.sw < 0.55) {
    hint = 'Camera ki taraf thoda aur seedhe ghumo'
  }
  return { score, hint }
}

// Photographer ke liye: frame mein banda sahi jagah hai ya nahi
export function framingHints(p, framing, W, H) {
  if (framing === 'close') return selfieHints(p, W, H)
  const hints = []
  const top = (p.head.y - 0.09 * H) / H // naak se thoda upar = sir ka top (approx)
  const anklesSeen = p.LAnkle.v > 0.5 && p.RAnkle.v > 0.5 && Math.max(p.LAnkle.y, p.RAnkle.y) < H * 0.98
  const bottom = (framing === 'full' ? Math.max(p.LAnkle.y, p.RAnkle.y) : Math.max(p.LHip.y, p.RHip.y)) / H
  const height = bottom - top
  const cx = (p.LShoulder.x + p.RShoulder.x + p.LHip.x + p.RHip.x) / 4 / W

  if (top < 0.02) hints.push('📷 Sir kat raha hai: phone thoda upar tilt karo ya peeche jao')
  if (framing === 'full') {
    if (!anklesSeen) hints.push('📷 Pair kat rahe hain: 2 kadam peeche jao ya phone neeche (waist height) karo')
    else if (height < 0.6) hints.push('📷 Bahut door ho: paas aao ya zoom karo')
    else if (height > 0.9) hints.push('📷 Thoda peeche jao: upar-neeche thodi jagah chhodo')
  } else {
    if (height < 0.55) hints.push('📷 Half-body shot hai: paas aao ya 2x zoom karo')
  }
  if (Math.abs(cx - 0.5) > 0.1) hints.push(cx < 0.5 ? '📷 Phone thoda left ghumao (banda center mein aaye)' : '📷 Phone thoda right ghumao (banda center mein aaye)')
  return hints
}

// Selfie mein har haath: target mein haath frame mein (chehre ke paas) hai ya neeche/bahar?
// Position kandhon ke beech ke point se, torso-length units mein (isse door/paas hone se farak nahi padta).
function selfieHands(live, A, target) {
  const T = skeletonFromAngles(target)
  const tMid = mid(T.LShoulder, T.RShoulder)
  const lMid = mid(live.LShoulder, live.RShoulder)
  const unit = Math.hypot(live.head.x - lMid.x, live.head.y - lMid.y) / LEN.head || 1
  let total = 0, weight = 0, hint = null
  for (const side of ['L', 'R']) {
    const label = side === 'L' ? 'Screen-left wala haath' : 'Screen-right wala haath'
    const tw = { x: T[side + 'Wrist'].x - tMid.x, y: T[side + 'Wrist'].y - tMid.y }
    const lw = live[side + 'Wrist']
    const lv = { x: (lw.x - lMid.x) / unit, y: (lw.y - lMid.y) / unit }
    const targetIn = Math.abs(tw.x) < 0.45 && tw.y < 0.55 // target mein haath selfie frame ke andar
    const liveIn = lw.v > 0.5 && lv.y < 0.55
    let sc = 1
    if (targetIn && liveIn) {
      const d = Math.hypot(tw.x - lv.x, tw.y - lv.y)
      sc = Math.max(0, 1 - d / 0.6)
      if (d > 0.25 && !hint) {
        const dx = tw.x - lv.x, dy = tw.y - lv.y
        hint = `${label} ` + (Math.abs(dy) > Math.abs(dx) ? (dy < 0 ? 'thoda upar karo' : 'thoda neeche karo') : dx < 0 ? 'screen ke left le jao' : 'screen ke right le jao')
      }
    } else if (targetIn && !liveIn) {
      sc = 0
      hint ||= `${label} upar lao (chehre / kandhe ke paas)`
    } else if (!targetIn && liveIn && lv.y < 0.3) {
      sc = 0.3
      hint ||= `${label} neeche karo (frame se bahar)`
    }
    total += sc * 1.5 // selfie mein haath hi pose ka main farak hai, isliye zyada weight
    weight += 1.5
  }
  return { total, weight, hint }
}

// Selfie (front camera): chehra sahi size + jagah pe ho, kandhe dikhen
function selfieHints(p, W, H) {
  const hints = []
  const shouldersSeen = p.LShoulder.v > 0.5 && p.RShoulder.v > 0.5
  if (!shouldersSeen) return ['📱 Phone thoda door karo: kandhe bhi frame mein aane chahiye']
  const midY = (p.LShoulder.y + p.RShoulder.y) / 2
  const face = (midY - p.head.y) / H // naak se kandhe tak = chehre ka size
  const cx = (p.LShoulder.x + p.RShoulder.x) / 2 / W
  if (p.head.y / H < 0.12) hints.push('📱 Sir kat raha hai: phone thoda neeche ya door karo')
  if (face > 0.4) hints.push('📱 Bahut paas hai (chehra mota dikhega): haath seedha karke phone door karo')
  else if (face < 0.16) hints.push('📱 Bahut door hai: phone thoda paas lao')
  if (p.head.y / H > 0.5) hints.push('📱 Phone aankh se thoda upar rakho (neeche se angle achha nahi lagta)')
  if (Math.abs(cx - 0.5) > 0.15) hints.push(cx < 0.5 ? '📱 Phone thoda left le jao' : '📱 Phone thoda right le jao')
  return hints
}

// Pasand ki photo se custom pose banao
export function poseFromLandmarks(landmarks, imgW, imgH) {
  const p = namedPoints(landmarks, imgW, imgH, false)
  const anklesSeen = p.LAnkle.v > 0.5 && p.RAnkle.v > 0.5
  const hipsSeen = p.LHip.v > 0.5 && p.RHip.v > 0.5
  const framing = anklesSeen ? 'full' : hipsSeen ? 'half' : 'close' // kamar bhi nahi dikhi = selfie
  return { angles: anglesFromPoints(p, framing === 'close'), framing }
}
