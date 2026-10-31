// MediaPipe Pose: phone ke andar hi (bina internet ke AI call) body ke 33 points dhoondta hai.
// Yahi live camera mein tumhara skeleton track karta hai.
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision'

const WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.0/wasm'
const MODEL = {
  lite: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task',
  full: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task',
}

let filesetPromise = null
const cache = {}

// Ek hi baar load karo, baad mein wahi object reuse karo (load hone mein 2-5 sec lagte hain).
function getLandmarker(mode) {
  if (!cache[mode]) {
    filesetPromise ||= FilesetResolver.forVisionTasks(WASM)
    cache[mode] = filesetPromise.then((fileset) =>
      PoseLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: mode === 'VIDEO' ? MODEL.lite : MODEL.full, delegate: 'GPU' },
        runningMode: mode,
        numPoses: 1,
        outputSegmentationMasks: mode === 'IMAGE', // photo mein insaan ka shape (outline overlay ke liye)
      }),
    )
  }
  return cache[mode]
}

export const getVideoLandmarker = () => getLandmarker('VIDEO')

// Ek photo se landmarks (pasand ki photos ka pose nikalne ke liye)
export async function detectPoseInImage(imgEl) {
  return (await detectPoseAndOutline(imgEl)).landmarks
}

// Photo -> body points + us insaan ki outline (PNG). Outline camera pe overlay hoti hai taaki tum
// photo wale pose ko seedha "match" kar sako.
export async function detectPoseAndOutline(imgEl) {
  const lm = await getLandmarker('IMAGE')
  const res = lm.detect(imgEl)
  const landmarks = res.landmarks?.[0] || null
  const mask = res.segmentationMasks?.[0]
  let outline = null
  if (mask) {
    try {
      outline = maskToOutline(mask.getAsFloat32Array(), mask.width, mask.height)
    } finally {
      mask.close() // GPU memory free karo
    }
  }
  return { landmarks, outline }
}

// Mask (har pixel: insaan hai ya nahi) -> safed border + halka andar wala PNG, insaan ke aas-paas crop
function maskToOutline(m, w, h) {
  const on = (x, y) => x >= 0 && y >= 0 && x < w && y < h && m[y * w + x] > 0.5
  let x0 = w, y0 = h, x1 = -1, y1 = -1
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (m[y * w + x] > 0.5) {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y
  }
  if (x1 < 0) return null // koi insaan nahi mila
  const pad = 4
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(w - 1, x1 + pad); y1 = Math.min(h - 1, y1 + pad)
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1
  const c = document.createElement('canvas')
  c.width = cw; c.height = ch
  const ctx = c.getContext('2d')
  const img = ctx.createImageData(cw, ch)
  const t = Math.max(1, Math.round(Math.max(cw, ch) / 160)) // border ki motai
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    const X = x + x0, Y = y + y0
    if (!on(X, Y)) continue
    // border = andar wala pixel jiske paas (t pixel tak) koi bahar wala pixel ho
    const edge = !on(X - t, Y) || !on(X + t, Y) || !on(X, Y - t) || !on(X, Y + t)
    const i = (y * cw + x) * 4
    img.data[i] = img.data[i + 1] = img.data[i + 2] = 255
    img.data[i + 3] = edge ? 255 : 45
  }
  ctx.putImageData(img, 0, 0)
  // Storage bachane ke liye max 480px height
  const k = Math.min(1, 480 / ch)
  const out = document.createElement('canvas')
  out.width = Math.round(cw * k); out.height = Math.round(ch * k)
  out.getContext('2d').drawImage(c, 0, 0, out.width, out.height)
  return { src: out.toDataURL('image/png'), w: out.width, h: out.height }
}
