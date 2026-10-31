// Me: tumhari photo (try-on ke liye), style profile, API keys, aur ab tak ki saari seekh.
import { useEffect, useRef, useState } from 'react'
import { ImageButton, Spinner, ErrorText, List } from '../components'
import { loadProfile, saveProfile, loadSettings, saveSettings, lessonsDb, saveLesson, exportAll, importAll } from '../lib/db'
import { analyzeProfile } from '../lib/ai'

export default function Me() {
  const [profile, setProfile] = useState({})
  const [settings, setSettings] = useState(null)
  const [lessons, setLessons] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [savedMsg, setSavedMsg] = useState('')
  const [backupMsg, setBackupMsg] = useState('')
  const restoreRef = useRef()

  useEffect(() => {
    loadProfile().then(setProfile)
    loadSettings().then(setSettings)
    lessonsDb.load().then(setLessons)
  }, [])

  async function update(patch) {
    const next = { ...profile, ...patch }
    setProfile(next)
    await saveProfile(next)
  }

  async function analyze() {
    setLoading(true); setError(null)
    try {
      const analysis = await analyzeProfile(profile)
      await update({ analysis })
      await saveLesson(analysis.premium_tips?.[0], 'style profile')
      setLessons(await lessonsDb.load())
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  async function storeSettings() {
    await saveSettings(settings)
    setSavedMsg('✓ Saved')
    setTimeout(() => setSavedMsg(''), 1500)
  }

  const a = profile.analysis
  const noKeys = settings && !settings.geminiKey

  async function doBackup() {
    const json = JSON.stringify(await exportAll())
    const file = new File([json], `style-coach-backup-${new Date().toISOString().slice(0, 10)}.json`, { type: 'application/json' })
    if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file] }).catch(() => {})
    else {
      const a = document.createElement('a')
      a.href = URL.createObjectURL(file); a.download = file.name; a.click()
    }
  }

  async function doRestore(e) {
    const f = e.target.files[0]
    e.target.value = ''
    if (!f) return
    try {
      const n = await importAll(JSON.parse(await f.text()))
      setBackupMsg(`✓ ${n} cheezein wapas aa gayi. App reload ho raha hai…`)
      setTimeout(() => location.reload(), 1200)
    } catch (err) {
      setBackupMsg('⚠️ Yeh backup file sahi nahi hai: ' + err.message)
    }
  }

  return (
    <div className="page">
      <h1>Me</h1>

      {noKeys && <div className="card warn">🔑 AI features ke liye neeche Settings mein <b>free</b> Gemini key daalo (2 minute ka kaam, koi paisa nahi).</div>}

      <div className="card">
        <b>📸 Meri photos</b>
        <p className="muted small">Full-body photo: seedhe khade, fitted kapde, achhi light, sar se pair tak. Isi pe try-on hoga. Face photo: din ki natural light mein, bina filter (skin tone ke liye).</p>
        <div className="me-photos">
          <div>
            {profile.photo ? <img src={profile.photo} alt="" /> : <div className="ph">Full body</div>}
            <ImageButton label={profile.photo ? 'Badlo' : '＋ Full body'} onImages={([u]) => update({ photo: u })} className="btn btn-ghost btn-sm" />
          </div>
          <div>
            {profile.facePhoto ? <img src={profile.facePhoto} alt="" /> : <div className="ph">Face</div>}
            <ImageButton label={profile.facePhoto ? 'Badlo' : '＋ Face'} onImages={([u]) => update({ facePhoto: u })} className="btn btn-ghost btn-sm" />
          </div>
        </div>
        <textarea className="input" rows={2} placeholder="Height, weight, kaisa style pasand hai, kya pehen ke awkward lagta hai…" value={profile.info || ''} onChange={(e) => update({ info: e.target.value })} />
        <button className="btn btn-block" disabled={!profile.photo || loading} onClick={analyze}>🧠 {a ? 'Style profile update karo' : 'Mera style profile banao'}</button>
        {loading && <Spinner text="Tumhe dekh ke samajh raha hai… (30-60 sec)" />}
        <ErrorText error={error} />
      </div>

      {a && (
        <div className="card">
          <b>🎨 Tumhara style profile</b>
          <p>{a.summary}</p>
          <p className="small">Undertone: <b>{a.skin_undertone}</b> · Contrast: <b>{a.contrast_level}</b></p>
          <p className="small">{a.body_notes}</p>
          <b className="small">✅ Best colours</b><List items={a.best_colors} />
          <b className="small">❌ Face ke paas avoid</b><List items={a.avoid_colors} />
          <b className="small">👖 Best fits</b><List items={a.best_fits} />
          <b className="small">🚫 Avoid fits</b><List items={a.avoid_fits} />
          <b className="small">💎 Premium dikhne ke liye</b><List items={a.premium_tips} />
        </div>
      )}

      {lessons.length > 0 && (
        <div className="card">
          <b>📚 Ab tak ki seekh ({lessons.length})</b>
          <ul className="list">
            {lessons.slice(0, 30).map((l) => <li key={l.id}>{l.text} <span className="muted small">· {l.source}</span></li>)}
          </ul>
        </div>
      )}

      {settings && (
        <div className="card">
          <b>⚙️ Settings</b>
          <label>Gemini API key (FREE) <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">→ yahan se lo</a></label>
          <input className="input" type="password" value={settings.geminiKey} onChange={(e) => setSettings({ ...settings, geminiKey: e.target.value.trim() })} placeholder="AIza..." />
          <p className="muted small">Google account se login → "Create API key" → copy karke yahan paste. Card ki zaroorat nahi.</p>
          <label>Hugging Face token (optional, FREE) <a href="https://huggingface.co/settings/tokens" target="_blank" rel="noreferrer">→ yahan se lo</a></label>
          <input className="input" type="password" value={settings.hfToken} onChange={(e) => setSettings({ ...settings, hfToken: e.target.value.trim() })} placeholder="hf_..." />
          <p className="muted small">Bina iske bhi try-on chalta hai. Free token daaloge toh roz zyada try-on kar paoge.</p>
          <label>Groq key (optional backup, FREE) <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer">→ yahan se lo</a></label>
          <input className="input" type="password" value={settings.groqKey} onChange={(e) => setSettings({ ...settings, groqKey: e.target.value.trim() })} placeholder="gsk_..." />
          <label>OpenRouter key (optional backup, FREE) <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer">→ yahan se lo</a></label>
          <input className="input" type="password" value={settings.openrouterKey} onChange={(e) => setSettings({ ...settings, openrouterKey: e.target.value.trim() })} placeholder="sk-or-..." />
          <p className="muted small">Gemini ki free limit khatam ho jaaye toh app apne aap inke open-source models (Qwen, Gemma) pe chala jaata hai. Ek bhi daalo toh backup ready.</p>
          <label>Pexels key (pose photos, FREE) <a href="https://www.pexels.com/api/" target="_blank" rel="noreferrer">→ yahan se lo</a></label>
          <input className="input" type="password" value={settings.pexelsKey} onChange={(e) => setSettings({ ...settings, pexelsKey: e.target.value.trim() })} placeholder="Pexels API key" />
          <p className="muted small">Camera → pose sheet → 🔍 se hazaaron asli pose photos search karke overlay kar sakte ho.</p>
          <details>
            <summary className="small">Advanced: AI model</summary>
            <label>Free text model (pehle yeh try hoga)</label>
            <input className="input" value={settings.textModel} onChange={(e) => setSettings({ ...settings, textModel: e.target.value.trim() })} />
          </details>
          <button className="btn btn-block" onClick={storeSettings}>{savedMsg || 'Save settings'}</button>
          <p className="muted small">Keys sirf is phone ke andar save hoti hain, kahin upload nahi hoti.</p>
        </div>
      )}

      <div className="card">
        <b>💾 Backup</b>
        <p className="muted small">Saara data (kapde, photos, profile, seekh) ek file mein save karo, Google Drive / WhatsApp pe khud ko bhej do. Phone badlo ya browser data clear ho jaaye, toh Restore se sab wapas.</p>
        <div className="row">
          <button className="btn btn-ghost" onClick={doBackup}>⬇️ Backup lo</button>
          <button className="btn btn-ghost" onClick={() => restoreRef.current.click()}>⬆️ Restore</button>
          <input ref={restoreRef} type="file" accept="application/json,.json" hidden onChange={doRestore} />
        </div>
        {backupMsg && <p className="small">{backupMsg}</p>}
      </div>
    </div>
  )
}
