# Hostel Management System (HMS) — MVP

Native mobile app (Android + iOS) + REST API for hostel operations. Fast MVP: **meal-ready push, meal attendance, complaints, notices, auth**.

Full product design: [`HOSTEL_MANAGEMENT_SYSTEM_DESIGN.md`](./HOSTEL_MANAGEMENT_SYSTEM_DESIGN.md).

```
MHM/
├── backend/   NestJS + Prisma + PostgreSQL  (API)
└── mobile/    React Native + Expo           (Android + iOS app)
```

---

## Prerequisites

- Node 18+ (tested on 24)
- PostgreSQL running locally (or a hosted URL)
- Expo Go app on your phone, OR Android/iOS simulator

---

## 1. Backend

```bash
cd backend
cp .env.example .env          # then edit DATABASE_URL + JWT secrets
npm install
npm run prisma:generate
npm run prisma:migrate        # creates tables (name it e.g. "init")
npm run db:seed               # seeds 1 hostel, warden, 3 students, categories
npm run start:dev             # http://localhost:3000/api/v1
```

**Seeded logins** (password `Password123!`):
- Warden: `warden@hostel.test`
- Student: `aarav@hostel.test`

Smoke test:
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"warden@hostel.test","password":"Password123!"}'
```

---

## 2. Mobile app

```bash
cd mobile
npm install
npm start                     # scan QR with Expo Go, or press a/i for sim
```

API URL config: `mobile/app.json` → `extra.apiUrl`.
- iOS sim: `localhost` works.
- Android emulator: auto-rewrites to `10.0.2.2`.
- **Physical phone:** set `apiUrl` to your PC LAN IP, e.g. `http://192.168.1.5:3000/api/v1`. Phone + PC same Wi-Fi.

---

## Demo flow

1. Login warden on one device/sim → tap **🍛 Lunch** → push fan-out fires.
2. Login student on second device → gets alert, marks meal, sees monthly %.
3. Student files complaint → warden sees it, advances status → resolved.
4. Warden posts notice → students notified + appears in Notices tab.

> Push needs physical device (simulators skip token). Without it, meal-ready still logs server-side + updates in-app — flow testable end-to-end.

---

## What's in / out (v1)

**In:** auth (JWT + refresh + reset), RBAC (warden/student), meal-ready push, notifications inbox + history, meal attendance + stats, complaints (photo URLs, triage, replies), notices, dashboards.

**Out (deferred, schema-ready):** fees/payments, leave, rooms/beds, visitors/QR, maintenance, inventory, feedback analytics, SOS, reports/PDF, web dashboard, multi-hostel admin. See design doc §0.5.

---

## Tech

Backend: NestJS 10, Prisma 5, PostgreSQL, Passport-JWT, argon2, expo-server-sdk (push), helmet.
Mobile: Expo 51, Expo Router, TanStack Query, Zustand, axios, expo-secure-store, expo-notifications.

## Next steps

- `prisma migrate` against real Postgres (seed assumes DB reachable).
- Real push: build with EAS + FCM/APNs creds (see design doc §16).
- Add deferred modules one sprint at a time — each is additive.
