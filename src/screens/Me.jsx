// Me: tumhari photo (try-on ke liye), style profile, API keys, aur ab tak ki saari seekh.
import { useEffect, useState } from 'react'
import { ImageButton, Spinner, ErrorText, List } from '../components'
import { loadProfile, saveProfile, loadSettings, saveSettings, lessonsDb, saveLesson } from '../lib/db'
import { analyzeProfile } from '../lib/claude'

export default function Me() {
  const [profile, setProfile] = useState({})
  const [settings, setSettings] = useState(null)
  const [lessons, setLessons] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [savedMsg, setSavedMsg] = useState('')

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
  const noKeys = settings && (!settings.claudeKey || !settings.geminiKey)

  return (
    <div className="page">
      <h1>Me</h1>

      {noKeys && <div className="card warn">🔑 Neeche Settings mein Claude aur Gemini API keys daalo, tabhi AI features chalenge.</div>}

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
          <label>Claude API key <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">(yahan se lo)</a></label>
          <input className="input" type="password" value={settings.claudeKey} onChange={(e) => setSettings({ ...settings, claudeKey: e.target.value.trim() })} placeholder="sk-ant-..." />
          <label>Gemini API key <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">(yahan se lo)</a></label>
          <input className="input" type="password" value={settings.geminiKey} onChange={(e) => setSettings({ ...settings, geminiKey: e.target.value.trim() })} placeholder="AIza..." />
          <details>
            <summary className="small">Advanced: models</summary>
            <label>Claude model</label>
            <input className="input" value={settings.claudeModel} onChange={(e) => setSettings({ ...settings, claudeModel: e.target.value.trim() })} />
            <label>Gemini image model</label>
            <input className="input" value={settings.geminiModel} onChange={(e) => setSettings({ ...settings, geminiModel: e.target.value.trim() })} />
          </details>
          <button className="btn btn-block" onClick={storeSettings}>{savedMsg || 'Save settings'}</button>
          <p className="muted small">Keys sirf is phone ke andar save hoti hain. Is app ka link kisi ko mat dena.</p>
        </div>
      )}
    </div>
  )
}
