# AIFDMS Hostel App — Full Context / Handoff

This document is a complete handoff so another developer or AI model can continue from where we left off. Read it top to bottom before making changes.

---

## 1. What this is

A **Hostel Management System** ("AIFDMS Hostel App") shipped as:
- **Native mobile app** (React Native + Expo) for **Android** (installed APK) and **iOS** (via web PWA).
- **Web app / PWA** (same Expo codebase, `react-native-web`) hosted on Cloudflare — serves warden desktop + iOS users + anyone.
- **REST API** (NestJS) + **PostgreSQL** (Prisma).

It is **live in production** and was **wiped clean for launch** (only one warden account exists). Everything runs on **free tiers** (no card anywhere).

Roles: **warden** (admin), **student**, **cook**. (super_admin, staff exist in enum but unused.)

Repo: `github.com/DhruvHarani1/hms` (private). Monorepo:
```
P:\MHM\
├── backend/    NestJS + Prisma + PostgreSQL API
├── mobile/     Expo (React Native) app + web build
├── CONTEXT.md  (this file)
├── HOSTEL_MANAGEMENT_SYSTEM_DESIGN.md  (original product design doc)
├── DEPLOYMENT.md, mobile/CONNECT.md    (deploy/run guides)
└── wrangler.toml  (Cloudflare Workers static-assets config)
```

Working dir is Windows (`P:\MHM`), git-bash shell, Node 20/24.

---

## 2. Tech stack

**Backend** (`backend/`): NestJS 10, Prisma 5, PostgreSQL, Passport-JWT (access + rotating refresh), argon2, class-validator. Extras: `cloudinary` (image storage), `pdfkit` (profile PDF), `exceljs` (Excel exports), `web-push` (VAPID push), `@nestjs/schedule` (cleanup cron), `expo-server-sdk` (Android push). Email via **Brevo HTTP API** (not SMTP — Render blocks SMTP ports).

**Mobile** (`mobile/`): Expo SDK **54**, React 19, RN 0.81, expo-router (file-based nav, bottom tabs), TanStack Query, Zustand, axios, expo-secure-store (token storage), expo-notifications (FCM/APNs), expo-image-picker (docs), react-native-web (web target).

---

## 3. Hosting / services (all free tier)

| Piece | Where | Notes |
|-------|-------|-------|
| API | **Render** (`hms-api`) | URL `https://hms-api-47qf.onrender.com` (base `/api/v1`). Free tier **sleeps** when idle → cold start ~30-50s. **Blocks outbound SMTP ports.** Auto-deploys on push to `main`. |
| Database | **Neon** Postgres | `neondb`. Migrations run on deploy via `npx prisma migrate deploy`. |
| Image storage | **Cloudinary** (cloud `u2ohmroe`) | Private "authenticated" assets, signed upload + signed view URLs. |
| Email | **Brevo** HTTP API | Password-reset codes. Sender `maheshwarihostel1@gmail.com` (verified in Brevo). |
| Web push | **VAPID** (self-hosted keys) | Free, no account. iOS needs installed PWA (16.4+). |
| Android push | **FCM V1** via **Expo Push** | Firebase project `hostel-manager-5094a`. |
| Web hosting | **Cloudflare** Workers static assets | URL `https://aifdms-hostel.maheshwarihostel1.workers.dev/`. Auto-deploys on push. |
| Uptime/keepalive | any cron (cron-job.org etc) | GET `/api/v1/health` every ~10 min → keeps Render awake + fires the cleanup cron. |

**Expo/EAS:** account `dhruvharani`, project `hms-mobile`, projectId `3be841c1-c93d-4c54-b1fd-90e9e77ebe9b`. OTA channel `preview`.

---

## 4. Render env vars (backend)

```
DATABASE_URL          Neon connection string (?sslmode=require)
JWT_ACCESS_SECRET / JWT_REFRESH_SECRET   long random strings
JWT_ACCESS_TTL=15m    JWT_REFRESH_TTL=30d
NODE_ENV=production   CORS_ORIGINS=*     (do NOT set PORT — Render provides it)
CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET
VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT=mailto:...
BREVO_API_KEY         MAIL_FROM=maheshwarihostel1@gmail.com   MAIL_FROM_NAME=AIFDMS Hostel
```
Render build cmd: `npm install --include=dev && npx prisma generate && npm run build`
Render start cmd: `npx prisma migrate deploy && node dist/main.js`  (NO seed — seeding is manual/one-off).

