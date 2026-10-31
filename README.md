# Style Coach

Personal app jo 2 kaam karta hai, **poora free**:
1. **Kapde**: wardrobe ki photos → AI tag karta hai → occasion + mausam ke hisaab se combos → tum pe virtual try-on (upper body)
2. **Photos**: live camera pe ghost pose overlay + photographer ke liye hints + voice coach + auto-photo + scene analysis + photo ka honest review

## Free cheezein jo use hoti hain
| Kaam | Kya use hota hai | Kharcha |
|---|---|---|
| AI analysis (tagging, combos, review) | Google Gemini free tier → backup: Groq (open-source Qwen) → OpenRouter (open-source Gemma etc.) | Free keys: [Gemini](https://aistudio.google.com/apikey), [Groq](https://console.groq.com/keys), [OpenRouter](https://openrouter.ai/keys) |
| Virtual try-on | Open-source IDM-VTON → Leffa (Hugging Face). Top + pant | Free, roz ki limit (saare servers ki ek). Free token se zyada: [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens) |
| Pose camera | MediaPipe, phone ke andar | Free, offline |
| Mausam | Open-Meteo | Free, bina key |
| Hosting | GitHub Pages | Free |

## Chalana

```bash
npm install
npm run dev          # laptop: http://localhost:5173
npm run dev:phone    # phone (same WiFi): https://<laptop-IP>:5173 (warning → Advanced → Proceed)
```

Phone pe install: GitHub Pages wala link Chrome mein kholo → ⋮ menu → **Add to Home screen / Install app**.
Phir **Me** tab → Settings mein free Gemini key daalo.

> Note: folder ke naam mein `[` hai. PowerShell mein `Set-Location -LiteralPath 'D:\personal guide app['` use karo.

## Project map

```
src/
  main.jsx            entry: React start + offline helper (service worker) register
  App.jsx             5 tabs; jo chuna hai wahi screen dikhti hai
  components.jsx      chhote reusable tukde (photo button, spinner, error, bottom sheet)
  styles.css          saari styling
  screens/
    Wardrobe.jsx      kapde add karo → AI tag karta hai → grid
    Outfits.jsx       occasion (+ 📍 mausam) → AI combos → free try-on → save
    Camera.jsx        live camera + pose ghost + score + hints + 🔊 voice + 🤖 auto photo + scene analyze
    Photos.jsx        kheenchi photos ka review + pasand ki photos (taste profile, custom poses)
    Me.jsx            meri photo, style profile, keys, seekh (lessons), 💾 backup/restore
  lib/
    ai.js             FREE AI chain (Gemini → Groq → OpenRouter) + fashion/photo ka "knowledge" (prompts)
    tryon.js          FREE try-on chain (IDM-VTON → Leffa; pant ke liye Leffa)
    weather.js        aaj ka mausam (Open-Meteo)
    voice.js          phone ki awaaz mein bolna
    db.js             phone ke andar storage (IndexedDB) + backup/restore
    image.js          photos chhoti karna / format badalna
    poseDetector.js   MediaPipe: body ke 33 points dhoondna (offline)
    poses.js          pose ki geometry: ghost, live compare, hints
    claude.js         (purana, paid: ab use nahi hota)
    gemini.js         (purana, paid try-on: ab use nahi hota)
public/
  sw.js               offline helper (cache)
  manifest.webmanifest, icon-*.png   phone pe install ke liye
.github/workflows/deploy.yml         GitHub pe push → app apne aap online update
```

**Ek feature end-to-end (try-on):** Outfits.jsx mein "Mujh pe try karo" → `doTryOn()` → `lib/tryon.js` ka `tryOn()` (tumhari photo + top ki photo, free IDM-VTON server ko) → progress `onStatus` se screen pe → image wapas → `tryState` → "Save" se `outfitsDb` (db.js) mein.

## Kahan kya badlein
- Naye poses: `src/lib/poses.js` → `PRESET_POSES`
- Stylist ka nazariya/rules: `src/lib/ai.js` → `STYLE_RULES`, `PHOTO_RULES`
- Occasions list: `src/screens/Outfits.jsx` → `OCCASIONS`
- Service worker badla? `public/sw.js` mein `CACHE` ka version badhao (v3 → v4)
