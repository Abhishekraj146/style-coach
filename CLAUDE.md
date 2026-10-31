# Style Coach: rules for AI (read before touching anything)

The user's personal phone app (PWA). It does two things: a wardrobe stylist with virtual try-on, and a photo/pose camera coach.
The user writes in Hinglish, so replies and UI copy stay in simple Hinglish. They are learning to debug, so explain what changed and why in 2-6 lines.
Project map and run commands are in README.md.

## Hard rules
1. **Never delete** files, folders, or the user's app data (IndexedDB: wardrobe, photos, references, lessons, settings) without asking first.
2. **Don't rewrite working code.** Make small, targeted edits. Read the file before changing it.
3. **Don't invent bugs.** Call something a bug only after reproducing it (console error, failing test, wrong output) and show the evidence.
4. **Free only.** The user has no budget. No paid APIs, paid hosting, or paid packages. If something can't be done free, say so honestly and give the best free option.
5. **Personal use only.** The app runs on the user's own phone. Never publish keys or deploy publicly with keys inside.
6. After any change, run `npx vite build` (it must pass). Before a big change, make a git commit so it can be undone.
7. Ask before big decisions (new service, new framework, deleting a feature).

## Status (2026-11-01), v2: fully free
All AI is now free:
- `src/lib/ai.js`: all 6 analysis functions call `askAI`, which goes through a FREE chain: **Gemini free tier** (`/v1beta/interactions`, model order `settings.textModel` → `gemini-3.5-flash-lite` → `gemini-2.5-flash`), then **Groq** (`qwen/qwen3.8-27b`, max 3 images, needs `groqKey`), then **OpenRouter** (`:free` vision models picked live from `/api/v1/models`, Gemma first, needs `openrouterKey`). Only services with a key are tried. A wrong key skips that service. On 429 or any error it moves on. Groq and OpenRouter get the JSON schema in the prompt with `response_format: json_object`, and the result is validated with zod. Verified on 2026-11-01: all 3 endpoints are reachable from the browser (CORS OK) and wrong keys give a clear message. Real answers are not verified yet (no real keys).
- `src/lib/tryon.js`: **free try-on** chain on Hugging Face ZeroGPU Spaces through `@gradio/client` `predict()`. Upper body: IDM-VTON (`yisol/IDM-VTON`) → Leffa (`franciszzj/Leffa`). Lower body (pants): Leffa only, with `dress_code`/`lower_body`. Outfits has "👖 Pant bhi pehnao", which runs on the top try-on result. IMPORTANT: the ZeroGPU quota is per user and SHARED across all Spaces (anonymous ~a few min/day). A backup Space does not add quota. A free HF token (Settings) does. Do NOT use `client.submit` + `for await`: on Gradio 5 Spaces it yields nothing and hides errors such as "ZeroGPU quota exceeded". Verified: IDM-VTON success (twice); the Leffa quota error shows the right message. Leffa success (incl. pants) is NOT verified yet because the quota was used up during testing. Kolors try-on Space was rejected because its API is hidden.
- `claude.js` and `gemini.js` (paid) are kept but no longer imported. Don't delete them without asking.
- Poses: `src/lib/poseLibrary.js` has 51 ORIGINAL poses (no downloaded photos, for copyright reasons: the repo is public). Categories: stand 20, street 7, sit 4, half 10, selfie 10. They are built from ARM/LEG blocks with an optional length multiplier `k` for foreshortened limbs. `camera: 'front'` = selfie only (shown only on the front camera). Framings are full/half/close; close = selfie. `src/lib/silhouette.js` draws a human-shaped outline (union border + arm contours) instead of sticks, plus thumbnails. Liked photos (Photos tab) get a REAL person outline through the MediaPipe segmentation mask (`detectPoseAndOutline` in poseDetector.js), and Camera overlays that outline. Selfie scoring (`selfieHands` in poses.js) compares wrist position relative to the shoulders, because elbows leave the frame; the body angle uses shoulders→head. Body turn (sw) is part of the score. Verified: all 51 poses score >=96 against themselves; selfies are now distinguishable; the outline was extracted from a real photo (16KB PNG); the picker shows 41 poses on the back camera and 51 on the front, and flipping to front auto-selects a selfie pose.
- USER FEEDBACK (2026-11-01): the user said the mannequin silhouettes look "ghatiya" and all alike. They want the REAL PHOTO itself as a faded overlay. So photo poses (refs) now draw the whole photo at adjustable opacity (`drawPhotoGhost`, contain-fit, slider 15-80%, default 40%), and they are listed first as "Photo pose #n". The mannequins stay only as a fallback. Prefer real photos in future pose work.
- Real pose photos: Camera → pose sheet → 🔍 searches Pexels (`src/lib/pexels.js`, needs the user's free `pexelsKey`, `orientation=portrait`, photographer credit stored on the ref and shown). Also "＋ Apni photo" (screenshots from anywhere, which stay on the phone only). Shared logic: `src/lib/references.js` `addReferencePhotos(urls, credit)`. Do NOT bundle copyrighted or scraped photos into the repo: it is PUBLIC (GitHub Pages), so bundling = publishing. Unsplash/Pexels block bots without an API key (307/403); don't try to bypass that. Verified: the Pexels API and images load from the browser (CORS OK), a wrong/missing key shows a clear message, and the own-photo → pose → faded overlay flow works with a real photo. NOT verified: real Pexels search results (no key).
- Free extras: 🔊 voice coach and 🤖 auto-capture with a 3-2-1 countdown in Camera (`src/lib/voice.js`), 📍 weather via Open-Meteo in Outfits (`src/lib/weather.js`), 💾 backup/restore in Me (`exportAll`/`importAll` in db.js; settings/keys are never exported).
- PWA: `public/sw.js` (cache `style-coach-v5`, precaches index.html and its assets at install, cache-first for MediaPipe CDN files), PNG icons, `base: './'` so the app works under a sub-path. Verified: SW active under /style-coach/, and the app opens offline with the server stopped.
- Deploy: `.github/workflows/deploy.yml` builds and deploys to GitHub Pages on every push to `main`.
- **LIVE: https://abhishekraj146.github.io/style-coach/** (repo: github.com/Abhishekraj146/style-coach, public, Pages source = GitHub Actions). Pushing to `main` updates the phone app within ~1 min. The git remote `origin` is set and the GitHub login is saved in Git Credential Manager.

Verified: build passes; pose math; MediaPipe loads; Gemini request shape and wrong-key error; live try-on; Open-Meteo response; backup round-trip with no key leak; offline load.
Not verified yet: real Gemini answers (needs the user's free key); live camera, voice and auto-capture on a real phone.

## When changing the service worker
Bump `CACHE` in public/sw.js (v3 → v4) so phones drop old files.

## Quirks
- The folder name ends in `[`. In PowerShell use `Set-Location -LiteralPath 'D:\personal guide app['`. Plain `cd` goes to `C:\`. Bash with a quoted path works fine.
- `npm run dev` runs on http://localhost:5173 (the Browser pane can open it). `npm run dev:phone` uses self-signed HTTPS on the LAN for the phone camera; the Browser pane rejects that certificate.
- Test pose logic with JS in the browser (import `/src/lib/poses.js`), not through the camera.
