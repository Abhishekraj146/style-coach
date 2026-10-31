// FREE AI "dimaag": Google Gemini free tier + open-source backup (Groq: Qwen, OpenRouter: Gemma/Nemotron).
// Kaam: kapdo ko pehchanna, combos banana, photo/scene analyze karna.
// claude.js (paid) jaisa hi hai: same functions, same JSON shape -> screens ko kuch pata nahi chalta ki AI badla.
import { z } from 'zod'
import { loadSettings } from './db'
import { shrinkDataUrl, splitDataUrl } from './image'

const BASE = 'https://generativelanguage.googleapis.com/v1beta'
// Free models, best pehle. Ek ki free limit khatam (429) ho toh agla try hota hai.
const FREE_MODELS = ['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-2.5-flash']

// Content ka format Claude jaisa rakha hai (text / image blocks), neeche Gemini format mein badalte hain.
const imageBlock = (dataUrl) => {
  const { mediaType, data } = splitDataUrl(dataUrl)
  return { type: 'image', source: { type: 'base64', media_type: mediaType, data } }
}

// Zod schema -> Gemini ko samajh aane wala JSON schema (faltu keys hata ke)
function toGeminiSchema(schema) {
  const clean = (node) => {
    if (Array.isArray(node)) return node.map(clean)
    if (!node || typeof node !== 'object') return node
    const out = {}
    for (const [k, v] of Object.entries(node)) {
      if (k === '$schema') continue
      if ((k === 'minimum' || k === 'maximum') && Math.abs(v) >= Number.MAX_SAFE_INTEGER) continue
      out[k] = clean(v)
    }
    return out
  }
  return clean(z.toJSONSchema(schema))
}

// Gemini ke jawab mein se text nikalo (alag-alag response shapes handle)
function extractText(json) {
  if (typeof json.output_text === 'string') return json.output_text
  const steps = json.steps || []
  for (let i = steps.length - 1; i >= 0; i--) {
    if (steps[i].type !== 'model_output') continue
    const t = (steps[i].content || []).filter((c) => c.type === 'text').map((c) => c.text).join('')
    if (t) return t
  }
  const parts = json.candidates?.[0]?.content?.parts || []
  return parts.map((p) => p.text || '').join('')
}

