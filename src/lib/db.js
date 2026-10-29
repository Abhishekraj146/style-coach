// Saara data phone ke andar hi IndexedDB mein save hota hai (koi server nahi).
// idb-keyval = IndexedDB ka simple wrapper: get(key) / set(key, value).
import { get, set } from 'idb-keyval'

const KEYS = {
  settings: 'settings',     // { claudeKey, geminiKey, claudeModel, geminiModel }
  profile: 'profile',       // { photo, facePhoto, info, analysis }
  wardrobe: 'wardrobe',     // [ { id, image, tags, addedAt } ]
  outfits: 'outfits',       // [ { id, occasion, outfit, tryOnImage, createdAt } ]
  references: 'references', // [ { id, image, pose, addedAt } ]  -> tumhari pasand ki photos
  taste: 'taste',           // { summary, updatedAt } -> pasand ki photos se bana style profile
  photos: 'photos',         // [ { id, image, review, createdAt } ] -> camera se kheenchi photos
}

export const DEFAULT_SETTINGS = {
  claudeKey: '',
  geminiKey: '',
  claudeModel: 'claude-opus-5-5',
  geminiModel: 'gemini-nano-banana-2.1',
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
