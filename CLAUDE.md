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

## Status (2026-10-30), v1 built
Working and verified:
- Build passes. All 5 screens render (Wardrobe, Outfits, Camera, Photos, Me).
- Pose math (`src/lib/poses.js`): the same pose scores 96-100 and different poses mostly 35-76. Thresholds: Perfect at 90, OK at 70.
- MediaPipe pose detection loads (~1.6s) and detects a person in a photo.
- Claude and Gemini request paths work up to auth; a wrong key shows a clear Hinglish error.

Not tested yet:
- Live camera on a real phone (the Browser pane blocks camera access).
- Real AI answers (no real keys yet).

## The free problem (main task for next session)
v1 uses the **Claude API (paid, no free tier)** for all analysis and the **Gemini image model** for try-on. The user wants everything free, so:
- **Already free:** the camera coach (ghost pose, score, photographer hints, capture), all storage, and the full UI. These run on the phone.
- **To change:** move the `src/lib/claude.js` functions (tagClothing, analyzeProfile, suggestOutfits, buildTasteProfile, analyzeScene, reviewPhoto) to a **free-tier vision model**. The likely choice is the Gemini API free tier with a Flash model. Check current free limits and model names on the official docs first, and keep the same function names and return shapes so the screens don't change.
- **Try-on:** check whether any free option exists today (Gemini free tier for image models, a free Hugging Face Space for virtual try-on, etc.). If nothing free is reliable, keep try-on optional and tell the user honestly.
- **Install on phone:** deploy free with HTTPS (GitHub Pages / Netlify / Cloudflare Pages), then use "Add to Home screen". The user's API key is typed in the app's Settings, never put in the code.

## Quirks
- The folder name ends in `[`. In PowerShell use `Set-Location -LiteralPath 'D:\personal guide app['`. Plain `cd` goes to `C:\`. Bash with a quoted path works fine.
- `npm run dev` runs on http://localhost:5173 (the Browser pane can open it). `npm run dev:phone` uses self-signed HTTPS on the LAN for the phone camera; the Browser pane rejects that certificate.
- Test pose logic with JS in the browser (import `/src/lib/poses.js`), not through the camera.
