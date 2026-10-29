// Claude = app ka "dimaag": kapdo ko pehchanna, combos banana, photo/scene analyze karna.
// Har function ek photo/text bhejta hai aur ek fixed JSON shape (zod schema) mein jawab leta hai,
// taaki UI ko pata ho ki kaunsa field kahan milega.
import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { z } from 'zod'
import { loadSettings } from './db'
import { shrinkDataUrl, splitDataUrl } from './image'

async function getClient() {
  const s = await loadSettings()
  if (!s.claudeKey) throw new Error('Claude API key nahi daali. Profile → Settings mein daalo.')
  // dangerouslyAllowBrowser: key browser se seedha jaati hai. Personal app ke liye theek hai
  // (key sirf tumhare phone mein save hai), par yeh app public mat karna.
  return {
    client: new Anthropic({ apiKey: s.claudeKey, dangerouslyAllowBrowser: true }),
    model: s.claudeModel,
  }
}

const imageBlock = (dataUrl) => {
  const { mediaType, data } = splitDataUrl(dataUrl)
  return { type: 'image', source: { type: 'base64', media_type: mediaType, data } }
}

// Saare Claude calls isi se jaate hain.
async function askClaude({ system, content, schema, effort = 'medium' }) {
  const { client, model } = await getClient()
  let res
  try {
    res = await client.beta.messages.parse({
      model,
      max_tokens: 16000,
      system,
      messages: [{ role: 'user', content }],
      output_config: { format: betaZodOutputFormat(schema), effort },
      // Agar safety filter galti se mana kare, toh server khud doosre model pe try karta hai.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    })
  } catch (err) {
    throw new Error(friendlyError(err))
  }
  if (res.stop_reason === 'refusal') throw new Error('AI ne yeh request mana kar di. Doosri photo try karo.')
  if (res.stop_reason === 'max_tokens') throw new Error('Jawab beech mein kat gaya. Dobara try karo.')
  if (!res.parsed_output) throw new Error('AI ka jawab samajh nahi aaya. Dobara try karo.')
  return res.parsed_output
}

function friendlyError(err) {
  if (err instanceof Anthropic.AuthenticationError) return 'Claude API key galat hai. Settings check karo.'
  if (err instanceof Anthropic.PermissionDeniedError) return 'Is key ko is model ki permission nahi hai.'
  if (err instanceof Anthropic.RateLimitError) return 'Bahut zyada requests. 1 minute ruk ke try karo.'
  if (err instanceof Anthropic.BadRequestError) return 'Request galat bani: ' + err.message
  if (err instanceof Anthropic.APIConnectionError) return 'Internet / connection problem. Network check karo.'
  if (err instanceof Anthropic.APIError) return `Claude error ${err.status}: ${err.message}`
  return err.message || String(err)
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
  return askClaude({
    system: STYLE_RULES,
    effort: 'low',
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
  return askClaude({ system: STYLE_RULES, schema: ProfileSchema, effort: 'high', content })
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
  const result = await askClaude({
    system: STYLE_RULES,
    schema: OutfitsSchema,
    effort: 'high',
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
  return askClaude({ system: PHOTO_RULES, schema: TasteSchema, effort: 'high', content })
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
  return askClaude({
    system: PHOTO_RULES,
    schema: SceneSchema,
    effort: 'medium',
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
  return askClaude({
    system: PHOTO_RULES + '\nAlso judge outfit using: ' + STYLE_RULES.split('\n').slice(2, 8).join(' '),
    schema: ReviewSchema,
    effort: 'medium',
    content: [
      imageBlock(await shrinkDataUrl(photo, 1280)),
      {
        type: 'text',
        text: `Is photo ko honestly rate karo aur batao next time isse better kaise aayegi.${taste ? '\nMera taste profile: ' + JSON.stringify(taste) : ''}`,
      },
    ],
  })
}
