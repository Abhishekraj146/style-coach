// FREE virtual try-on: open-source models jo Hugging Face pe free chalte hain.
// Ek server fail / busy / limit khatam ho -> app apne aap agla try karta hai.
//   Upper body (shirt, t-shirt, jacket, kurta): IDM-VTON -> Leffa
//   Lower body (pant, jeans, shorts): Leffa
// Dono Hugging Face ke free shared GPU (ZeroGPU) pe chalte hain aur unki roz ki limit EK hi hai (saare servers
// milake). Isliye backup server limit nahi badhata: woh tab kaam aata hai jab pehla server down ho, aur pant ke liye.
// Limit badhane ka tareeka: Hugging Face ka free token (Settings mein).
import { Client, handle_file } from '@gradio/client'
import { loadSettings } from './db'
import { shrinkDataUrl, dataUrlToBlob } from './image'

const UPPER = ['outerwear', 'top', 'ethnic', 'one-piece']

// Har server ka apna "kaise call karna hai"
const PROVIDERS = {
  'IDM-VTON': {
    space: 'yisol/IDM-VTON',
    parts: ['upper'],
    request: (person, cloth, garment) => ['/tryon', {
        dict: { background: handle_file(person), layers: [], composite: null },
        garm_img: handle_file(cloth),
        garment_des: garment.tags.name,
        is_checked: true, // auto-mask: model khud dhoondta hai kapda kahan pehnana hai
        is_checked_crop: false,
        denoise_steps: 30,
        seed: 42,
      }],
  },
  Leffa: {
    space: 'franciszzj/Leffa',
    parts: ['upper', 'lower'],
    request: (person, cloth, garment, part) => ['/leffa_predict_vt', {
        src_image_path: handle_file(person),
        ref_image_path: handle_file(cloth),
        ref_acceleration: false,
        step: 30,
        scale: 2.5,
        seed: 42,
        vt_model_type: part === 'lower' ? 'dress_code' : 'viton_hd', // pant ke liye "dress_code" model
        vt_garment_type: part === 'lower' ? 'lower_body' : 'upper_body',
        vt_repaint: false,
      }],
  },
}

// Outfit mein se try-on layak kapda chuno
export function pickGarment(items, part = 'upper') {
  if (part === 'lower') return items.find((i) => i?.tags?.category === 'bottom') || null
  for (const cat of UPPER) {
    const it = items.find((i) => i?.tags?.category === cat)
    if (it) return it
  }
  return null
}
export const pickUpperGarment = (items) => pickGarment(items, 'upper')

// servers: optional, sirf testing ke liye (e.g. ['Leffa']); normally saare servers order mein try hote hain
export async function tryOn({ personPhoto, items, part = 'upper', onStatus, servers }) {
  const garment = pickGarment(items, part)
  if (!garment) {
    throw new Error(part === 'lower' ? 'Is outfit mein koi pant/jeans nahi hai.' : 'Is outfit mein koi shirt/t-shirt/jacket nahi hai.')
  }
  const s = await loadSettings()
  const auth = s.hfToken?.startsWith('hf_') ? { token: s.hfToken } : {}

  // Model 3:4 (768x1024) photos pe best chalta hai
  const person = dataUrlToBlob(await shrinkDataUrl(personPhoto, 1024, 0.92))
  const cloth = dataUrlToBlob(await shrinkDataUrl(garment.image, 1024, 0.92))

  const order = Object.entries(PROVIDERS).filter(([name, p]) => p.parts.includes(part) && (!servers || servers.includes(name)))
  const errors = []
  for (const [name, p] of order) {
    try {
      onStatus?.(`${name} server se connect ho rahe hain…`)
      const client = await Client.connect(p.space, {
        ...auth,
        status_callback: (st) => {
          if (st.status === 'sleeping' || st.status === 'starting') onStatus?.(`${name} server jaag raha hai… (1-2 min)`)
        },
      })
      onStatus?.(`"${garment.tags.name}" pehna rahe hain (${name})… 30-90 sec`)
      // predict = poora jawab aane tak ruko. (submit wala loop naye Gradio servers pe error chhupa deta tha,
      // jaise "ZeroGPU quota exceeded" -> user ko galat message dikhta)
      const [endpoint, params] = p.request(person, cloth, garment, part)
      const res = await client.predict(endpoint, params)
      const url = res?.data?.[0]?.url
      if (!url) throw new Error('image nahi aayi')
      // Image ko phone mein save karne layak bana lo (server ka link kuch der baad expire ho jaata hai)
      const blob = await (await fetch(url)).blob()
      return { image: await blobToDataUrl(blob), garment, server: name }
    } catch (e) {
      errors.push(`${name}: ${e?.message || e?.title || JSON.stringify(e)}`)
      onStatus?.(`${name} nahi chala, agla free server try kar rahe hain…`)
    }
  }
  const all = errors.join(' | ')
  if (/quota|ZeroGPU|exceeded|limit/i.test(all)) {
    throw new Error('Aaj ki free try-on limit khatam (saare servers). Kal try karo, ya Me → Settings mein free Hugging Face token daalo (limit badhegi).')
  }
  throw new Error('Abhi koi free try-on server nahi chala. Thodi der baad try karo. (' + all + ')')
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result)
    r.onerror = reject
    r.readAsDataURL(blob)
  })
}
