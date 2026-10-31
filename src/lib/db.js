// Saara data phone ke andar hi IndexedDB mein save hota hai (koi server nahi).
// idb-keyval = IndexedDB ka simple wrapper: get(key) / set(key, value).
import { get, set, entries } from 'idb-keyval'

const KEYS = {
  settings: 'settings',     // { geminiKey, hfToken, textModel } (+ purane paid wale fields, ab use nahi hote)
  profile: 'profile',       // { photo, facePhoto, info, analysis }
  wardrobe: 'wardrobe',     // [ { id, image, tags, addedAt } ]
  outfits: 'outfits',       // [ { id, occasion, outfit, tryOnImage, createdAt } ]
  references: 'references', // [ { id, image, pose, addedAt } ]  -> tumhari pasand ki photos
  taste: 'taste',           // { summary, updatedAt } -> pasand ki photos se bana style profile
  photos: 'photos',         // [ { id, image, review, createdAt } ] -> camera se kheenchi photos
}

export const DEFAULT_SETTINGS = {
  geminiKey: '',                 // FREE: aistudio.google.com/apikey (Google account se)
  hfToken: '',                   // optional FREE: huggingface.co token -> try-on ki daily limit badhti hai
  groqKey: '',                   // optional FREE backup AI (open-source Qwen): console.groq.com/keys
  openrouterKey: '',             // optional FREE backup AI (open-source Gemma etc.): openrouter.ai/keys
  textModel: 'gemini-3.8-flash', // free-tier model; limit khatam ho toh ai.js khud doosre free models try karta hai
}

export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7)

export async function loadSettings() {
  return { ...DEFAULT_SETTINGS, ...((await get(KEYS.settings)) || {}) }
}
export const saveSettings = (s) => set(KEYS.settings, s)

export const loadProfile = async () => (await get(KEYS.profile)) || {}
export const saveProfile = (p) => set(KEYS.profile, p)

export const loadTaste = async () => (await get(KEYS.taste)) || null
export const saveTaste = (t) => set(KEYS.taste, t)

// List wale stores ke liye ek hi pattern: load, add (sabse upar), update, remove.
function listStore(key) {
  return {
    load: async () => (await get(key)) || [],
    save: (list) => set(key, list),
    async add(item) {
      const list = (await get(key)) || []
      const next = [item, ...list]
      await set(key, next)
      return next
    },
    async update(id, patch) {
      const list = (await get(key)) || []
      const next = list.map((x) => (x.id === id ? { ...x, ...patch } : x))
      await set(key, next)
      return next
    },
    async remove(id) {
      const list = (await get(key)) || []
      const next = list.filter((x) => x.id !== id)
      await set(key, next)
      return next
    },
  }
}

export const wardrobeDb = listStore(KEYS.wardrobe)
export const outfitsDb = listStore(KEYS.outfits)
export const referencesDb = listStore(KEYS.references)
export const photosDb = listStore(KEYS.photos)
export const lessonsDb = listStore('lessons') // [ { id, text, source, createdAt } ] -> AI ki har seekh yahan jama hoti hai

export const saveLesson = (text, source) =>
  text ? lessonsDb.add({ id: newId(), text, source, createdAt: Date.now() }) : null

// ---------- Backup / Restore ----------
// Settings (API keys) backup mein NAHI jaati: file Drive/WhatsApp pe jaayegi, keys wahan nahi honi chahiye.
export async function exportAll() {
  const data = {}
  for (const [k, v] of await entries()) if (k !== KEYS.settings) data[k] = v
  return { app: 'style-coach', version: 1, exportedAt: Date.now(), data }
}

// Restore: backup ka data wapas likho. Jo cheez backup mein nahi hai, use chhedte nahi (kuch delete nahi hota).
export async function importAll(backup) {
  if (backup?.app !== 'style-coach' || typeof backup.data !== 'object') throw new Error('Style Coach ki backup file nahi hai')
  let n = 0
  for (const [k, v] of Object.entries(backup.data)) {
    if (k === KEYS.settings) continue
    await set(k, v)
    n += Array.isArray(v) ? v.length : 1
  }
  return n
}
