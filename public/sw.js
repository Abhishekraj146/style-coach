// Service worker = app ka offline helper. Ek baar khulne ke baad app bina internet ke bhi khulta hai.
// Strategy:
//  - App ki apni files: pehle internet se (naya version mile), na mile toh cache se.
//  - Pose AI ki badi files (MediaPipe wasm/model, CDN se): cache se (ek baar download, hamesha ke liye).
//  - AI calls (Gemini, Hugging Face): kabhi cache nahi (har baar fresh jawab chahiye).
const CACHE = 'style-coach-v5'
const HEAVY = ['cdn.jsdelivr.net/npm/@mediapipe', 'storage.googleapis.com/mediapipe-models']

// Install ke waqt hi app ki saari files cache karo. Pehli baar page khulte waqt SW abhi ready nahi hota,
// isliye JS/CSS cache mein nahi jaati thi aur offline khaali page aata tha.
self.addEventListener('install', (e) => {
  e.waitUntil(
    (async () => {
      const c = await caches.open(CACHE)
      const html = await (await fetch('./index.html', { cache: 'no-store' })).text()
      const assets = [...html.matchAll(/(?:src|href)="(\.\/assets\/[^"]+)"/g)].map((m) => m[1])
      await c.addAll(['./', './index.html', './manifest.webmanifest', './icon-192.png', ...assets])
    })(),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = req.url

  if (HEAVY.some((h) => url.includes(h))) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) caches.open(CACHE).then((c) => c.put(req, res.clone()))
        return res
      })),
    )
    return
  }

  if (new URL(url).origin === self.location.origin) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)) }
          return res
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html'))),
    )
  }
})
