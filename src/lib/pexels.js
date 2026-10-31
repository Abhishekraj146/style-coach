// Asli pose photos: Pexels (free license, commercial use bhi allowed) se search.
// Free API key chahiye: pexels.com/api (account banao -> key milti hai). Key sirf phone mein rehti hai.
import { loadSettings } from './db'
import { shrinkDataUrl } from './image'

export async function searchPosePhotos(query, page = 1) {
  const { pexelsKey } = await loadSettings()
  if (!pexelsKey) throw new Error('Pose photos ke liye free Pexels key chahiye: Me → Settings mein daalo (pexels.com/api se 1 minute mein milti hai).')
  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&orientation=portrait&per_page=30&page=${page}`
  let res
  try {
    res = await fetch(url, { headers: { Authorization: pexelsKey } })
  } catch {
    throw new Error('Internet / connection problem.')
  }
  if (res.status === 401 || res.status === 403) throw new Error('Pexels key galat hai. Me → Settings check karo.')
  if (res.status === 429) throw new Error('Pexels ki free limit (ghante ki) khatam. Thodi der baad try karo.')
  if (!res.ok) throw new Error('Pexels error ' + res.status)
  const json = await res.json()
  return {
    photos: (json.photos || []).map((p) => ({
      id: p.id, thumb: p.src.medium, large: p.src.large2x || p.src.large, alt: p.alt,
      credit: { name: p.photographer, url: p.url }, // Pexels kehta hai photographer ko credit do
    })),
    more: !!json.next_page,
  }
}

// Chuni hui photo download karke phone mein save karne layak (dataURL) bana do
export async function downloadPhoto(url) {
  const blob = await (await fetch(url)).blob()
  const dataUrl = await new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result)
    r.onerror = reject
    r.readAsDataURL(blob)
  })
  return shrinkDataUrl(dataUrl, 1280, 0.88)
}

// Ready-made searches taaki type na karna pade
export const POSE_SEARCHES = [
  { label: 'Standing', q: 'man posing full body street style' },
  { label: 'Street', q: 'man walking street fashion' },
  { label: 'Sitting', q: 'man sitting pose fashion' },
  { label: 'Selfie', q: 'man selfie portrait' },
  { label: 'Wedding / Ethnic', q: 'indian man kurta pose' },
  { label: 'Formal', q: 'man suit pose' },
  { label: 'Casual', q: 'man casual outfit pose' },
  { label: 'Half body', q: 'man portrait waist up pose' },
]
