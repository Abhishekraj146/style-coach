// Pose ki "geometry". Har pose = body ke har hisse ka angle (degree mein).
// Angle screen ke hisaab se: 0 = right, 90 = neeche, 180 = left, -90 = upar.
// "L" = screen pe LEFT dikhne wala haath/pair, "R" = screen pe RIGHT wala.
// (Isse photographer ko confusion nahi hota ki "tumhara left ya mera left".)

// MediaPipe landmark numbers
const NOSE = 0
const SH = [11, 12], EL = [13, 14], WR = [15, 16], HIP = [23, 24], KN = [25, 26], AN = [27, 28]

// Body ke hisso ki lambai, torso (kandhe se kamar) = 1 maan ke
const LEN = { upperArm: 0.6, forearm: 0.55, thigh: 0.85, shin: 0.8, head: 0.38 }

export const PRESET_POSES = [
  {
    id: 'p-classic',
    name: 'Classic confident stand',
    framing: 'full',
    tip: 'Ek haath pocket mein (sirf ungliyan), wajan peeche wale pair pe, body camera se 20-30° ghumi hui, chin thoda aage-neeche.',
    angles: { torso: -90, sw: 0.6, LupperArm: 100, Lforearm: 60, RupperArm: 84, Rforearm: 92, Lthigh: 93, Lshin: 91, Rthigh: 80, Rshin: 97 },
  },
  {
    id: 'p-pockets',
    name: 'Dono haath pocket',
    framing: 'full',
    tip: 'Dono thumbs bahar ya dono haath halke se pocket mein. Kandhe relaxed, ek ghutna thoda mudha hua.',
    angles: { torso: -90, sw: 0.75, LupperArm: 102, Lforearm: 62, RupperArm: 78, Rforearm: 118, Lthigh: 94, Lshin: 90, Rthigh: 84, Rshin: 96 },
  },
  {
    id: 'p-walk',
    name: 'Walking shot',
    framing: 'full',
    tip: 'Camera ki taraf dheere chalo, camera ko mat dekho. Photographer burst mode mein 10 photo le, beech wali best hogi.',
    angles: { torso: -88, sw: 0.7, LupperArm: 96, Lforearm: 80, RupperArm: 80, Rforearm: 100, Lthigh: 106, Lshin: 98, Rthigh: 74, Rshin: 96 },
  },
  {
    id: 'p-lean',
    name: 'Wall lean, legs crossed',
    framing: 'full',
    tip: 'Kandha deewar se tikao, aage wala pair peeche wale ke upar cross. Haath pocket mein ya arms cross.',
    angles: { torso: -97, sw: 0.55, LupperArm: 100, Lforearm: 65, RupperArm: 82, Rforearm: 110, Lthigh: 86, Lshin: 78, Rthigh: 96, Rshin: 102 },
  },
  {
    id: 'p-collar',
    name: 'Collar / jacket adjust',
    framing: 'half',
    tip: 'Ek haath se collar ya jacket ka lapel pakdo, nazar side mein ya neeche. Natural "candid" feel aata hai.',
    angles: { torso: -90, sw: 0.65, LupperArm: 95, Lforearm: 88, RupperArm: 100, Rforearm: -100, Lthigh: 92, Lshin: 90, Rthigh: 88, Rshin: 90 },
  },
  {
    id: 'p-watch',
    name: 'Watch / cuff check',
    framing: 'half',
    tip: 'Ek haath se doosre haath ki cuff ya watch adjust karo, nazar neeche haath pe. Premium editorial look.',
    angles: { torso: -90, sw: 0.7, LupperArm: 90, Lforearm: -30, RupperArm: 95, Rforearm: -125, Lthigh: 92, Lshin: 90, Rthigh: 88, Rshin: 90 },
  },
]

export const FRAMING_TIPS = {
  full: 'Photographer: phone kamar (waist) ki height pe, halka sa upar tilt. 3-4 kadam door, 2x zoom. Isse legs lambi aur body proportion sahi aata hai.',
  half: 'Photographer: phone chest/aankh ki height pe, seedha. 2-3 kadam door, 2x zoom (paas aake wide lens se face mota dikhta hai).',
  close: 'Photographer: aankh ki height pe ya thoda upar. 2x-3x zoom, background blur ke liye portrait mode.',
}

const rad = (d) => (d * Math.PI) / 180
const deg = (r) => (r * 180) / Math.PI
const dir = (a) => ({ x: Math.cos(rad(a)), y: Math.sin(rad(a)) })
const add = (p, a, len) => ({ x: p.x + dir(a).x * len, y: p.y + dir(a).y * len })
const angleOf = (p, q) => deg(Math.atan2(q.y - p.y, q.x - p.x))
const angleDiff = (a, b) => Math.abs(((a - b + 540) % 360) - 180)

