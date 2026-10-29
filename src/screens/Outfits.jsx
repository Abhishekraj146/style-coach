// Outfits: occasion chuno -> Claude tumhare wardrobe se combos banata hai -> Gemini se try-on.
import { useEffect, useState } from 'react'
import { ErrorText, Spinner, Lesson, List, Sheet } from '../components'
import { wardrobeDb, outfitsDb, loadProfile, newId, saveLesson } from '../lib/db'
import { suggestOutfits } from '../lib/claude'
import { tryOn } from '../lib/gemini'

const OCCASIONS = ['College', 'Date', 'Party / club', 'Wedding / festive', 'Office / interview', 'Casual outing', 'Travel', 'Family function']

export default function Outfits({ goTo }) {
  const [wardrobe, setWardrobe] = useState(null) // null = abhi load ho raha hai
  const [profile, setProfile] = useState({})
  const [saved, setSaved] = useState([])
  const [occasion, setOccasion] = useState('')
  const [notes, setNotes] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [tryState, setTryState] = useState({}) // { [outfitIndex]: { loading, image, error } }
  const [viewing, setViewing] = useState(null)

  useEffect(() => {
    wardrobeDb.load().then((w) => setWardrobe(w.filter((i) => i.tags)))
    loadProfile().then(setProfile)
    outfitsDb.load().then(setSaved)
  }, [])

  if (!wardrobe) return null // load hone se pehle "3 kapde add karo" flash na ho
  const byId = Object.fromEntries(wardrobe.map((w) => [w.id, w]))

  async function suggest() {
    setLoading(true); setError(null); setResult(null); setTryState({})
    try {
      const r = await suggestOutfits({ wardrobe, profileAnalysis: profile.analysis, occasion, notes })
      setResult(r)
      saveLesson(r.lesson, 'outfit')
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  async function doTryOn(i, outfit) {
    if (!profile.photo) { setTryState((s) => ({ ...s, [i]: { error: 'Pehle "Me" tab mein apni full-body photo daalo.' } })); return }
    setTryState((s) => ({ ...s, [i]: { loading: true } }))
    try {
      const image = await tryOn({ personPhoto: profile.photo, items: outfit.item_ids.map((id) => byId[id]), styling: outfit.how_to_wear.join('; ') })
      setTryState((s) => ({ ...s, [i]: { image } }))
    } catch (e) {
      setTryState((s) => ({ ...s, [i]: { error: e.message } }))
    }
  }

  async function save(i, outfit) {
    const entry = { id: newId(), occasion, outfit, tryOnImage: tryState[i]?.image || null, createdAt: Date.now() }
    setSaved(await outfitsDb.add(entry))
    setTryState((s) => ({ ...s, [i]: { ...s[i], saved: true } }))
  }

  if (wardrobe.length < 3) {
    return (
      <div className="page">
        <h1>Outfits</h1>
        <div className="empty">
          <p className="big">Pehle kam se kam 3 kapde add karo</p>
          <p>Top, bottom aur shoes, teeno daaloge toh combos acche banenge.</p>
          <button className="btn" onClick={() => goTo('wardrobe')}>Wardrobe kholo</button>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <h1>Kahan ja rahe ho?</h1>
      <div className="chips wrap">
        {OCCASIONS.map((o) => (
          <button key={o} className={'chip' + (o === occasion ? ' active' : '')} onClick={() => setOccasion(o)}>{o}</button>
        ))}
      </div>
      <input className="input" placeholder="Ya khud likho (e.g. dost ki birthday, rooftop cafe)" value={OCCASIONS.includes(occasion) ? '' : occasion} onChange={(e) => setOccasion(e.target.value)} />
      <input className="input" placeholder="Extra: mausam, din/raat, kaisa vibe chahiye…" value={notes} onChange={(e) => setNotes(e.target.value)} />
      {!profile.analysis && <p className="muted small">Tip: "Me" tab mein style profile banaoge toh suggestions tumhare skin tone aur body ke hisaab se aayenge.</p>}
      <button className="btn btn-block" disabled={!occasion || loading} onClick={suggest}>✨ Best combos batao</button>

      {loading && <Spinner text="Stylist soch raha hai… (20-40 sec)" />}
      <ErrorText error={error} />

      {result && (
        <div className="stack">
          {result.outfits.map((o, i) => (
            <div key={i} className="card outfit">
              <div className="outfit-head">
                <h2>{i === 0 ? '🏆 ' : ''}{o.title}</h2>
                <span className="badge">{o.rating}/10</span>
              </div>
              <div className="thumbs">
                {o.item_ids.map((id) => (
                  <figure key={id}>
                    <img src={byId[id].image} alt="" />
                    <figcaption>{byId[id].tags.name}</figcaption>
                  </figure>
                ))}
              </div>
              <p>{o.why_it_works}</p>
              <b className="small">Kaise pehno:</b>
              <List items={o.how_to_wear} />
              <p className="premium">💎 {o.premium_upgrade}</p>

              {tryState[i]?.image && <img className="tryon" src={tryState[i].image} alt="Try-on" onClick={() => setViewing(tryState[i].image)} />}
              {tryState[i]?.loading && <Spinner text="Tumhe yeh pehna ke dekh rahe hain… (30-60 sec)" />}
              <ErrorText error={tryState[i]?.error} />
              <div className="row">
                <button className="btn btn-ghost" disabled={tryState[i]?.loading} onClick={() => doTryOn(i, o)}>🪞 {tryState[i]?.image ? 'Dobara try-on' : 'Mujh pe try karo'}</button>
                <button className="btn btn-ghost" disabled={tryState[i]?.saved} onClick={() => save(i, o)}>{tryState[i]?.saved ? '✓ Saved' : '💾 Save'}</button>
              </div>
            </div>
          ))}
          {result.missing_pieces?.length > 0 && (
            <div className="card">
              <b>🛍️ Yeh kharidoge toh wardrobe level up hoga</b>
              <List items={result.missing_pieces} />
            </div>
          )}
          <Lesson text={result.lesson} />
        </div>
      )}

      {saved.length > 0 && (
        <>
          <h2 className="section">Saved outfits</h2>
          <div className="grid">
            {saved.map((s) => (
              <button key={s.id} className="card item" onClick={() => setViewing(s.tryOnImage || byId[s.outfit.item_ids[0]]?.image)}>
                <img src={s.tryOnImage || byId[s.outfit.item_ids[0]]?.image} alt="" />
                <div className="item-meta"><span className="item-name">{s.outfit.title}</span><span className="muted small">{s.occasion}</span></div>
              </button>
            ))}
          </div>
        </>
      )}

      {viewing && <Sheet onClose={() => setViewing(null)}><img className="sheet-img full" src={viewing} alt="" /></Sheet>}
    </div>
  )
}
