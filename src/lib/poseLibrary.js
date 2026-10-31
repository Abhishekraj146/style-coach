// 50 original poses (koi copyrighted photo nahi). Har pose = haath + pair ke "building blocks" + body ka angle.
// Angle screen ke hisaab se: 0 = right, 90 = neeche, 180 = left, -90 = upar.
// L = screen pe LEFT wala haath/pair, R = screen pe RIGHT wala (front camera mein bhi screen jaisa dikhe waisa).
// k = kisi hisse ki lambai ka multiplier: haath camera ki taraf aaye toh photo mein chhota dikhta hai (0.6 = 60%).

// Ek side (L) ka haath. R side ke liye mirror() use hota hai.
const ARM = {
  hang: [97, 93],            // seedha neeche, relaxed
  pocket: [102, 62],         // haath pocket mein
  thumb: [100, 76],          // thumbs pocket mein
  hip: [130, 48],            // kamar pe haath
  cross: [84, -18, 0.7],     // haath baandhe (chest pe); 3rd/4th number = lambai multiplier
  collar: [80, -80],         // collar / lapel pakadna (haath andar gale ki taraf)
  hair: [-125, -25],         // haath baalon mein
  behind: [-140, -5],        // haath sar ke peeche
  wave: [-160, -95],         // hi / wave
  clasp: [85, 60],           // dono haath aage jode
  peace: [95, -75, 0.5],     // chehre ke paas (peace / point); kohni camera ki taraf -> upper arm chhota
  chest: [85, -55],          // haath chest pe
  chin: [80, -66, 0.6, 1.08], // ungli chin pe
  phone: [150, 168],         // selfie: phone wala haath frame se bahar
  rail: [70, 5, 0.75],       // railing pe forearm
  knee: [95, 70],            // baithe hue, haath ghutne pe
  back: [125, 105],          // baithe hue, haath peeche tikaye
}
const mirror = ([u, f, ku, kf]) => [norm(180 - u), norm(180 - f), ku, kf]
const norm = (a) => ((a + 540) % 360) - 180

// Pair: [Lthigh, Lshin, Rthigh, Rshin]
const LEG = {
  straight: [93, 91, 87, 89],
  relax: [93, 91, 80, 97],     // ek ghutna halka mudha (contrapposto)
  wide: [104, 94, 76, 86],
  cross: [86, 78, 96, 102],    // pair cross
  walk: [106, 98, 74, 96],
  stride: [112, 100, 66, 92],  // lamba kadam
  wallFoot: [93, 91, 72, 118], // ek pair deewar pe
  forward: [92, 92, 84, 102],  // ek pair aage, ghutna mudha
  crouch: [140, 85, 40, 95],   // street crouch
  sitSide: [178, 95, 172, 100],    // side se baithe (thigh horizontal)
  sitExtend: [178, 95, 175, 165],  // ek pair aage seedha
  sitLean: [175, 92, 170, 96],
}

// pose(id, naam, category, framing, camera, tip, torso, sw, L arm, R arm, legs, k)
function pose(id, name, cat, framing, camera, tip, torso, sw, l, r, legs = 'straight', extraK = {}) {
  const [LupperArm, Lforearm, kLu = 1, kLf = 1] = typeof l === 'string' ? ARM[l] : l
  const [RupperArm, Rforearm, kRu = 1, kRf = 1] = typeof r === 'string' ? mirror(ARM[r]) : r
  const [Lthigh, Lshin, Rthigh, Rshin] = typeof legs === 'string' ? LEG[legs] : legs
  const k = { LupperArm: kLu, Lforearm: kLf, RupperArm: kRu, Rforearm: kRf, ...extraK }
  return { id, name, cat, framing, camera, tip, angles: { torso, sw, LupperArm, Lforearm, RupperArm, Rforearm, Lthigh, Lshin, Rthigh, Rshin, k } }
}

export const CATEGORIES = [
  { id: 'stand', label: 'Standing' },
  { id: 'street', label: 'Walk / Street' },
  { id: 'sit', label: 'Baithe hue' },
  { id: 'half', label: 'Half body' },
  { id: 'selfie', label: 'Selfie (front)' },
]

const ANY = 'any', FRONT = 'front'