// Angles -> skeleton points (unit space). Phir isko screen pe fit karte hain.
export function skeletonFromAngles(A) {
  const hip = { x: 0, y: 0 }
  const shoulder = add(hip, A.torso, 1)
  const perp = A.torso + 90 // torso ke perpendicular (left-right)
  const half = A.sw / 2
  const pts = {
    LShoulder: add(shoulder, perp, half),
    RShoulder: add(shoulder, perp, -half),
    LHip: add(hip, perp, half * 0.75),
    RHip: add(hip, perp, -half * 0.75),
    head: add(shoulder, A.torso, LEN.head),
  }
  // perp = torso+90 = 0° jab torso -90 ho, yaani "right". L side ke liye ulta chahiye:
  ;[pts.LShoulder, pts.RShoulder] = [pts.RShoulder, pts.LShoulder]
  ;[pts.LHip, pts.RHip] = [pts.RHip, pts.LHip]
  pts.LElbow = add(pts.LShoulder, A.LupperArm, LEN.upperArm)
  pts.LWrist = add(pts.LElbow, A.Lforearm, LEN.forearm)
  pts.RElbow = add(pts.RShoulder, A.RupperArm, LEN.upperArm)
  pts.RWrist = add(pts.RElbow, A.Rforearm, LEN.forearm)
  pts.LKnee = add(pts.LHip, A.Lthigh, LEN.thigh)
  pts.LAnkle = add(pts.LKnee, A.Lshin, LEN.shin)
  pts.RKnee = add(pts.RHip, A.Rthigh, LEN.thigh)
  pts.RAnkle = add(pts.RKnee, A.Rshin, LEN.shin)
  return pts
}

export const BONES = [
  ['LShoulder', 'RShoulder'], ['LHip', 'RHip'], ['LShoulder', 'LHip'], ['RShoulder', 'RHip'],
  ['LShoulder', 'LElbow'], ['LElbow', 'LWrist'], ['RShoulder', 'RElbow'], ['RElbow', 'RWrist'],
  ['LHip', 'LKnee'], ['LKnee', 'LAnkle'], ['RHip', 'RKnee'], ['RKnee', 'RAnkle'],
]

// Unit skeleton ko screen (W x H pixels) pe framing ke hisaab se fit karo
export function fitSkeleton(pts, framing, W, H) {
  const keys = framing === 'full' ? Object.keys(pts) : Object.keys(pts).filter((k) => !/Knee|Ankle/.test(k))
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const k of keys) {
    minX = Math.min(minX, pts[k].x); maxX = Math.max(maxX, pts[k].x)
    minY = Math.min(minY, pts[k].y); maxY = Math.max(maxY, pts[k].y)
  }
  minY -= 0.2 // sir ka upar wala hissa
  const target = framing === 'full' ? { top: 0.1, bottom: 0.9 } : { top: 0.14, bottom: 0.97 }
  const scale = ((target.bottom - target.top) * H) / (maxY - minY)
  const cx = (minX + maxX) / 2
  const out = {}
  for (const k of Object.keys(pts)) {
    out[k] = { x: W / 2 + (pts[k].x - cx) * scale, y: target.top * H + (pts[k].y - minY) * scale }
  }
  out.headRadius = 0.2 * scale
  return out
}

// ---------- Live landmarks -> named points (display pixels) ----------
// mirror = front camera (screen pe ulta dikhta hai)
export function namedPoints(landmarks, W, H, mirror) {
  const P = (i) => ({ x: (mirror ? 1 - landmarks[i].x : landmarks[i].x) * W, y: landmarks[i].y * H, v: landmarks[i].visibility ?? 1 })
  // Jo kandha screen pe left mein hai, wahi "L" chain hai
  const a = P(SH[0]), b = P(SH[1])
  const s = a.x < b.x ? 0 : 1 // index of screen-left chain
  const o = 1 - s
  return {
    head: P(NOSE),
    LShoulder: P(SH[s]), RShoulder: P(SH[o]),
    LElbow: P(EL[s]), RElbow: P(EL[o]),
    LWrist: P(WR[s]), RWrist: P(WR[o]),
    LHip: P(HIP[s]), RHip: P(HIP[o]),
    LKnee: P(KN[s]), RKnee: P(KN[o]),
    LAnkle: P(AN[s]), RAnkle: P(AN[o]),
  }
}

const mid = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 })

// Kis segment ka angle kin do points se banta hai
const SEGMENTS = {
  LupperArm: ['LShoulder', 'LElbow', 'Screen-left wali kohni'],
  Lforearm: ['LElbow', 'LWrist', 'Screen-left wala haath'],
  RupperArm: ['RShoulder', 'RElbow', 'Screen-right wali kohni'],
  Rforearm: ['RElbow', 'RWrist', 'Screen-right wala haath'],
  Lthigh: ['LHip', 'LKnee', 'Screen-left wala ghutna'],
  Lshin: ['LKnee', 'LAnkle', 'Screen-left wala pair'],
  Rthigh: ['RHip', 'RKnee', 'Screen-right wala ghutna'],
  Rshin: ['RKnee', 'RAnkle', 'Screen-right wala pair'],
}