Cloudflare build cmd: `cd mobile && npm install && npm run build:web`  · output dir `mobile/dist` · env `NODE_VERSION=20`. (`build:web` = `expo export -p web && node scripts/patch-html.js` which injects PWA manifest + apple meta tags.)

`mobile/app.json` → `extra.apiUrl` = `https://hms-api-47qf.onrender.com/api/v1` (used by production/web builds; dev derives API host from the Metro IP via `src/lib/config.ts`).

---

## 5. Current PRODUCTION state (post-launch wipe)

DB was TRUNCATE-CASCADE wiped + Cloudinary emptied. Fresh data:
- **1 hostel**: "AIFDMS Hostel" (code `AIFDMS-1`)
- **1 warden**: **Sunil Kela** — `sunilmaheshvari3@gmail.com` / **`Sunil@1221`** (he should reset via Forgot password on first login)
- **6 complaint categories**: Electrical, Plumbing/Water, Wi-Fi/Internet, Cleaning, Furniture, Other
- **0 students, 0 cooks**

Onboarding: users sign up (Student or Cook) → warden **Requests** tab → Approve → they log in.

⚠️ A Gmail app password (`nqxtejnttjvbtodq`) was exposed in chat earlier (SMTP attempt, now unused since Brevo). Should be rotated.

---

## 6. Features (all implemented + live)

**Auth**: JWT login, approval-gated signup (pending → warden approve/reject with reason → active; rejected can re-apply), password reset via emailed 6-digit code (Brevo, 15-min expiry), change password, roles (warden/student/cook), secure-store token storage, biometric-ready.

**Meals**:
- Per-day, per-meal attendance — student marks **lunch/dinner** on a calendar; **breakfast is derived** (on if lunch OR dinner). Bulk "mark all / clear" for the month. Monthly stats (days ate / total, %).
- **Daily menu**: warden More → "Set today's menu" → per-meal **dish master lists** (CRUD) + tick today's dishes + Save → notifies students + cook. Students/cook see today's menu (read-only).
- **Meal-ready** buttons (🍳🍛🌙) — warden AND cook; fires "X is ready" to **everyone**.
- Warden: per-student meal calendar (view-only) + **Excel export** (name + day cols, B/L/D subcols, ✓/✗).

**Attendance**: one-tap present/absent calendar (default present, red = absent). Warden per-student view + Excel export. Monthly present count.

**Leave**: student applies (start/end date picker + reason) → **auto-applies**: marks those days absent + clears meals + notifies warden. Warden sees leave list. (No approval step — auto.)

**Complaints**: student submits (category, title, description, photo URLs), tracks status (pending→in_progress→resolved→closed). Warden triages (status/priority/assign), replies.

**Notices**: warden posts → students notified + notice feed.

**Profiles + documents**: full student profile (name, father, surname, DOB, gender, blood group, address, guardian phone, emergency, course, year, institute name/address, mobile). Date fields use a **calendar picker** (tap header → year grid → month grid → day). Gender/blood = chip selectors. **Document uploads** (profile photo, Aadhaar, course proof) to **Cloudinary** (private, signed). Warden: tap student → full profile view + download docs + **multi-page PDF** (page 1 = details, then 1 image page per uploaded doc). Warden can **remove student** (deletes user + cascade + Cloudinary files).

**Notifications**: in-app inbox (🔔 bell + unread badge) on all roles; **real push** — Android APK via FCM, iOS/web via VAPID web-push (installed PWA). Fires on meal-ready, menu-set, announcements, notices, leave.

**Auto-cleanup** (daily cron 19:30 UTC): deletes meal notifications >1 day, other notifications >30 days, resolved/closed complaints >2 days after resolve, notices >30 days, expired reset codes, dead refresh tokens, old meal-menu sessions. Keeps users/profiles/attendance/leaves.

**Branding**: logo (`mobile/assets/logo.jpg` + generated icon/splash/notification-icon PNGs), app name "AIFDMS Hostel App", "॥ जय महेश ॥" tagline on login, logo in Home headers.

---

## 7. Data model (Prisma — `backend/prisma/schema.prisma`)

Tables (`@@map` names): `hostels`, `users`, `student_profiles`, `refresh_tokens`, `password_resets`, `audit_logs`, `notifications`, `notification_recipients`, `device_tokens`, `web_push_subscriptions`, `dishes`, `meal_sessions`, `meal_attendance`, `attendance`, `leave_requests`, `complaint_categories`, `complaints`, `complaint_replies`, `complaint_attachments`, `notices`.

