# Deployment Guide — put HMS live for your hostelmates

This takes the app from "runs on my PC over Wi-Fi" to "runs on the internet, anyone in the hostel can install it and use it from anywhere." Written step-by-step; no prior DevOps knowledge assumed.

---

## 0. What we're deploying (the big picture)

Right now everything runs on your laptop:
```
phone ── LAN ──> your PC (API :3000) ──> Postgres on your PC
```
That only works while your laptop is on, same Wi-Fi, correct IP. For real users we move the two server pieces to the cloud:
```
phones (anywhere) ── HTTPS ──> Backend API (Render)  ──> Postgres (Neon)
                                     ▲
                               push via Expo/FCM
```
Your laptop is no longer needed after deploy. The **app** (React Native) is installed on each phone and talks to the cloud API.

Three deploy jobs:
1. **Database** → Neon (managed Postgres, free tier).
2. **Backend API** → Render (free/cheap Node host, gives HTTPS automatically).
3. **Mobile app** → point it at the cloud API, build with EAS, share the install link.

> HTTPS matters: iOS blocks plain-HTTP. Render gives you `https://…` for free, which also fixes the earlier iOS "loads forever" issue.

Cost: **$0 to start** (Neon free + Render free). Render's free tier sleeps after inactivity (first request after idle is slow ~30s). Upgrade to ~$7/mo to keep it always-on when you're ready.

---

## PART A — Database (Neon, free)

1. Go to **https://neon.tech** → sign up (GitHub login is easiest).
2. **Create project** → name it `hms`. Region: pick closest to your hostel.
3. After it creates, open **Dashboard → Connection string**. Copy the **`postgresql://…`** string. It looks like:
   ```
   postgresql://hms_owner:npg_XXXX@ep-cool-name-123.ap-southeast-1.aws.neon.tech/hms?sslmode=require
   ```
4. **Save this** — it's your `DATABASE_URL` for the backend. Keep the `?sslmode=require` at the end.

That's it — Neon is ready. Tables get created in Part B when the backend runs migrations.

---

## PART B — Backend API (Render)

### B1. Push code to GitHub (already done)
Your repo is `github.com/DhruvHarani1/hms`. Render deploys from it.

### B2. Create the Render service
1. Go to **https://render.com** → sign up with GitHub.
2. **New +** → **Web Service** → connect your `hms` repo.
3. Fill the form:
   - **Name:** `hms-api`
   - **Root Directory:** `backend`   ← important (the API lives in `backend/`)
   - **Runtime:** Node
   - **Build Command:**
     ```
     npm install && npx prisma generate && npm run build
     ```
   - **Start Command:**
     ```
     npx prisma migrate deploy && node dist/main.js
     ```
     (`migrate deploy` creates/updates tables on every deploy — safe, only applies new migrations.)
   - **Instance Type:** Free (to start).

### B3. Environment variables
On the same page (or Service → **Environment**), add these keys:

| Key | Value |
|-----|-------|
| `DATABASE_URL` | the Neon string from Part A (with `?sslmode=require`) |
| `JWT_ACCESS_SECRET` | a long random string (≥32 chars) — see below |
| `JWT_REFRESH_SECRET` | a **different** long random string |
| `JWT_ACCESS_TTL` | `15m` |
| `JWT_REFRESH_TTL` | `30d` |
| `NODE_ENV` | `production` |
| `CORS_ORIGINS` | `*` (native app has no browser origin; fine to leave open) |

> `PORT` — do **not** set it. Render injects its own `PORT` and our `main.ts` already reads `process.env.PORT`.

