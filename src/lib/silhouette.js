// Pose ko "stick" ki jagah insaan jaisi body outline (silhouette) mein draw karna.
// Tarika: alag canvas pe pehle saare hisse mote border ke saath, phir andar ka hissa kaat ke halka bharte hain
// -> sirf poore body ka bahari border chamakta hai (hisso ke beech lines nahi dikhti).
import { skeletonFromAngles, fitSkeleton } from './poses'

// Har hisse ki motai, torso length ke hisaab se
const WIDTH = { upperArm: 0.2, forearm: 0.16, thigh: 0.3, shin: 0.22, neck: 0.17 }
const LIMBS = [
  ['LShoulder', 'LElbow', 'upperArm'], ['LElbow', 'LWrist', 'forearm'],
  ['RShoulder', 'RElbow', 'upperArm'], ['RElbow', 'RWrist', 'forearm'],
  ['LHip', 'LKnee', 'thigh'], ['LKnee', 'LAnkle', 'shin'],
  ['RHip', 'RKnee', 'thigh'], ['RKnee', 'RAnkle', 'shin'],
]

let off = null // reuse offscreen canvases (har frame naya banana slow hai)
let fill = null

function shapes(ctx, g, extra) {
  const s = g.scale
  const midS = { x: (g.LShoulder.x + g.RShoulder.x) / 2, y: (g.LShoulder.y + g.RShoulder.y) / 2 }
  // Limbs = gol kinaron wali moti lines
  for (const [a, b, part] of LIMBS) {
    ctx.lineWidth = WIDTH[part] * s + extra
    ctx.beginPath(); ctx.moveTo(g[a].x, g[a].y); ctx.lineTo(g[b].x, g[b].y); ctx.stroke()
  }
  ctx.lineWidth = WIDTH.neck * s + extra
  ctx.beginPath(); ctx.moveTo(midS.x, midS.y); ctx.lineTo(g.head.x, g.head.y); ctx.stroke()
  // Dhad (torso): kandhe thode bahar, kamar thodi patli. Side pose mein bhi kam se kam itna chauda.
  const widen = (p, q, by) => {
    const dx = p.x - q.x, dy = p.y - q.y, d = Math.hypot(dx, dy) || 1
    return { x: p.x + (dx / d) * by, y: p.y + (dy / d) * by }
  }
  const minHalf = 0.16 * s
  const sh = Math.hypot(g.LShoulder.x - g.RShoulder.x, g.LShoulder.y - g.RShoulder.y) / 2
  const pad = Math.max(0.07 * s, minHalf - sh)
  const LS = widen(g.LShoulder, g.RShoulder, pad), RS = widen(g.RShoulder, g.LShoulder, pad)
  const LH = widen(g.LHip, g.RHip, pad * 0.8), RH = widen(g.RHip, g.LHip, pad * 0.8)
  ctx.lineWidth = extra || 0.0001
  ctx.beginPath(); ctx.moveTo(LS.x, LS.y); ctx.lineTo(RS.x, RS.y); ctx.lineTo(RH.x, RH.y); ctx.lineTo(LH.x, LH.y); ctx.closePath()
  ctx.fill(); if (extra) ctx.stroke()
  // Sar
  ctx.beginPath(); ctx.ellipse(g.head.x, g.head.y - 0.03 * s, 0.15 * s + extra / 2, 0.19 * s + extra / 2, 0, 0, Math.PI * 2)
  ctx.fill()
}

// ctx pe pose ki silhouette draw karo. color = border ka rang (score ke hisaab se badal sakte ho)
export function drawFigure(ctx, W, H, pose, color = '#ffffff', alpha = 0.9) {
  const g = fitSkeleton(skeletonFromAngles(pose.angles), pose.framing, W, H)
  if (!off) off = document.createElement('canvas')
  if (off.width !== W || off.height !== H) { off.width = W; off.height = H }
  const o = off.getContext('2d')
  o.clearRect(0, 0, W, H)
  o.lineCap = 'round'; o.lineJoin = 'round'
  const border = Math.max(3, W / 110)
  // 1) moti outline
  o.globalCompositeOperation = 'source-over'
  o.strokeStyle = o.fillStyle = color
  shapes(o, g, border * 2)
  // 2) andar ka hissa kaat do (sirf border bache)
  o.globalCompositeOperation = 'destination-out'
  o.strokeStyle = o.fillStyle = '#000'
  shapes(o, g, 0)
  // 3) andar halka sa bharo. Pehle alag canvas pe POORA rang, phir halka karke chipkao
  //    (seedha halka rang bharte toh jahan haath body ke upar aata, wahan do baar bhar ke patch dikhta)
  if (!fill) fill = document.createElement('canvas')
  if (fill.width !== W || fill.height !== H) { fill.width = W; fill.height = H }
  const f = fill.getContext('2d')
  f.clearRect(0, 0, W, H)
  f.lineCap = 'round'; f.lineJoin = 'round'
  f.strokeStyle = f.fillStyle = '#fff'
  shapes(f, g, 0)
  o.globalCompositeOperation = 'source-over'
  o.globalAlpha = 0.16
  o.drawImage(fill, 0, 0)
  o.globalAlpha = 1
  // 4) Haathon ki apni outline: body ke saamne haath (arms crossed, watch check) warna dikhte hi nahi
  for (const [a, b, part] of LIMBS.slice(0, 4)) {
    const w = WIDTH[part] * g.scale
    o.globalCompositeOperation = 'source-over'
    o.strokeStyle = color
    o.lineWidth = w + border * 1.4
    o.beginPath(); o.moveTo(g[a].x, g[a].y); o.lineTo(g[b].x, g[b].y); o.stroke()
    o.globalCompositeOperation = 'destination-out'
    o.lineWidth = w
    o.beginPath(); o.moveTo(g[a].x, g[a].y); o.lineTo(g[b].x, g[b].y); o.stroke()
  }
  o.globalCompositeOperation = 'source-over'
  o.strokeStyle = 'rgba(255,255,255,0.16)'
  for (const [a, b, part] of LIMBS.slice(0, 4)) {
    o.lineWidth = WIDTH[part] * g.scale
    o.beginPath(); o.moveTo(g[a].x, g[a].y); o.lineTo(g[b].x, g[b].y); o.stroke()
  }
  ctx.save(); ctx.globalAlpha = alpha; ctx.drawImage(off, 0, 0); ctx.restore()
}

// Asli photo wala pose: POORI photo halki (kam opacity) karke camera ke upar.
// "contain" fit: photo kati nahi jaati, toh photo mein banda jahan khada hai wahi framing tum bhi copy kar sakte ho.
export function drawPhotoGhost(ctx, W, H, img, alpha = 0.4) {
  const s = Math.min(W / img.naturalWidth, H / img.naturalHeight)
  const w = img.naturalWidth * s, h = img.naturalHeight * s
  ctx.save(); ctx.globalAlpha = alpha
  ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h)
  ctx.restore()
}

// Pose picker ke chhote thumbnails (ek baar banake cache)
const thumbs = {}
export function poseThumb(pose, w = 72, h = 96) {
  if (thumbs[pose.id]) return thumbs[pose.id]
  const c = document.createElement('canvas')
  c.width = w * 2; c.height = h * 2 // retina ke liye 2x
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#24262b'; ctx.fillRect(0, 0, c.width, c.height)
  drawFigure(ctx, c.width, c.height, pose, '#e8c27a', 1)
  off = null; fill = null // thumbnail size ka canvas camera ke liye reuse na ho
  return (thumbs[pose.id] = c.toDataURL('image/png'))
}
