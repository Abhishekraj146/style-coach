// Wardrobe: kapdo ki photo daalo -> Claude har kapde ko tag karta hai -> grid mein dikhte hain.
import { useEffect, useState } from 'react'
import { ImageButton, Sheet, ErrorText, Spinner } from '../components'
import { wardrobeDb, newId } from '../lib/db'
import { tagClothing } from '../lib/ai'

const FILTERS = ['all', 'top', 'bottom', 'outerwear', 'footwear', 'ethnic', 'accessory']

export default function Wardrobe({ goTo }) {
  const [items, setItems] = useState([])
  const [filter, setFilter] = useState('all')
  const [open, setOpen] = useState(null)
  const [busy, setBusy] = useState(0) // kitne items abhi tag ho rahe hain

  useEffect(() => { wardrobeDb.load().then(setItems) }, [])

  // Ek-ek karke tag karo (saath mein 10 bhejoge toh rate limit lag sakti hai)
  async function addImages(urls) {
    const fresh = urls.map((image) => ({ id: newId(), image, tags: null, status: 'tagging', addedAt: Date.now() }))
    let list = await wardrobeDb.load()
    list = [...fresh, ...list]
    await wardrobeDb.save(list)
    setItems(list)
    setBusy((b) => b + fresh.length)
    for (const it of fresh) {
      await tagOne(it)
      setBusy((b) => b - 1)
    }
  }

  async function tagOne(it) {
    try {
      const tags = await tagClothing(it.image)
      setItems(await wardrobeDb.update(it.id, { tags, status: 'ok', error: null }))
    } catch (e) {
      setItems(await wardrobeDb.update(it.id, { status: 'error', error: e.message }))
    }
  }

  async function remove(id) {
    setItems(await wardrobeDb.remove(id))
    setOpen(null)
  }

  const shown = items.filter((i) => filter === 'all' || i.tags?.category === filter)
  const tagged = items.filter((i) => i.tags).length

  return (
    <div className="page">
      <header className="page-head">
        <h1>Wardrobe <small>{items.length}</small></h1>
        <div className="row">
          <ImageButton label="📷 Photo lo" camera onImages={addImages} className="btn btn-ghost" />
          <ImageButton label="＋ Gallery" multiple onImages={addImages} />
        </div>
      </header>

      {busy > 0 && <Spinner text={`AI ${busy} kapde pehchan raha hai…`} />}

      {items.length === 0 && (
        <div className="empty">
          <p className="big">Apne kapde add karo</p>
          <p>Har kapda alag photo mein. Bed ya floor pe flat bichha ke, din ki light mein, upar se photo lo. Shoes aur jackets bhi daalo.</p>
        </div>
      )}

      {items.length > 0 && (
        <div className="chips">
          {FILTERS.map((f) => (
            <button key={f} className={'chip' + (f === filter ? ' active' : '')} onClick={() => setFilter(f)}>{f}</button>
          ))}
        </div>
      )}

      <div className="grid">
        {shown.map((it) => (
          <button key={it.id} className="card item" onClick={() => setOpen(it)}>
            <img src={it.image} alt="" />
            <div className="item-meta">
              {it.status === 'tagging' && <span className="muted">Tagging…</span>}
              {it.status === 'error' && <span className="err-tag">Tag fail, tap karo</span>}
              {it.tags && (
                <>
                  <span className="item-name">{it.tags.name}</span>
                  <span className="dots">{it.tags.colors.slice(0, 3).map((c, i) => <i key={i} style={{ background: c.hex }} />)}</span>
                </>
              )}
            </div>
          </button>
        ))}
      </div>

      {tagged >= 3 && (
        <button className="btn btn-block" onClick={() => goTo('outfits')}>✨ Ab outfit banwao</button>
      )}

      {open && (
        <Sheet onClose={() => setOpen(null)}>
          <img className="sheet-img" src={open.image} alt="" />
          <ErrorText error={open.error} />
          {open.tags ? (
            <>
              <h2>{open.tags.name}</h2>
              <p className="muted">{open.tags.category} · {open.tags.subcategory} · {open.tags.pattern} · {open.tags.fabric_guess} · fit: {open.tags.fit_guess}</p>
              <p className="muted">Formality {open.tags.formality}/5 · {open.tags.seasons.join(', ')} · {open.tags.occasions.join(', ')}</p>
              <p>{open.tags.style_notes}</p>
            </>
          ) : null}
          <div className="row">
            <button className="btn btn-ghost" onClick={() => { tagOne(open); setOpen(null) }}>🔄 Dobara tag karo</button>
            <button className="btn btn-danger" onClick={() => remove(open.id)}>🗑 Hatao</button>
          </div>
        </Sheet>
      )}
    </div>
  )
}