export const POSE_LIBRARY = [
  // ---------- Standing (full body) ----------
  pose('p-classic', 'Classic confident', 'stand', 'full', ANY, 'Ek haath pocket mein (sirf ungliyan), wajan peeche wale pair pe, body camera se 20-30° ghumi hui, chin thoda aage-neeche.', -90, 0.6, 'pocket', 'hang', 'relax'),
  pose('p-pockets', 'Dono haath pocket', 'stand', 'full', ANY, 'Dono haath halke se pocket mein, kandhe relaxed, ek ghutna thoda mudha.', -90, 0.75, 'pocket', 'pocket', [94, 90, 84, 96]),
  pose('p-lean', 'Wall lean, legs crossed', 'stand', 'full', ANY, 'Kandha deewar se tikao, aage wala pair peeche wale ke upar cross. Haath pocket mein.', -97, 0.55, 'pocket', 'pocket', 'cross'),
  pose('s-cross', 'Arms crossed', 'stand', 'full', ANY, 'Haath chest pe baandho (tight nahi), kandhe neeche, halki smile. Confident "boss" look.', -90, 0.7, 'cross', 'cross', 'wide'),
  pose('s-hips', 'Dono haath kamar pe', 'stand', 'full', ANY, 'Dono haath kamar pe, kohni bahar. Chest open, pair kandhe jitne khule.', -90, 0.78, 'hip', 'hip', 'wide'),
  pose('s-onehip', 'Ek haath kamar pe', 'stand', 'full', ANY, 'Ek haath kamar pe, doosra relaxed. Body thodi ghumi hui, wajan ek pair pe.', -91, 0.6, 'hip', 'hang', 'relax'),
  pose('s-thumbs', 'Thumbs in pockets', 'stand', 'full', ANY, 'Sirf angoothe pocket mein, baaki ungliyan bahar. Pair thode khule. Casual + cool.', -90, 0.75, 'thumb', 'thumb', 'wide'),
  pose('s-profile', 'Side profile', 'stand', 'full', ANY, 'Camera ki taraf side se khade ho, sirf chehra halka camera ki taraf. Haath pocket mein. Jawline achhi dikhti hai.', -90, 0.32, 'pocket', 'hang', 'relax'),
  pose('s-shoulder', 'Over the shoulder look', 'stand', 'full', ANY, 'Peeth thodi camera ki taraf, sar ghuma ke kandhe ke upar se camera dekho.', -90, 0.45, 'hang', 'hang', 'relax'),
  pose('s-hair', 'Haath baalon mein', 'stand', 'full', ANY, 'Ek haath se baal peeche karo, nazar side ya neeche. Candid moment jaisa.', -92, 0.6, 'hair', 'pocket', 'relax'),
  pose('s-jacket', 'Jacket adjust (full)', 'stand', 'full', ANY, 'Dono haath se jacket ke lapel pakdo, jaise pehen ke theek kar rahe ho. Nazar neeche.', -90, 0.7, 'collar', 'collar', 'straight'),
  pose('s-watch', 'Watch check (full)', 'stand', 'full', ANY, 'Ek haath ki kalai upar, doosre haath se watch/cuff adjust. Nazar haath pe.', -90, 0.65, [90, -30], [95, -125], 'relax'),
  pose('s-clasp', 'Haath aage jode (formal)', 'stand', 'full', ANY, 'Dono haath aage halke se jode, kandhe seedhe. Kurta / suit / wedding look ke liye best.', -90, 0.75, 'clasp', 'clasp', 'straight'),
  pose('s-wallfoot', 'Wall + ek pair upar', 'stand', 'full', ANY, 'Peeth deewar pe, ek pair ka talwa deewar pe. Haath pocket mein, sar halka side.', -90, 0.65, 'pocket', 'hang', 'wallFoot'),
  pose('s-armscrossstreet', 'Street stance (3/4)', 'stand', 'full', ANY, 'Body camera se 30° ghumao, haath baandhe, chin thodi upar. Streetwear / sneakers ke liye.', -88, 0.48, 'cross', 'cross', 'relax'),
  pose('s-relaxed', 'Relaxed natural', 'stand', 'full', ANY, 'Bilkul relaxed khade raho, ek ghutna halka mudha, haath dheele. Gehri saans lo, kandhe neeche.', -90, 0.65, 'hang', 'hang', 'relax'),
  pose('s-behind', 'Haath sar ke peeche', 'stand', 'full', ANY, 'Ek haath sar ke peeche, doosra pocket mein. Chill vacation vibe.', -92, 0.65, 'behind', 'pocket', 'relax'),
  pose('s-wave', 'Hi / wave', 'stand', 'full', ANY, 'Ek haath upar karke hi bolo, asli smile. Travel photos ke liye.', -90, 0.72, 'wave', 'hang', 'relax'),
  pose('s-mirror', 'Mirror selfie', 'stand', 'full', ANY, 'Sheeshe ke saamne, phone chest ki height pe, chehra phone ke peeche na chhupe. Body thodi ghumi.', -90, 0.6, 'hang', [100, -150], 'relax'),
  pose('s-lookdown', 'Neeche dekhte hue', 'stand', 'full', ANY, 'Haath pocket mein, nazar neeche zameen pe, jaise kuch soch rahe ho. Moody shot.', -91, 0.6, 'pocket', 'pocket', 'relax'),

  // ---------- Walk / Street ----------
  pose('p-walk', 'Walking shot', 'street', 'full', ANY, 'Camera ki taraf dheere chalo, camera ko mat dekho. Photographer burst mode mein 10 photo le.', -88, 0.7, [96, 80], [80, 100], 'walk'),
  pose('w-cuff', 'Walk + cuff adjust', 'street', 'full', ANY, 'Chalte hue ek haath se doosre haath ki cuff theek karo. Nazar neeche.', -88, 0.65, [90, -30], [95, -125], 'walk'),
  pose('w-stride', 'Lamba kadam', 'street', 'full', ANY, 'Bada kadam lo jaise sadak cross kar rahe ho. Haath natural swing. Legs lambi dikhti hain.', -87, 0.68, [100, 95], [78, 85], 'stride'),
  pose('w-pocketwalk', 'Pocket walk', 'street', 'full', ANY, 'Ek haath pocket mein, chalte hue side mein dekho. Street style classic.', -88, 0.62, 'pocket', [82, 95], 'walk'),
  pose('w-step', 'Ek pair aage', 'street', 'full', ANY, 'Ek pair aage rakh ke ghutna halka mod lo, jaise seedhi chadh rahe ho. Haath pocket.', -90, 0.65, 'pocket', 'hang', 'forward'),
  pose('w-crouch', 'Street crouch', 'street', 'full', ANY, 'Pairon pe neeche baitho (squat), kohni ghutno pe. Sneakers ke shots ke liye.', -85, 0.75, [110, 60], [70, 120], 'crouch', { LupperArm: 0.8, RupperArm: 0.8 }),
  pose('w-lookback', 'Mud ke dekhna', 'street', 'full', ANY, 'Aage chalte hue mud ke peeche camera ki taraf dekho. Natural candid.', -88, 0.4, 'hang', 'hang', 'walk'),

  // ---------- Baithe hue ----------
  pose('t-side', 'Side se baithe', 'sit', 'full', ANY, 'Seedhi ya bench pe side se baitho, haath ghutno pe. Peeth seedhi.', -85, 0.4, 'knee', 'knee', 'sitSide'),
  pose('t-lean', 'Aage jhuk ke baithe', 'sit', 'full', ANY, 'Baith ke aage jhuko, kohni ghutno pe, haath jode. Camera ki taraf dekho.', -70, 0.45, [80, 10], [100, 170], 'sitLean', { LupperArm: 0.8, RupperArm: 0.8 }),
  pose('t-extend', 'Ek pair aage', 'sit', 'full', ANY, 'Baitho, ek pair seedha aage, doosra muda hua. Ek haath peeche tikao.', -85, 0.45, 'back', 'knee', 'sitExtend'),
  pose('t-relax', 'Relaxed baithe', 'sit', 'full', ANY, 'Dono haath peeche tika ke relaxed baitho, sar halka upar. Chill vibe.', -95, 0.45, 'back', 'back', 'sitSide'),

  // ---------- Half body ----------
  pose('p-collar', 'Collar / jacket adjust', 'half', 'half', ANY, 'Ek haath se collar ya lapel pakdo, nazar side ya neeche. Candid feel.', -90, 0.65, [95, 88], 'collar'),
  pose('p-watch', 'Watch / cuff check', 'half', 'half', ANY, 'Ek haath se doosre haath ki cuff/watch adjust, nazar haath pe. Editorial look.', -90, 0.7, [90, -30], [95, -125]),
  pose('h-chin', 'Chin rest (thinker)', 'half', 'half', ANY, 'Ek haath ki ungli chin pe, doosra haath us kohni ke neeche. Smart / intellectual look.', -90, 0.7, 'chin', 'cross'),
  pose('h-cross', 'Arms crossed (half)', 'half', 'half', ANY, 'Haath baandho, kandhe relaxed, halki smile. Profile pic ke liye best.', -90, 0.72, 'cross', 'cross'),
  pose('h-hair', 'Baalon mein haath (half)', 'half', 'half', ANY, 'Ek haath baalon mein, nazar camera se thodi upar. Chehra thoda ghumao.', -92, 0.6, 'hair', 'hang'),
  pose('h-shoulder', 'Kandhe ke upar se', 'half', 'half', ANY, 'Peeth camera ki taraf, sirf chehra ghuma ke kandhe ke upar se dekho.', -90, 0.42, 'hang', 'hang'),
  pose('h-lapels', 'Dono lapel pakde', 'half', 'half', ANY, 'Dono haath se jacket/shirt ke lapel pakdo. Blazer look ke liye killer.', -90, 0.72, 'collar', 'collar'),
  pose('h-pockets', 'Pocket (half crop)', 'half', 'half', ANY, 'Dono haath pocket, kandhe thode aage. Kamar se upar ka crop.', -90, 0.72, 'pocket', 'pocket'),
  pose('h-rail', 'Railing pe tike', 'half', 'half', ANY, 'Railing / table pe dono forearm tikao, thoda aage jhuko, camera ki taraf dekho.', -84, 0.75, 'rail', 'rail'),
  pose('h-glasses', 'Sunglasses adjust', 'half', 'half', ANY, 'Ek haath se sunglasses theek karo, nazar side mein. Cool summer look.', -90, 0.62, 'peace', 'hang'),

  // ---------- Selfie (front camera) ----------
  pose('f-classic', 'Classic selfie', 'selfie', 'close', FRONT, 'Phone aankh se thoda upar, haath seedha. Chin thoda aage-neeche, light chehre ke saamne.', -90, 0.72, 'hang', 'phone'),
  pose('f-angle', '3/4 angle selfie', 'selfie', 'close', FRONT, 'Chehra camera se 20° ghumao, ek gaal camera ki taraf. Jawline sharp dikhti hai.', -94, 0.52, 'hang', 'phone'),
  pose('f-peace', 'Peace / point', 'selfie', 'close', FRONT, 'Free haath se chehre ke paas peace sign ya point. Asli smile.', -90, 0.7, 'peace', 'phone'),
  pose('f-hair', 'Selfie + haath baalon mein', 'selfie', 'close', FRONT, 'Free haath se baal peeche karo, nazar camera se thodi side.', -92, 0.65, 'hair', 'phone'),
  pose('f-chin', 'Selfie chin rest', 'selfie', 'close', FRONT, 'Free haath ki ungli chin ke neeche, halka sa sar tilt.', -90, 0.68, 'chin', 'phone'),
  pose('f-collar', 'Selfie collar adjust', 'selfie', 'close', FRONT, 'Free haath se collar pakdo, nazar neeche phir camera. Classy.', -90, 0.68, 'collar', 'phone'),
  pose('f-chest', 'Haath chest pe', 'selfie', 'close', FRONT, 'Free haath chest pe halka sa, kandhe relaxed. Simple aur clean.', -90, 0.7, 'chest', 'phone'),
  pose('f-cap', 'Cap / sar pe haath', 'selfie', 'close', FRONT, 'Free haath cap ya sar pe rakho, chehra thoda neeche, aankhen camera pe.', -91, 0.66, 'behind', 'phone'),
  pose('f-away', 'Door dekhte hue', 'selfie', 'close', FRONT, 'Camera se nazar hata ke side mein dekho, jaise kisi ko dekh rahe ho. Candid selfie.', -90, 0.45, 'hang', 'phone'),
  pose('f-lean', 'Tilt selfie', 'selfie', 'close', FRONT, 'Body ek taraf halka jhukao, sar thoda tilt. Fun / casual vibe.', -100, 0.66, 'hang', 'phone'),
]
