// FREE virtual try-on: open-source IDM-VTON model (Hugging Face Space "yisol/IDM-VTON").
// Tumhari photo + ek upper-body kapda (shirt / t-shirt / jacket / kurta) -> tum wo pehne hue.
// Limit: sirf upper body. Free GPU queue hai, isliye 1-2 min lag sakte hain, aur roz ki free limit hai.
// Hugging Face ka free account token (Settings mein) daaloge toh limit badh jaati hai.
import { Client, handle_file } from '@gradio/client'
import { loadSettings } from './db'
import { shrinkDataUrl, dataUrlToBlob } from './image'

const SPACE = 'yisol/IDM-VTON'
const UPPER = ['outerwear', 'top', 'ethnic', 'one-piece']

// Outfit mein se woh kapda chuno jo try-on ho sakta hai (jacket ho toh jacket, warna top)
export function pickUpperGarment(items) {
  for (const cat of UPPER) {
    const it = items.find((i) => i?.tags?.category === cat)
    if (it) return it
  }
  return null
}

export async function tryOn({ personPhoto, items, onStatus }) {
  const garment = pickUpperGarment(items)
  if (!garment) throw new Error('Is outfit mein koi shirt/t-shirt/jacket nahi hai. Free try-on sirf upper body ka hota hai.')
  const s = await loadSettings()

  onStatus?.('Free AI server se connect ho rahe hain…')
  let client
  try {
    client = await Client.connect(SPACE, {
      ...(s.hfToken?.startsWith('hf_') ? { token: s.hfToken } : {}),
      status_callback: (st) => {
        if (st.status === 'sleeping' || st.status === 'starting') onStatus?.('Free server jaag raha hai… (1-2 min)')
      },
    })
  } catch (e) {
    throw new Error('Try-on server abhi available nahi hai. Thodi der baad try karo. (' + (e.message || e) + ')')
  }

  // Model 3:4 (768x1024) photos pe best chalta hai
  const person = dataUrlToBlob(await shrinkDataUrl(personPhoto, 1024, 0.92))
  const cloth = dataUrlToBlob(await shrinkDataUrl(garment.image, 1024, 0.92))

  onStatus?.('Tumhe "' + garment.tags.name + '" pehna rahe hain… (30-90 sec)')
  let result
  try {
    const job = client.submit('/tryon', {
      dict: { background: handle_file(person), layers: [], composite: null },
      garm_img: handle_file(cloth),
      garment_des: garment.tags.name,
      is_checked: true, // auto-mask: model khud dhoondta hai kapda kahan pehnana hai
      is_checked_crop: false,
      denoise_steps: 30,
      seed: 42,
    })
    for await (const msg of job) {
      if (msg.type === 'status' && msg.stage === 'pending' && msg.queue && msg.position != null) {
        onStatus?.(`Free queue mein ho: aage ${msg.position} log hain…`)
      }
      if (msg.type === 'status' && msg.stage === 'error') {
        throw new Error(msg.message || 'server error')
      }
      if (msg.type === 'data') { result = msg.data; break }
    }
  } catch (e) {
    const m = String(e.message || e)
    if (/quota|ZeroGPU|exceeded/i.test(m)) {
      throw new Error('Aaj ki free try-on limit khatam. Kal try karo, ya Me → Settings mein free Hugging Face token daalo (limit badhegi).')
    }
    throw new Error('Try-on fail ho gaya: ' + m)
  }

  const url = result?.[0]?.url
  if (!url) throw new Error('Try-on image nahi aayi. Dobara try karo.')
  // Image ko phone mein save karne layak (dataURL) bana lo, warna link kuch der baad expire ho jaata hai
  const blob = await (await fetch(url)).blob()
  return { image: await blobToDataUrl(blob), garment }
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result)
    r.onerror = reject
    r.readAsDataURL(blob)
  })
}