async function callModel(key, model, system, content, schema) {
  const input = [{ type: 'text', text: system }]
  for (const c of content) {
    if (c.type === 'text') input.push({ type: 'text', text: c.text })
    else input.push({ type: 'image', mime_type: c.source.media_type, data: c.source.data })
  }
  const res = await fetch(`${BASE}/interactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      model,
      input,
      response_format: { type: 'text', mime_type: 'application/json', schema: toGeminiSchema(schema) },
    }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    // Google kabhi error ko array mein lapet ke bhejta hai: [{ error: {...} }]
    const err = Array.isArray(json) ? json[0]?.error : json?.error
    return { error: { status: res.status, message: err?.message || res.statusText || 'unknown error' } }
  }
  return { text: extractText(json) }
}

// ---------- Open-source backup: Groq (Qwen) aur OpenRouter (Gemma / Nemotron) ----------
// Dono "OpenAI jaisa" format samajhte hain. JSON ka shape prompt mein likh ke bhejte hain, phir zod se check.
const GROQ = { url: 'https://api.groq.com/openai/v1/chat/completions', models: ['qwen/qwen3.8-27b'], maxImages: 3 }
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

// OpenRouter ke free models badalte rehte hain, isliye live list se chunte hain (photo samajhne wale + JSON dene wale)
let orModels = null
async function openRouterFreeVisionModels() {
  if (orModels) return orModels
  try {
    const { data } = await (await fetch('https://openrouter.ai/api/v1/models')).json()
    const ok = data.filter(
      (m) => m.id.endsWith(':free') && m.architecture?.input_modalities?.includes('image') &&
        m.supported_parameters?.includes('response_format') && !/safety|guard/i.test(m.id),
    )
    const rank = (id) => (/gemma/.test(id) ? 0 : /nemotron/.test(id) ? 1 : 2) // open-source pehle
    orModels = ok.map((m) => m.id).sort((a, b) => rank(a) - rank(b)).slice(0, 3)
  } catch {
    orModels = ['google/gemma-4-31b-it:free']
  }
  return orModels
}

async function callOpenAICompat(url, key, model, system, content, schema, maxImages = 10) {
  const parts = []
  let imgs = 0
  for (const c of content) {
    if (c.type === 'text') parts.push({ type: 'text', text: c.text })
    else if (imgs++ < maxImages) parts.push({ type: 'image_url', image_url: { url: `data:${c.source.media_type};base64,${c.source.data}` } })
  }
  const sys = system + '\n\nReply with ONLY one JSON object (no markdown, no extra text) that matches this JSON schema exactly:\n' + JSON.stringify(toGeminiSchema(schema))
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, messages: [{ role: 'system', content: sys }, { role: 'user', content: parts }], response_format: { type: 'json_object' } }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) return { error: { status: res.status, message: json?.error?.message || res.statusText || 'unknown error' } }
  return { text: json.choices?.[0]?.message?.content || '' }
}

// Kabhi model JSON ko ```json ... ``` mein lapet deta hai, woh hatao
const cleanJson = (t) => t.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')

// Saare AI calls isi se jaate hain. Order: Gemini (sabse achha) -> Groq -> OpenRouter.
// Jis service ki key Settings mein hai wahi try hoti hai. Ek fail / limit khatam -> agli.
async function askAI({ system, content, schema }) {
  const s = await loadSettings()
  const tries = []
  if (s.geminiKey) {
    for (const m of new Set([s.textModel, ...FREE_MODELS].filter(Boolean))) {
      tries.push({ service: 'Gemini', name: m, run: () => callModel(s.geminiKey, m, system, content, schema) })
    }
  }
  if (s.groqKey) {
    for (const m of GROQ.models) {
      tries.push({ service: 'Groq', name: m, run: () => callOpenAICompat(GROQ.url, s.groqKey, m, system, content, schema, GROQ.maxImages) })
    }
  }
  if (s.openrouterKey) {
    for (const m of await openRouterFreeVisionModels()) {
      tries.push({ service: 'OpenRouter', name: m, run: () => callOpenAICompat(OPENROUTER_URL, s.openrouterKey, m, system, content, schema) })
    }
  }
  if (!tries.length) throw new Error('Koi AI key nahi daali. Me → Settings mein kam se kam ek FREE key daalo (Gemini sabse achha).')

  const errors = []
  const badKey = new Set()
  for (const t of tries) {
    if (badKey.has(t.service)) continue // galat key hai toh us service ke baaki models try karna bekaar
    let r
    try {
      r = await t.run()
    } catch {
      errors.push({ t, kind: 'network' })
      continue
    }
    if (r.error) {
      const { status, message } = r.error
      if (status === 401 || status === 403 || /API key/i.test(message)) {
        badKey.add(t.service)
        errors.push({ t, kind: 'key' })
      } else {
        // 429 = free limit khatam, 404/400 = model nahi mila, 5xx = server down -> sab mein agla try karo
        errors.push({ t, kind: status === 429 || /quota|exhaust|rate/i.test(message) ? 'limit' : 'other', msg: `${status} ${message}`.slice(0, 120) })
      }
      continue
    }
    try {
      const parsed = schema.safeParse(JSON.parse(cleanJson(r.text)))
      if (parsed.success) return parsed.data
      errors.push({ t, kind: 'format' })
    } catch {
      errors.push({ t, kind: 'format' })
    }
  }

  if (errors.every((e) => e.kind === 'network')) throw new Error('Internet / connection problem. Network check karo.')
  const keys = [...badKey]
  if (keys.length && errors.every((e) => e.kind === 'key')) throw new Error(`${keys.join(', ')} key galat hai. Me → Settings check karo.`)
  if (errors.every((e) => e.kind === 'limit' || e.kind === 'key')) {
    throw new Error('Aaj ki free AI limit khatam ho gayi.' + (s.groqKey && s.openrouterKey ? ' Thodi der baad (ya kal) try karo.' : ' Me → Settings mein ek aur free key (Groq / OpenRouter) daaloge toh backup milega.'))
  }
  const summary = errors.map((e) => `${e.t.service} ${e.t.name}: ${e.kind === 'key' ? 'key galat' : e.msg || e.kind}`).join(' | ')
  throw new Error('AI se sahi jawab nahi aaya. Dobara try karo. (' + summary + ')')
}

// ---------- Fashion ka base knowledge (har styling call mein jaata hai) ----------
const STYLE_RULES = `You are a sharp, honest personal stylist for a young man in India. You explain in simple Hinglish (Hindi written in English letters, mixed with English), short sentences, no jargon without explaining it.
Your goal: make him look premium and intentional, never "average".
Principles you apply and TEACH:
- Fit beats brand. Shoulder seam on the shoulder, sleeves ending at wrist, trousers with little or no break. Ill-fitting = cheap look.
- Colour: max 3 colours per outfit. Neutrals (white, black, navy, grey, beige, olive, brown) are the base. Use one accent at most. Tonal / monochrome outfits look expensive.
- Contrast: match outfit contrast to his skin-hair contrast. Use undertone (warm/cool/neutral) to choose colours near the face.
- Proportion: tuck or half-tuck to define the waist; slim/straight bottoms with relaxed tops or the reverse, not baggy+baggy unless it is deliberate streetwear.
- Premium signals: solid colours over loud prints, no big logos, texture (linen, knit, oxford, suede), crisp ironing, clean shoes, matching belt and shoe tone, one good watch, sleeves rolled neatly.
- Shoes finish the outfit: white sneakers (casual), loafers/derbies (smart), boots (layers), kolhapuris/mojaris (ethnic).
- Occasion codes for India: college/casual, office/interview, date, party/club, wedding/festive (ethnic or Indo-western), travel, gym.
Be specific to the items you are given. Never invent items he does not own; if something is missing, say what to buy.`

// ---------- 1. Kapde ki photo -> tags ----------
const ClothingSchema = z.object({
  name: z.string().describe('Short name, e.g. "Navy oxford shirt"'),
  category: z.enum(['top', 'bottom', 'outerwear', 'footwear', 'ethnic', 'accessory', 'one-piece']),
  subcategory: z.string().describe('e.g. t-shirt, shirt, polo, jeans, chinos, kurta, sneakers'),
  colors: z.array(z.object({ name: z.string(), hex: z.string() })).describe('Main colours, most dominant first'),
  pattern: z.string().describe('solid, striped, checked, printed, graphic, etc.'),
  fabric_guess: z.string(),
  fit_guess: z.string().describe('slim, regular, relaxed, oversized, unknown'),
  formality: z.number().int().describe('1 = gym/home, 2 = casual, 3 = smart casual, 4 = formal, 5 = very formal/festive'),
  seasons: z.array(z.enum(['summer', 'monsoon', 'winter', 'all'])),
  occasions: z.array(z.string()),
  style_notes: z.string().describe('One or two Hinglish lines on how to wear/style this piece well'),
})

export async function tagClothing(imageDataUrl) {
  const small = await shrinkDataUrl(imageDataUrl, 800)
  return askAI({
    system: STYLE_RULES,
    schema: ClothingSchema,
    content: [
      imageBlock(small),
      { type: 'text', text: 'Yeh mere wardrobe ka ek item hai. Isko identify karo aur tag karo. Agar photo mein multiple items hain, toh sabse prominent item ko tag karo.' },
    ],
  })
}

// ---------- 2. Meri photo -> body/skin style profile ----------
const ProfileSchema = z.object({
  skin_undertone: z.enum(['warm', 'cool', 'neutral', 'unclear']),
  contrast_level: z.enum(['low', 'medium', 'high']).describe('Contrast between skin, hair and eyes'),
  body_notes: z.string().describe('Neutral, respectful description of build and proportions, only what matters for clothing'),
  best_colors: z.array(z.string()),
  avoid_colors: z.array(z.string()).describe('Colours to avoid near the face, with short reason'),
  best_fits: z.array(z.string()).describe('Fits/silhouettes that will flatter, e.g. "straight-fit dark jeans"'),
  avoid_fits: z.array(z.string()),
  premium_tips: z.array(z.string()).describe('5 specific tips for HIM to look premium'),
  summary: z.string().describe('3-4 line Hinglish summary of his style direction'),
})

export async function analyzeProfile({ photo, facePhoto, info }) {
  const content = [imageBlock(await shrinkDataUrl(photo, 1024))]
  if (facePhoto) content.push(imageBlock(await shrinkDataUrl(facePhoto, 800)))
  content.push({
    type: 'text',
    text: `Pehli photo meri full-body photo hai${facePhoto ? ', doosri natural light mein face close-up' : ''}. Mere baare mein: ${info || '(kuch nahi likha)'}.
Mera personal style profile banao: kaunse rang, fit aur silhouette mujh pe best lagenge aur kya avoid karun. Light ka asar dhyan mein rakho (agar undertone clear na ho toh "unclear" bolo). Respectful aur honest raho.`,
  })
  return askAI({ system: STYLE_RULES, schema: ProfileSchema, content })
}

// ---------- 3. Occasion -> outfit combos ----------
const OutfitsSchema = z.object({
  outfits: z.array(
    z.object({
      title: z.string().describe('Catchy short name, e.g. "Clean Navy Smart-Casual"'),
      item_ids: z.array(z.string()).describe('IDs from the wardrobe list ONLY'),
      why_it_works: z.string().describe('Colour + fit + occasion reasoning in Hinglish, 2-3 lines'),
      how_to_wear: z.array(z.string()).describe('Exact styling steps: tuck, roll sleeves, which buttons, etc.'),
      premium_upgrade: z.string().describe('One small thing that will make it look more expensive'),
      rating: z.number().int().describe('How well it fits the occasion, 1-10'),
    }),
  ),
  missing_pieces: z.array(z.string()).describe('Max 3 versatile items worth buying that would unlock better outfits'),
  lesson: z.string().describe('One fashion-sense lesson from these choices that he can reuse forever'),
})

export async function suggestOutfits({ wardrobe, profileAnalysis, occasion, notes }) {
  // Photos nahi, sirf tags bhejte hain: sasta aur fast. Tags pehle hi Claude ne banaye the.
  const catalog = wardrobe.map((it) => ({
    id: it.id,
    name: it.tags.name,
    category: it.tags.category,
    sub: it.tags.subcategory,
    colors: it.tags.colors.map((c) => c.name).join('/'),
    pattern: it.tags.pattern,
    fit: it.tags.fit_guess,
    formality: it.tags.formality,
  }))
  const result = await askAI({
    system: STYLE_RULES,
    schema: OutfitsSchema,
    content: [
      {
        type: 'text',
        text: `Mera wardrobe (JSON):
${JSON.stringify(catalog)}

Mera style profile: ${profileAnalysis ? JSON.stringify(profileAnalysis) : 'abhi nahi bana'}

Occasion: ${occasion}
Extra details: ${notes || 'none'}

Mujhe 3 best outfits do (agar wardrobe chhota hai toh kam). Har outfit mein top + bottom + footwear (agar available ho), optional layer/accessory. Best wala pehle.`,
      },
    ],
  })
  // Safety check: AI ne koi aisa item id diya jo wardrobe mein hai hi nahi, toh hata do.
  const valid = new Set(wardrobe.map((w) => w.id))
  result.outfits = result.outfits
    .map((o) => ({ ...o, item_ids: o.item_ids.filter((id) => valid.has(id)) }))
    .filter((o) => o.item_ids.length > 0)
  return result
}

// ---------- 4. Pasand ki photos -> taste profile ----------
const TasteSchema = z.object({
  summary: z.string().describe('What makes these photos good, in Hinglish, 4-6 lines'),
  lighting: z.string(),
  angles_and_height: z.string().describe('Camera height and angle patterns'),
  framing: z.string().describe('Crop, distance, subject placement patterns'),
  poses: z.array(z.string()).describe('Recurring pose ideas, described so someone can copy them'),
  colors_mood: z.string(),
  rules: z.array(z.string()).describe('5-8 concrete rules to recreate this look'),
})

export async function buildTasteProfile(images) {
  const content = []
  for (const img of images.slice(0, 10)) content.push(imageBlock(await shrinkDataUrl(img, 768)))
  content.push({
    type: 'text',
    text: 'Yeh woh photos hain jo mujhe "above average" lagti hain. Inme common kya hai? Ek taste profile banao jisse har nayi photo isi level ki aaye: light, angle, camera height, framing, pose aur colour mood.',
  })
  return askAI({ system: PHOTO_RULES, schema: TasteSchema, content })
}

// ---------- 5. Live scene analyze ----------
const PHOTO_RULES = `You are an expert portrait and street-style photographer coaching TWO people in Hinglish: the subject (a young man) and the friend holding the phone, who usually just presses the shutter.
Be concrete and physical: "2 kadam peeche", "phone chest height pe", "sun tumhare left side 45 degree pe rakho". No vague advice.
Know these: rule of thirds, leading lines, background separation, avoiding clutter/poles behind the head, soft light (shade, golden hour, window light), avoiding harsh top light and backlight blowouts, lens distortion (stand back + zoom 2x for portraits), low angle (waist height, slight tilt up) for taller full-body shots, eye-level for half-body, slight angle of body (not square to camera), weight on back leg, hands busy (pocket, sleeve, collar), chin slightly forward and down.`

const SceneSchema = z.object({
  lighting: z.string().describe('Where light comes from and whether it is good, in one line'),
  light_fix: z.string().describe('Exactly where the subject should stand/face relative to light'),
  background: z.string().describe('What works or distracts in the background'),
  spot_tip: z.string().describe('The best spot / direction in this scene'),
  camera_height: z.string().describe('For the photographer: phone height'),
  camera_distance: z.string().describe('For the photographer: distance and zoom'),
  framing: z.enum(['full', 'half', 'close']),
  recommended_pose_ids: z.array(z.string()).describe('IDs from the provided pose list, best first, max 3'),
  pose_direction: z.string().describe('Short direction for the subject for the top pose'),
  score_now: z.number().int().describe('How good this scene is for a photo right now, 1-10'),
  lesson: z.string().describe('One photography lesson from this scene'),
})

export async function analyzeScene({ frame, taste, poses }) {
  return askAI({
    system: PHOTO_RULES,
    schema: SceneSchema,
    content: [
      imageBlock(await shrinkDataUrl(frame, 1024)),
      {
        type: 'text',
        text: `Yeh camera abhi jo dekh raha hai woh hai. Is jagah pe best photo kaise aayegi?
Available poses (id: name): ${poses.map((p) => `${p.id}: ${p.name} (${p.framing})`).join('; ')}
${taste ? 'Meri pasand (taste profile): ' + JSON.stringify(taste) : ''}`,
      },
    ],
  })
}

// ---------- 6. Kheenchi hui photo ka review ----------
const ReviewSchema = z.object({
  score: z.number().int().describe('1-10, honest. 5 = average phone photo'),
  verdict: z.string().describe('One-line honest verdict in Hinglish'),
  what_works: z.array(z.string()),
  fix_next_time: z.array(z.string()).describe('Specific fixes for subject AND photographer'),
  edit_tips: z.array(z.string()).describe('Quick edits: crop, exposure, warmth etc.'),
  outfit_note: z.string().describe('How the outfit reads in the photo, if visible'),
  lesson: z.string(),
})

export async function reviewPhoto({ photo, taste }) {
  return askAI({
    system: PHOTO_RULES + '\nAlso judge outfit using: ' + STYLE_RULES.split('\n').slice(2, 8).join(' '),
    schema: ReviewSchema,
    content: [
      imageBlock(await shrinkDataUrl(photo, 1280)),
      {
        type: 'text',
        text: `Is photo ko honestly rate karo aur batao next time isse better kaise aayegi.${taste ? '\nMera taste profile: ' + JSON.stringify(taste) : ''}`,
      },
    ],
  })
}
