// Chhote reusable UI tukde jo har screen mein use hote hain.
import { useRef } from 'react'
import { fileToDataUrl } from './lib/image'

// Photo chunne ka button. capture="environment" = phone pe seedha camera khulta hai.
export function ImageButton({ label, onImages, multiple = false, camera = false, className = 'btn' }) {
  const ref = useRef()
  async function handle(e) {
    const files = [...e.target.files]
    e.target.value = '' // same file dobara chun sako
    const urls = []
    for (const f of files) urls.push(await fileToDataUrl(f))
    if (urls.length) onImages(urls)
  }
  return (
    <>
      <button className={className} onClick={() => ref.current.click()}>{label}</button>
      <input ref={ref} type="file" accept="image/*" hidden multiple={multiple} capture={camera ? 'environment' : undefined} onChange={handle} />
    </>
  )
}

export function Spinner({ text }) {
  return (
    <div className="spinner">
      <span className="dot" />
      {text}
    </div>
  )
}

export function ErrorText({ error }) {
  if (!error) return null
  return <div className="error">⚠️ {error}</div>
}

export function Sheet({ onClose, children }) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <button className="sheet-close" onClick={onClose}>✕</button>
        {children}
      </div>
    </div>
  )
}

export function Lesson({ text }) {
  if (!text) return null
  return (
    <div className="lesson">
      <b>📚 Aaj ki seekh</b>
      <p>{text}</p>
    </div>
  )
}

export const List = ({ items }) => (
  <ul className="list">{items?.map((t, i) => <li key={i}>{t}</li>)}</ul>
)
