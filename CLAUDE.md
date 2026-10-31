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
- `src/lib/ai.js`: all 6 analysis functions (tagClothing, analyzeProfile, suggestOutfits, buildTasteProfile, analyzeScene, reviewPhoto) call the **Gemini API free tier** via `POST /v1beta/interactions` with a JSON schema made from zod. Model order: `settings.textModel` (default `gemini-3.8-flash`), then `gemini-3.5-flash-lite`, then `gemini-2.5-flash`. On 429/404/400/5xx it tries the next model. The prompts and schemas were copied unchanged from claude.js.
- `src/lib/tryon.js`: **free try-on** through the open-source IDM-VTON Hugging Face Space (`yisol/IDM-VTON`, `@gradio/client`). Upper body only (it picks outerwear > top > ethnic). An optional free HF token in Settings raises the daily limit. VERIFIED live on 2026-11-01: a real try-on finished in ~1 min and looked correct.
- `claude.js` and `gemini.js` (paid) are kept but no longer imported. Don't delete them without asking.
- Free extras: 🔊 voice coach and 🤖 auto-capture with a 3-2-1 countdown in Camera (`src/lib/voice.js`), 📍 weather via Open-Meteo in Outfits (`src/lib/weather.js`), 💾 backup/restore in Me (`exportAll`/`importAll` in db.js; settings/keys are never exported).
- PWA: `public/sw.js` (cache `style-coach-v3`, precaches index.html and its assets at install, cache-first for MediaPipe CDN files), PNG icons, `base: './'` so the app works under a sub-path. Verified: SW active under /style-coach/, and the app opens offline with the server stopped.
- Deploy: `.github/workflows/deploy.yml` builds and deploys to GitHub Pages on every push to `main`. The user chose GitHub Pages.

Verified: build passes; pose math; MediaPipe loads; Gemini request shape and wrong-key error; live try-on; Open-Meteo response; backup round-trip with no key leak; offline load.
Not verified yet: real Gemini answers (needs the user's free key); live camera, voice and auto-capture on a real phone.

## When changing the service worker
Bump `CACHE` in public/sw.js (v3 → v4) so phones drop old files.

## Quirks
- The folder name ends in `[`. In PowerShell use `Set-Location -LiteralPath 'D:\personal guide app['`. Plain `cd` goes to `C:\`. Bash with a quoted path works fine.
- `npm run dev` runs on http://localhost:5173 (the Browser pane can open it). `npm run dev:phone` uses self-signed HTTPS on the LAN for the phone camera; the Browser pane rejects that certificate.
- Test pose logic with JS in the browser (import `/src/lib/poses.js`), not through the camera.