Generate strong secrets (run locally, paste the output):
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```
Run it twice → one for access, one for refresh.

### B4. Deploy
Click **Create Web Service**. Render builds + runs migrations + starts. Watch the log; success looks like:
```
🚀 HMS API running on http://localhost:10000/api/v1
```
Your public URL is shown at the top, e.g.:
```
https://hms-api.onrender.com
```
Your API base is therefore:
```
https://hms-api.onrender.com/api/v1
```

### B5. Seed the first hostel + warden (one time)
Tables exist but are empty. Seed the single hostel, warden, and complaint categories.

Render Free doesn't include a shell; easiest one-time seed:
- **Option 1 (temporary):** change the Start Command to
  ```
  npx prisma migrate deploy && npm run db:seed && node dist/main.js
  ```
  Deploy once → it seeds → **then remove `npm run db:seed`** and redeploy (so it doesn't re-run every restart; the seed is idempotent but cleaner to remove).
- **Option 2 (paid instances):** open **Shell** tab → run `npm run db:seed`.

Seed creates:
```
Warden : warden@hostel.test / Password123!
```

### B6. 🔒 CHANGE THE WARDEN PASSWORD IMMEDIATELY
The seed password is public (it's in this repo). Before sharing the app:
1. Open the app, log in as `warden@hostel.test` / `Password123!`.
2. Profile → change password (or we can add a quick admin step).
3. Optionally change the warden email too (ask me — 2-min backend tweak).

Do **not** skip this. Anyone reading the repo knows the default.

### B7. Verify the live API
```bash
curl -X POST https://hms-api.onrender.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"warden@hostel.test","password":"<your-new-password>"}'
```
Returns an `accessToken` → backend is live. 🎉

---

## PART C — Point the mobile app at the cloud API

The app currently auto-uses your PC's IP in dev. For the real build it must use the cloud URL.

Edit `mobile/app.json` → `extra.apiUrl`:
```json
"extra": {
  "apiUrl": "https://hms-api.onrender.com/api/v1",
  ...
}
```

How the app chooses the URL (`src/lib/config.ts`):
- **Dev** (Metro running) → auto-derives from your PC IP (unchanged, still handy for local testing).
- **Production build** (no Metro) → uses `extra.apiUrl` above.

So set `apiUrl` to the Render URL and production builds will hit the cloud automatically.

Commit it:
```bash
git add mobile/app.json && git commit -m "chore: point app at production API" && git push
```

---

## PART D — Build the installable app + share it

Two ways to get the app onto hostelmates' phones.

### D1. Android — internal distribution APK (fastest, free)
Anyone with the link installs the APK directly. No Play Store.
```bash
cd mobile
eas build --profile preview --platform android
```
(`preview` profile = installable APK, not a dev client. Already defined in `eas.json`.)
- ~15 min → you get a **build page link** + QR.
- Share that link in your hostel WhatsApp group. Each person opens it → **Download** → install (allow "unknown sources").
- This build talks to the **cloud API**, so it works on mobile data / any Wi-Fi — no laptop needed.

### D2. Android — Play Store (optional, more "official")
Needs a Google Play Developer account ($25 one-time).
```bash
eas build --profile production --platform android    # builds an .aab
eas submit --platform android                         # uploads to Play Console
```
Then use Play Console **Internal testing** → add testers by email → they install from Play Store.

### D3. iOS (needs Apple Developer account — $99/yr)
```bash
eas build --profile production --platform ios
eas submit --platform ios
```
Distribute via **TestFlight** (add hostelmates' Apple IDs). No Apple account = no iOS build; Android-only is fine to start.

### D4. Updating the app later
- **JS/UI change** (most changes): push an OTA update, no rebuild:
  ```bash
  eas update --branch preview      # matches the preview build's channel
  ```
  Installed apps fetch it on next open.
- **Native change** (new native module, `app.json` native fields, SDK bump): rebuild with `eas build` + reshare the APK / resubmit.

See `mobile/CONNECT.md` for the JS-vs-native rule.

---

## PART E — Onboarding your hostelmates (the approval flow)

You built approval-gated signup, so onboarding is self-serve:

1. **You (warden):** install the app, log in with your warden account.
2. **Each hostelmate:** installs the app → **Sign up** → enters name, email, roll no, room, password → "join request sent."
3. **You:** open the **Requests** tab (shows a badge count) → **Approve** each real student (or **Reject** with a reason).
4. Approved students can now log in and use everything: meal alerts, complaints, notices, meal marking.
5. Rejected students see the reason and can re-apply.

No manual account creation needed — you just approve.

---

## Environment variable reference

### Backend (Render)
| Var | Required | Example / note |
|-----|----------|----------------|
| `DATABASE_URL` | ✅ | Neon `postgresql://…?sslmode=require` |
| `JWT_ACCESS_SECRET` | ✅ | 48+ random bytes hex |
| `JWT_REFRESH_SECRET` | ✅ | different 48+ random bytes hex |
| `JWT_ACCESS_TTL` | ✅ | `15m` |
| `JWT_REFRESH_TTL` | ✅ | `30d` |
| `NODE_ENV` | ✅ | `production` |
| `CORS_ORIGINS` | ⬜ | `*` (native app) |
| `PORT` | ❌ | do NOT set — Render provides it |

### Mobile (`app.json` → `extra`)
| Field | Value |
|-------|-------|
| `apiUrl` | `https://hms-api.onrender.com/api/v1` |
| `eas.projectId` | already set (`3be841c1-…`) |

### Push (already configured, no action)
FCM V1 service account is uploaded to EAS. Production builds send lock-screen push automatically. `google-services.json` is in the repo so the build includes it.

---

## Redeploy / day-2 operations

- **Backend code change:** `git push` → Render auto-deploys (runs `migrate deploy` + restart). No manual step.
- **New DB migration:** commit the `backend/prisma/migrations/**` folder (created by `prisma migrate dev` locally) → push → Render applies it via `migrate deploy`.
- **Roll back:** Render **Deploys** tab → pick a previous deploy → "Redeploy".
- **DB backups:** Neon keeps automatic point-in-time history on its dashboard.
- **Logs:** Render **Logs** tab (API), Neon dashboard (DB), `eas build`/Expo dashboard (app), Sentry later for crashes.

---

## Costs summary

| Piece | Free tier | Paid (when you outgrow) |
|-------|-----------|-------------------------|
| Neon Postgres | Yes (0.5 GB) | ~$19/mo |
| Render API | Yes (sleeps when idle) | ~$7/mo always-on |
| EAS builds | Limited free builds/mo | $ if you build a lot |
| Android APK link | Free | — |
| Google Play | $25 one-time | — |
| Apple / iOS | — | $99/yr |

Start 100% free (Neon + Render free + APK link). Upgrade Render to $7/mo first (kills the cold-start delay) when people actually use it daily.

---

## Quick go-live checklist

- [ ] Neon project created, `DATABASE_URL` copied
- [ ] Render service: root dir `backend`, build + start commands set
- [ ] All env vars set (2 fresh JWT secrets)
- [ ] Deploy succeeds, tables migrated
- [ ] Seed run once (hostel + warden created)
- [ ] **Warden password changed** from the default 🔒
- [ ] `curl` login against the Render URL returns a token
- [ ] `app.json` `apiUrl` = Render URL, committed
- [ ] `eas build --profile preview --platform android` → APK link
- [ ] Share link; hostelmates sign up; you approve in Requests tab

---

Stuck on any step? Tell me which one + the error/log line and I'll fix it. When you're ready I can also: add a one-command warden bootstrap (custom email/password via env), add a `render.yaml` for one-click deploy, or wire a custom domain.
