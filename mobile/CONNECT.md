# Connecting & Deploying — how it actually works

## TL;DR — start the app

```bash
# Terminal 1 — backend (on your PC)
cd P:\MHM\backend
npm run start:dev

# Terminal 2 — app (auto-detects your LAN IP + prints connect URL)
cd P:\MHM\mobile
npm run go
```

`npm run go` prints:
```
📡  Metro will bind to LAN IP: 192.168.29.51
📱  In the app, connect to:   exp://192.168.29.51:8081
🔗  Backend must run at:      http://192.168.29.51:3000
```

Open the **dev build** app on the phone → connect to that `exp://` URL (scan QR or type it). Done.

---

## Why the QR kept failing

Your **PC's LAN IP changes** every time you join a different Wi-Fi (seen: `10.210.32.117` → `10.186.95.178` → `192.168.29.51`). The old QR/URL pointed at a dead IP → "failed to connect".

**Fixed two ways now:**
1. `npm run go` binds Metro to the **current** IP and prints it — QR is always correct.
2. The app **auto-derives the API URL from the Metro IP** (`src/lib/config.ts`). So the backend URL follows your IP automatically — no more editing `app.json` when Wi-Fi changes.

**Rule:** phone + PC on the **same Wi-Fi**. If login still fails → Windows Firewall blocking port 3000 (allow it once, admin PowerShell):
```
netsh advfirewall firewall add rule name="HMS" dir=in action=allow protocol=TCP localport=3000,8081
```

---

## What is hosted on expo.dev vs your PC

Common confusion: **the app is NOT "running on expo.dev".** Breakdown:

| Thing | Where it lives | Notes |
|-------|----------------|-------|
| **Your JS/UI code** (screens, logic) | Served by **Metro from your PC** in dev | Live reload while `npm run go` runs |
| **Dev build APK** (the installed app) | Built on **EAS (expo.dev) cloud**, installed on phone | Only rebuild when native stuff changes |
| **Push credentials (FCM V1)** | expo.dev (Expo servers) | Used when sending push |
| **OTA updates** (EAS Update) | expo.dev | Optional — pushes JS to installed builds w/o Metro |
| **Backend API + PostgreSQL** | **Your PC** (localhost:3000) | NOT on expo.dev. Deploy to Render/Railway for real use |

So expo.dev = build factory + push service + (optional) update channel. It does **not** run your backend and does **not** serve your JS in dev — your PC does.

---

## After I change code — how does the change reach the phone?

Depends what changed:

### 1. JS / UI change (screens, styles, logic) — 99% of changes
- **Dev (Metro running):** save file → app **hot-reloads** instantly. Press `r` in Metro to force reload. **Nothing uploaded anywhere.**
- Done. No rebuild, no expo.dev.

### 2. Want the change on an installed build WITHOUT Metro running (OTA)
- Run:
  ```bash
  eas update --branch development
  ```
- Uploads the JS bundle to **expo.dev**. The installed dev/preview build fetches it next launch. Good for sharing a change with someone who isn't on your Metro.

### 3. Native change — needs a full rebuild
Triggers: adding a **native module** (e.g. `expo-haptics`, camera), editing `app.json` native config (permissions, plugins, package name, `googleServicesFile`), or SDK upgrade.
- Rebuild:
  ```bash
  eas build --profile development --platform android
  ```
- Install the new APK. (~15 min cloud build.)

**Quick test:** did I only touch files in `app/` or `src/`? → JS change, just reload. Did I touch `app.json` native fields or add a native package? → rebuild.

---

## Going to production later (not now)

1. Deploy backend (Render/Railway) → get a public URL → set `app.json` `extra.apiUrl` to it (production fallback used when no Metro).
2. `eas build --profile production --platform android` → AAB.
3. `eas submit` → Google Play.
4. iOS: needs Apple Developer account ($99) + Mac/EAS.