export function anglesFromPoints(p) {
  const hip = mid(p.LHip, p.RHip)
  const sh = mid(p.LShoulder, p.RShoulder)
  const torsoLen = Math.hypot(sh.x - hip.x, sh.y - hip.y) || 1
  const A = { torso: angleOf(hip, sh), sw: Math.hypot(p.LShoulder.x - p.RShoulder.x, p.LShoulder.y - p.RShoulder.y) / torsoLen }
  for (const [k, [from, to]] of Object.entries(SEGMENTS)) A[k] = angleOf(p[from], p[to])
  return A
}

// Live pose vs target pose: score (0-100) + sabse badi galti ka hint
export function comparePose(live, target, framing) {
  const A = anglesFromPoints(live)
  const T = target
  let total = 0, weight = 0, worst = null
  const segs = Object.entries(SEGMENTS).filter(([k]) => framing === 'full' || !/thigh|shin/.test(k))
  for (const [k, [from, to, label]] of segs) {
    if (live[from].v < 0.5 || live[to].v < 0.5) continue // jo hissa dikh nahi raha, usko skip
    const d = angleDiff(A[k], T[k])
    // 30° ka farak = us hisse ka 0 score. (60° pe galat poses bhi 80%+ le jaate the)
    total += Math.max(0, 1 - d / 30)
    weight += 1
    if (d > 12 && (!worst || d > worst.d)) worst = { k, d, from, to, label }
  }
  const torsoD = angleDiff(A.torso, T.torso)
  total += Math.max(0, 1 - torsoD / 20)
  weight += 1

  const score = weight ? Math.round((total / weight) * 100) : 0
  let hint = null
  if (worst) {
    // Target angle se joint kahan hona chahiye tha, vs abhi kahan hai
    const len = Math.hypot(live[worst.to].x - live[worst.from].x, live[worst.to].y - live[worst.from].y)
    const want = add(live[worst.from], T[worst.k], len)
    const dx = want.x - live[worst.to].x
    const dy = want.y - live[worst.to].y
    const where = Math.abs(dy) > Math.abs(dx) ? (dy < 0 ? 'thoda upar karo' : 'thoda neeche karo') : dx < 0 ? 'screen ke left ki taraf le jao' : 'screen ke right ki taraf le jao'
    hint = `${worst.label} ${where}`
  } else if (torsoD > 10) {
    hint = T.torso < A.torso ? 'Body thodi screen-left ki taraf jhukao' : 'Body thodi screen-right ki taraf jhukao'
  } else if (T.sw < 0.65 && A.sw > 0.8) {
    hint = 'Body camera se 20-30° side mein ghumao (chehra camera ki taraf rakho)'
  } else if (T.sw > 0.7 && A.sw < 0.55) {
    hint = 'Camera ki taraf thoda aur seedhe ghumo'
  }
  return { score, hint }
}

// Photographer ke liye: frame mein banda sahi jagah hai ya nahi
export function framingHints(p, framing, W, H) {
  const hints = []
  const top = (p.head.y - 0.09 * H) / H // naak se thoda upar = sir ka top (approx)
  const anklesSeen = p.LAnkle.v > 0.5 && p.RAnkle.v > 0.5 && Math.max(p.LAnkle.y, p.RAnkle.y) < H * 0.98
  const bottom = (framing === 'full' ? Math.max(p.LAnkle.y, p.RAnkle.y) : Math.max(p.LHip.y, p.RHip.y)) / H
  const height = bottom - top
  const cx = (p.LShoulder.x + p.RShoulder.x + p.LHip.x + p.RHip.x) / 4 / W

  if (top < 0.02) hints.push('📷 Sir kat raha hai: phone thoda upar tilt karo ya peeche jao')
  if (framing === 'full') {
    if (!anklesSeen) hints.push('📷 Pair kat rahe hain: 2 kadam peeche jao ya phone neeche (waist height) karo')
    else if (height < 0.6) hints.push('📷 Bahut door ho: paas aao ya zoom karo')
    else if (height > 0.9) hints.push('📷 Thoda peeche jao: upar-neeche thodi jagah chhodo')
  } else {
    if (height < 0.55) hints.push('📷 Half-body shot hai: paas aao ya 2x zoom karo')
  }
  if (Math.abs(cx - 0.5) > 0.1) hints.push(cx < 0.5 ? '📷 Phone thoda left ghumao (banda center mein aaye)' : '📷 Phone thoda right ghumao (banda center mein aaye)')
  return hints
}

// Pasand ki photo se custom pose banao
export function poseFromLandmarks(landmarks, imgW, imgH) {
  const p = namedPoints(landmarks, imgW, imgH, false)
  const anklesSeen = p.LAnkle.v > 0.5 && p.RAnkle.v > 0.5
  return { angles: anglesFromPoints(p), framing: anklesSeen ? 'full' : 'half' }
}