Key points:
- `User.role` enum: super_admin | warden | staff | student | cook. `User.status`: pending | active | rejected | inactive | suspended.
- Almost everything carries `hostelId` (multi-tenant ready; single hostel in use).
- `StudentProfile` holds all profile fields + `photoKey`/`aadhaarKey`/`courseProofKey` (Cloudinary public_ids).
- `MealType` enum: breakfast | lunch | dinner | **day** (legacy, unused now). Student attendance stores `lunch`/`dinner` rows; breakfast derived on read.
- `MealSession.menu` stores today's dish list as a JSON array string (used by the daily-menu feature).
- `Attendance` = **absent-only** rows (no row = present; `viaLeave` flag).
- `Dish` = per-meal master list (mealType + name).
- Dates stored as `@db.Date` using **UTC midnight** keys (see helpers) to avoid off-by-one.
- FK cascades set so `user.delete()` cascades children.

Migrations live in `backend/prisma/migrations/`. Create new ones with `npx prisma migrate dev --name <x>`; they auto-apply on Render deploy.

---

## 8. API surface (base `/api/v1`, JWT bearer unless @Public)

```
AUTH     POST /auth/register {fullName,email,password,role?(student|cook),phone?}
         POST /auth/login  POST /auth/refresh  POST /auth/logout
         POST /auth/forgot-password {email}   POST /auth/reset-password {email,code,newPassword}
         POST /auth/change-password   GET /auth/me
USERS    GET /users/me   PATCH /users/me {profile fields + doc keys}
STUDENTS (warden) GET /students  GET /students/:id  POST /students
         GET /students/requests  PATCH /students/:id/approve  PATCH /students/:id/reject {reason}
         DELETE /students/:id    (remove + wipe Cloudinary)
         POST /students/:id/pdf-link -> {token} ; GET /students/:id/pdf?token (Public) -> PDF
UPLOADS  POST /uploads/sign {kind,contentType} -> Cloudinary signed upload payload + key
         GET /uploads/url?key -> signed view URL
MEALS    POST /meals/mark {date,meal(lunch|dinner),marked}   POST /meals/bulk {month,meal,marked}
         GET /meals/me?month   GET /meals/student/:id?month (warden)
         GET /meals/dishes?mealType  POST /meals/dishes  PATCH /meals/dishes/:id  DELETE /meals/dishes/:id
         POST /meals/menu {mealType,dishes[]}   GET /meals/menu (today, all)
         POST /meals/export-link (warden) ; GET /meals/export?token (Public xlsx)
ATTEND   POST /attendance/mark {date,absent}  GET /attendance/me?month  GET /attendance/student/:id (warden)
         POST /attendance/export-link ; GET /attendance/export?token (Public xlsx)
LEAVES   POST /leaves {startDate,endDate,reason}  GET /leaves/me  GET /leaves (warden)
NOTIF    POST /notifications/meal {mealType} (warden+cook)  POST /notifications/announcement (warden)
         GET /notifications  GET /notifications/unread-count  PATCH /notifications/:id/read  POST /notifications/read-all
         POST /device-tokens {platform,token}  DELETE /device-tokens/:token
         GET /notifications/history (warden)
WEBPUSH  GET /web-push/public-key (Public)  POST /web-push/subscribe {subscription}  POST /web-push/unsubscribe
COMPLAINT GET /complaint-categories  POST /complaints  GET /complaints  GET /complaints/:id
         PATCH /complaints/:id (warden)  POST /complaints/:id/replies
NOTICES  GET /notices  POST /notices (warden)
DASH     GET /dashboard/warden  GET /dashboard/student
MISC     GET /health (Public)
```

Exports & PDF use a short-lived signed JWT (`purpose` claim) in a query param so the file opens via a plain browser link (no auth header needed).

---

## 9. Mobile app structure (`mobile/app/` — expo-router)

```
app/_layout.tsx          root: providers + AuthGate (routes by role -> (student)/(warden)/(cook))
app/(auth)/              login, register (Student/Cook toggle, inline msgs), forgot (email->code->new pw)
app/(student)/           _layout tabs: Home, Meals(calendar+menu card), Attend, Complaints, Notices, Profile
app/(warden)/            _layout tabs: Home(meal-ready+stats), Complaints, Students, Requests, More
                         hidden routes: meal-students, student-meals, attendance-students,
                         student-attendance, leaves, student-profile, menu
app/(cook)/              _layout tabs: Kitchen(meal-ready+menu view), Account
app/notifications.tsx    shared inbox (+ "Turn on notifications" web-push banner)
mobile/src/components/    ui, primitives(skeleton/empty/badge), MonthCalendar, MealDayModal,
                          form(DateField/SelectField), HeaderLogo
mobile/src/lib/           api(axios+401 refresh), config(API url), storage(secure), theme, upload(Cloudinary)
mobile/src/notifications/ register(native push), webpush(VAPID)
mobile/public/            sw.js (web push SW), manifest.json, icon.png
```

