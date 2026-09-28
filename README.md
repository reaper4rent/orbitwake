# ORBITWAKE

Phone-first planetary sandbox. Same game — now an installable app.

This is **not** Astroneer.

## Play on your phone (fastest)

1. Host the folder on HTTPS (Vercel import of this repo, or GitHub Pages).
2. Open it in **Chrome on Android**.
3. Tap **Install App**, or Chrome menu → **Add to Home screen**.
4. It launches fullscreen like a store app. Works offline after the first load.

On this phone you can also open `index.html` from a local file, but install + offline need HTTPS.

## Controls

- Left stick — move
- Hold **DIG** — excavate
- Tap **GATHER** — pick up resin / ore
- BUILD / PACK / SHOP / WARP — bottom bar

## Android APK (Capacitor)

Needs Android Studio on a computer:

```bash
cd orbitwake
npm install
npx cap add android
npx cap sync
npx cap open android
```

Then Build → Build Bundle(s) / APK(s) → APK.

App id: `game.orbitwake.app`

## Shop

Sandbox checkout only. Worlds stay free.
