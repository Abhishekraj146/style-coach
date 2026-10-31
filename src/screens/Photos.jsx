// Photos: (1) tumhari pasand ki "achhi" photos -> taste profile + custom poses
//         (2) camera se kheenchi photos -> honest review
import { useEffect, useState } from 'react'
import { ImageButton, Spinner, ErrorText, Sheet, List, Lesson } from '../components'
import { referencesDb, photosDb, loadTaste, saveTaste, newId, saveLesson } from '../lib/db'
import { buildTasteProfile, reviewPhoto } from '../lib/ai'
import { detectPoseAndOutline } from '../lib/poseDetector'
import { poseFromLandmarks } from '../lib/poses'
import { loadImage, dataUrlToBlob } from '../lib/image'

export default function Photos() {
  const [tab, setTab] = useState('mine')
  const [refs, setRefs] = useState([])
  const [shots, setShots] = useState([])
  const [taste, setTaste] = useState(null)
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)
  const [open, setOpen] = useState(null)

  useEffect(() => {
    referencesDb.load().then(setRefs)
    photosDb.load().then(setShots)
    loadTaste().then(setTaste)
  }, [])

  async function addRefs(urls) {
    setBusy('Photos se pose nikal rahe hain…'); setError(null)
    for (const image of urls) {
      let pose = null
      try {
        const img = await loadImage(image)
        const { landmarks, outline } = await detectPoseAndOutline(img)
        // outline = photo wale insaan ka asli shape -> Camera mein overlay hota hai
        if (landmarks) pose = { ...poseFromLandmarks(landmarks, img.width, img.height), outline }
      } catch (e) {
        console.warn('pose detect fail', e) // pose na mile toh bhi photo taste ke liye kaam aayegi
      }
      setRefs(await referencesDb.add({ id: newId(), image, pose, addedAt: Date.now() }))
    }
    setBusy(null)
  }

  async function makeTaste() {
    setBusy('Tumhari pasand samajh raha hai… (30-60 sec)'); setError(null)
    try {
      const t = await buildTasteProfile(refs.map((r) => r.image))
      const saved = { ...t, updatedAt: Date.now() }
      await saveTaste(saved)
      setTaste(saved)
    } catch (e) {
      setError(e.message)
    }
    setBusy(null)
  }

  async function review(shot) {
    setOpen({ ...shot, loading: true })
    try {
      const r = await reviewPhoto({ photo: shot.image, taste })
      setShots(await photosDb.update(shot.id, { review: r }))
      setOpen({ ...shot, review: r })
      saveLesson(r.lesson, 'photo review')
    } catch (e) {
      setOpen({ ...shot, error: e.message })
    }
  }

  async function share(shot) {
    const file = new File([dataUrlToBlob(shot.image)], `photo-${shot.id}.jpg`, { type: 'image/jpeg' })
    if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file] })
    else {
      const a = document.createElement('a')
      a.href = shot.image; a.download = file.name; a.click()
    }
  }

  return (
    <div className="page">
      <div className="seg">
        <button className={tab === 'mine' ? 'active' : ''} onClick={() => setTab('mine')}>Meri photos ({shots.length})</button>
        <button className={tab === 'refs' ? 'active' : ''} onClick={() => setTab('refs')}>Pasand ki ({refs.length})</button>
      </div>
      {busy && <Spinner text={busy} />}
      <ErrorText error={error} />

      {tab === 'mine' && (
        <>
          {shots.length === 0 && <div className="empty"><p>Camera tab se photo lo, yahan dikhengi. Har photo ka honest review milega.</p></div>}
          <div className="grid">
            {shots.map((s) => (
              <button key={s.id} className="card item" onClick={() => setOpen(s)}>
                <img src={s.image} alt="" />
                <div className="item-meta">
                  <span className="muted small">{s.pose}</span>
                  {s.review && <span className="badge">{s.review.score}/10</span>}
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {tab === 'refs' && (
        <>
          <p className="muted">Woh photos daalo jo tumhe "wow" lagti hain: apni ya kisi aur ki (Pinterest, Instagram screenshots). App inse seekhega ki tumhe kaisi photo pasand hai, aur photo wale insaan ki asli outline Camera pe aa jayegi: usme fit hoke click karo. Yeh photos sirf tumhare phone mein rehti hain.</p>
          <div className="row">
            <ImageButton label="＋ Pasand ki photos daalo" multiple onImages={addRefs} />
            <button className="btn btn-ghost" disabled={refs.length < 3 || !!busy} onClick={makeTaste}>🧠 Taste samjho</button>
          </div>
          {refs.length > 0 && refs.length < 3 && <p className="muted small">Kam se kam 3 photos daalo (8-10 best).</p>}

          {taste && (
            <div className="card">
              <b>🎯 Tumhara photo taste</b>
              <p>{taste.summary}</p>
              <p className="small"><b>Light:</b> {taste.lighting}<br /><b>Angle:</b> {taste.angles_and_height}<br /><b>Framing:</b> {taste.framing}<br /><b>Mood:</b> {taste.colors_mood}</p>
              <b className="small">Rules:</b>
              <List items={taste.rules} />
            </div>
          )}

          <div className="grid">
            {refs.map((r) => (
              <div key={r.id} className="card item">
                <img src={r.image} alt="" />
                <div className="item-meta">
                  <span className="muted small">{r.pose ? `✓ Pose mila (${r.pose.framing})` : 'Pose nahi mila'}</span>
                  <button className="link" onClick={async () => setRefs(await referencesDb.remove(r.id))}>Hatao</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {open && (
        <Sheet onClose={() => setOpen(null)}>
          <img className="sheet-img full" src={open.image} alt="" />
          {open.loading && <Spinner text="Photo check kar raha hai…" />}
          <ErrorText error={open.error} />
          {open.review ? (
            <>
              <h2>{open.review.score}/10: {open.review.verdict}</h2>
              <b>✅ Kya sahi hai</b>
              <List items={open.review.what_works} />
              <b>🔧 Agli baar</b>
              <List items={open.review.fix_next_time} />
              <b>✂️ Edit</b>
              <List items={open.review.edit_tips} />
              {open.review.outfit_note && <p><b>👕 Outfit:</b> {open.review.outfit_note}</p>}
              <Lesson text={open.review.lesson} />
            </>
          ) : (
            !open.loading && <button className="btn btn-block" onClick={() => review(open)}>🧠 Honest review do</button>
          )}
          <div className="row">
            <button className="btn btn-ghost" onClick={() => share(open)}>📤 Save / share</button>
            <button className="btn btn-danger" onClick={async () => { setShots(await photosDb.remove(open.id)); setOpen(null) }}>🗑 Delete</button>
          </div>
        </Sheet>
      )}
    </div>
  )
}
