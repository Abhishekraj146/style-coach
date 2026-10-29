// Gemini ka image model = virtual try-on. Tumhari photo + kapdo ki photos -> tum wo kapde pehne hue.
import { loadSettings } from './db'
import { shrinkDataUrl, splitDataUrl } from './image'

const BASE = 'https://generativelanguage.googleapis.com/v1beta'

export async function tryOn({ personPhoto, items, styling }) {
  const s = await loadSettings()
  if (!s.geminiKey) throw new Error('Gemini API key nahi daali. Profile → Settings mein daalo.')

  const person = splitDataUrl(await shrinkDataUrl(personPhoto, 1280, 0.9))
  const garments = []
  for (const it of items) garments.push({ ...splitDataUrl(await shrinkDataUrl(it.image, 900)), name: it.tags.name })

  const prompt = `Virtual try-on. Image 1 is a real person. Images 2-${garments.length + 1} are clothing items: ${garments
    .map((g, i) => `image ${i + 2} = ${g.name}`)
    .join(', ')}.
Create a photorealistic full-body photo of THE SAME PERSON from image 1 wearing exactly these items together.
Keep his face, hair, skin tone, body shape, height and proportions identical - it must look like him, not a model.
Copy each garment's real colour, pattern, texture and fit faithfully. Natural fabric folds, realistic lighting and shadows.
Styling: ${styling || 'neat, well-fitted'}.
Standing in a relaxed confident pose, clean softly lit neutral background, vertical 3:4 photo.`

  const input = [
    { type: 'text', text: prompt },
    { type: 'image', mime_type: person.mediaType, data: person.data },
    ...garments.map((g) => ({ type: 'image', mime_type: g.mediaType, data: g.data })),
  ]

  const res = await fetch(`${BASE}/interactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': s.geminiKey },
    body: JSON.stringify({
      model: s.geminiModel,
      input,
      response_format: { type: 'image', aspect_ratio: '3:4', image_size: '1K' },
    }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    // Google kabhi error ko array mein lapet ke bhejta hai: [{ error: {...} }]
    const err = Array.isArray(json) ? json[0]?.error : json?.error
    const msg = err?.message || res.statusText || 'unknown error'
    if (/API key/i.test(msg)) throw new Error('Gemini API key galat hai. Settings check karo.')
    if (res.status === 429) throw new Error('Gemini limit khatam (rate limit / quota). Thodi der baad try karo.')
    throw new Error(`Gemini error ${res.status}: ${msg}`)
  }

  const image = findImage(json)
  if (!image) throw new Error('Gemini ne image nahi bheji. Dobara try karo (ya kapdo ki photo saaf lo).')
  return `data:${image.mime_type || 'image/png'};base64,${image.data}`
}

// Response mein image dhoondo: steps[] -> content[] -> { type: 'image', data }.
// Last model_output wali image lete hain (beech ki "thought" images skip).
function findImage(json) {
  if (json.output_image?.data) return json.output_image
  const steps = json.steps || []
  for (let i = steps.length - 1; i >= 0; i--) {
    if (steps[i].type !== 'model_output') continue
    const img = (steps[i].content || []).find((c) => c.type === 'image' && c.data)
    if (img) return img
  }
  return null
}