Delivery: **JS changes ship via OTA** (`npx eas-cli update --branch preview`) — no rebuild. **Native changes** (new native module, app.json native fields) need `eas build --profile preview --platform android` + reinstall. Web auto-deploys on git push (Cloudflare).

---

## 10. How to run locally

```bash
# Backend
cd backend
cp .env.example .env        # set DATABASE_URL + secrets (see §4)
npm install
npx prisma generate
npx prisma migrate deploy   # or migrate dev
npm run start:dev           # http://localhost:3000/api/v1

# Mobile (dev)
cd mobile
npm install
npm run go                  # auto-detects LAN IP, binds Metro, prints exp:// URL (for phone)
#   or: npx expo start --dev-client   (needs the installed dev/preview APK)
#   or: npx expo start --web          (browser)
```
⚠️ **The local `backend/.env` currently points at the PROD Neon DB.** Running the backend locally reads/writes production. For safe local dev, point `DATABASE_URL` at a local Postgres and reseed. (Backlog item #1.)

Build tooling gotchas (already handled, keep in mind):
- Backend `tsconfig`: `incremental:false`, `rootDir:./src`, exclude prisma — else `deleteOutDir`+cache emits nothing / nests `dist/src/main.js`.
- Render needs `npm install --include=dev` (prod prune drops nest/tsc). `prisma`+`ts-node` moved to runtime deps.
- Web build: babel plugin rewrites `import.meta`→`({})` (zustand crashes classic web bundle otherwise). `scripts/patch-html.js` injects PWA meta. SPA fallback via `wrangler.toml` `not_found_handling`.

---

## 11. Known gotchas / operational notes

- **Render free sleeps** → first request after idle is slow (~30-50s); curl/tests may time out on cold start — retry. `/health` cron keeps it warm.
- **Render blocks SMTP** → email uses Brevo HTTP API (port 443). Don't reintroduce nodemailer/SMTP.
- **iOS push** only works in an **installed PWA** (Add to Home Screen, iOS 16.4+) — not a Safari tab. Android APK uses FCM.
- **Email fire-and-forget**: `forgot-password` doesn't await the send (so the HTTP response is instant); errors go to Render logs.
- **Mail sender** must equal the Brevo-verified sender or sends fail.
- Password reset only emails **registered** addresses (silent no-op otherwise, to avoid leaking).
- LF→CRLF git warnings on Windows are harmless.
- Test warden creds from older chats (`warden@hostel.test`) are **gone** — prod was wiped. Current warden = `sunilmaheshvari3@gmail.com`.

---

## 12. Immediate TODO before/at handoff

1. Sunil logs in → Forgot password → sets his own password.
2. **Rotate** the exposed Gmail app password (`nqxtejnttjvbtodq`) — unused but leaked.
3. **Rebuild + reshare the Android APK** so students get document upload (image-picker is native, not in the last APK): `cd mobile && eas build --profile preview --platform android`. Web already has it.
4. Delete leftover `SMTP_*` env vars on Render (harmless).

---

## 13. Backlog (ranked, not yet built)

**High value, low effort**
1. Prod cleanup + **DB separation** (point local `.env` at a local Postgres so dev stops writing to prod).
2. **Fee/rent tracking** (monthly dues, mark paid, Excel export — mirrors meals/attendance pattern).
3. **Notice upgrades** (image attach, pin/expiry, category filter).

**Medium**
4. Complaint upgrades (photo upload to Cloudinary like profile docs, assign to staff, priority filter, resolve-with-note).
5. Warden **dashboard analytics** (charts: attendance %, meal trends, complaints by category — nicer on web).
6. Search + filters across students/complaints/leaves.

**Larger**
7. Desktop-optimized warden web layout (sidebar + wide tables vs centered mobile).

**Ops/hardening**
8. Rate limiting on auth, account lockout, email verification.

---

## 14. Git

Branch `main`, auto-deploys (Render + Cloudflare). Commit style: conventional (`feat:`/`fix:`/`chore:`), co-author trailer used. After changes: `git add -A && git commit && git push`, then for mobile JS also `npx eas-cli update --branch preview`.

Latest commit at handoff: `feat(cleanup): daily retention cron to keep free-tier DB small`.
