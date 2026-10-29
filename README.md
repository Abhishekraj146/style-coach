# Style Coach

Personal app jo 2 kaam karta hai:
1. **Kapde**: wardrobe ki photos → AI tag karta hai → occasion ke hisaab se combos → tum pe virtual try-on
2. **Photos**: live camera pe ghost pose overlay + photographer ke liye hints + scene analysis + photo ka honest review

## Chalana

```bash
npm install
npm run dev          # laptop: http://localhost:5173
npm run dev:phone    # phone: same WiFi pe https://<laptop-IP>:5173 kholo (warning → Advanced → Proceed)
```

Pehli baar: **Me** tab → Settings mein Claude key ([console.anthropic.com](https://console.anthropic.com/settings/keys)) aur Gemini key ([aistudio.google.com](https://aistudio.google.com/apikey)) daalo.

> Note: folder ke naam mein `[` hai. PowerShell mein `cd` karte waqt `Set-Location -LiteralPath 'D:\personal guide app['` use karo, warna woh `[` ko wildcard samajhta hai.

## Project map

```
src/
  main.jsx            entry: React yahan se start hota hai
  App.jsx             5 tabs; jo chuna hai wahi screen dikhti hai
  components.jsx      chhote reusable tukde (photo button, spinner, error, bottom sheet)
  styles.css          saari styling
  screens/
    Wardrobe.jsx      kapde add karo → Claude tag karta hai → grid
    Outfits.jsx       occasion → Claude combos → Gemini try-on → save
    Camera.jsx        live camera + pose ghost + score + hints + capture + scene analyze
    Photos.jsx        kheenchi photos ka review + pasand ki photos (taste profile, custom poses)
    Me.jsx            meri photo, style profile, API keys, saari seekh (lessons)
  lib/
    db.js             phone ke andar storage (IndexedDB). Sab data yahin
    image.js          photos chhoti karna / format badalna
    claude.js         saare Claude calls + fashion/photo ka "knowledge" (system prompts)
    gemini.js         virtual try-on (image banana)
    poseDetector.js   MediaPipe: photo/video mein body ke 33 points dhoondna (offline)
    poses.js          pose ki geometry: ghost banana, live pose compare karna, hints
```

**Ek feature end-to-end (try-on):** Outfits.jsx mein "Mujh pe try karo" button → `doTryOn()` → `lib/gemini.js` ka `tryOn()` (tumhari photo + kapdo ki photos Gemini ko) → image wapas → `tryState` mein → screen pe dikhti hai → "Save" se `outfitsDb` (db.js) mein.

## Kahan kya badlein
- Naye poses: `src/lib/poses.js` → `PRESET_POSES`
- Stylist ka nazariya/rules: `src/lib/claude.js` → `STYLE_RULES`, `PHOTO_RULES`
- Occasions list: `src/screens/Outfits.jsx` → `OCCASIONS`
