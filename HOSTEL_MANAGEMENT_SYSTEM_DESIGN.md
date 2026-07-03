# Hostel Management System (HMS) — Product & Architecture Design

**Version:** 1.0
**Prepared as:** Senior PM + UX Designer + Full-Stack Architect
**Scope:** Multi-hostel, multi-tenant SaaS capable of serving thousands of students.

---

## 0. Executive Summary

A modern Hostel Management System that digitizes the day-to-day operations of a hostel: meals, complaints, leave, attendance, fees, maintenance, visitors, and communication. Built as a **multi-tenant, RBAC-driven, API-first** application with a mobile-responsive web app and optional native mobile app, real-time notifications, and analytics.

> **Client platform:** A **native mobile app** for **Android and iOS from a single codebase (React Native + Expo)** — not a website. Both warden and student use the same app. **No web dashboard in v1** — it's deferred to post-launch (see §0.5). The app is fully standalone.

> **🚀 Build strategy: ship a fast MVP first.** This document describes the full product, but v1 deliberately ships only the core loop (see **§0.5 Fast MVP Scope**). Everything else in this doc is designed so it can be layered on later against the same database schema and API — nothing here is throwaway.

**Design principles**
1. **Mobile-first, native app** — real device push (works when the app is closed), biometric login, camera, QR scanning, and offline support are first-class, not afterthoughts.
2. **API-first** — every feature is an API; the mobile app is a thin client (a future web dashboard reuses the same API).
3. **Multi-tenant from day one** — a `hostel_id` scopes almost every row so one backend can serve many hostels.
4. **RBAC with future room for granular permissions** — Warden and Student now; Super-Admin, Sub-Warden, Mess-Manager, Security, Maintenance-Staff later.
5. **Event-driven notifications** — one domain event (e.g. `MEAL_READY`) fans out to device push (FCM/APNs), in-app, email, SMS.
6. **Auditable** — sensitive actions (fee edits, leave approvals, room changes) are logged.

---

## 0.5 Fast MVP Scope (v1 — ship this first)

**Goal:** get the core hostel loop into students' and the warden's hands in ~4 focused sprints, one mobile app, one backend. App-only (no web dashboard). Prove the headline feature (**meal-ready push**) in the real world, then expand.

### ✅ IN — v1 MVP (the must-haves)
| # | Feature | Why it's in |
|---|---------|-------------|
| 1 | **Auth** — login, logout, forgot/reset password, role-based routing | Nothing works without it |
| 2 | **Profiles** — view/edit own profile, change password | Basic identity |
| 3 | **Meal-ready push** 🍳🍛🌙 — warden one-tap → instant push to all students | **The headline feature** — biggest value, low effort |
| 4 | **Notifications** — device push (FCM/APNs) + in-app inbox + history | Backbone; also carries announcements |
| 5 | **Announcements / Notices** — warden posts, students get push + feed | Reuses the notification pipe; near-free once #4 exists |
| 6 | **Meal attendance** — student self-marks B/L/D, monthly stats ("15/30 days — 50%") | Core requested feature, self-contained |
| 7 | **Complaints** — submit (category, description, photo), track status; warden triages + replies | High daily value, self-contained |
| 8 | **Dashboards** — warden counts + quick actions; student home summary | Ties it together |

That's the complete core loop: **communicate → eat → complain → track.**

### ⏳ OUT — deferred to v1.1+ (design already done, add later)
Room/bed allocation · Leave management · Daily attendance/check-in · **Fees & online payments** · Visitor management + QR · Maintenance module · Inventory · Feedback analytics · Emergency/SOS · Events · Reports/PDF export · Multi-hostel super-admin · **Web dashboard**.

> These are intentionally cut from v1 **only** — the schema (§5), API (§7), and folder structure (§11) already account for them, so each is an additive change, not a rewrite.

### Scope-trimming decisions that make v1 fast
- **Single hostel to start.** Keep the `hostel_id` column everywhere (multi-tenant-ready) but hard-code/seed one hostel. Skip the super-admin console.
- **Warden creates students** (or CSV seed script) — skip self-registration, email verification, and bulk-import UI for now.
- **Push + in-app only** for notifications — **defer email/SMS** channels (no SendGrid/Twilio wiring in v1).
- **No payments** — the biggest single time-sink (gateway, webhooks, receipts, reconciliation). Add in a dedicated later sprint.
- **No offline sync engine in v1** — just optimistic UI + retry on the meal toggle. Full SQLite sync queue comes with the mobile-polish phase.
- **Images:** direct-to-S3/R2 signed upload for complaints; no thumbnails/EXIF pipeline yet.

### MVP tech stack (unchanged, just the subset you actually wire up)
- **App:** React Native + Expo, Expo Router, NativeWind, TanStack Query + Zustand, expo-notifications, expo-secure-store.
- **Backend:** NestJS + Postgres + Prisma + Redis/BullMQ (for the push fan-out job) + S3/R2.
- **Push:** Expo Push → FCM (Android) + APNs (iOS).
- **Deploy:** API on Render/Railway; app via **EAS Build → TestFlight + Play Internal testing** first, then store submission.

### MVP database tables (the subset to build first)
`hostels`, `users`, `student_profiles`, `refresh_tokens`, `password_resets`,
`notifications`, `notification_recipients`, `device_tokens`,
`meal_sessions`, `meal_attendance`,
`complaints`, `complaint_categories`, `complaint_replies`, `complaint_attachments`,
`notices`, `audit_logs`.
*(All other tables from §5 are added when their feature lands.)*

### MVP API surface (the subset)
`/auth/*` · `/users/me` · `/students` (warden create/list) ·
`/notifications/meal` · `/notifications` · `/device-tokens` ·
`/meals/attendance` · `/meals/stats/me` · `/meals/stats` ·
`/complaints/*` · `/complaint-categories` ·
`/notices` · `/dashboard/warden` · `/dashboard/student`.

### Fast-MVP sprint plan (~4 sprints)
| Sprint | Deliverable |
|--------|-------------|
| **1** | Backend skeleton (NestJS, Prisma, MVP schema, auth + RBAC), Expo app shell with role-based tabs, login + profile |
| **2** | Notifications core: device-token registration, **meal-ready quick actions**, push fan-out job, in-app inbox + history, announcements |
| **3** | Meal attendance + monthly stats; Complaints (submit + photo + status + warden triage/reply) |
| **4** | Warden & student dashboards, polish, hardening, **EAS build → internal testing → store submission** |

**Definition of done for v1:** a warden taps "🍛 Lunch Ready" and every student's phone buzzes; students mark meals and see their monthly %, file a complaint with a photo and watch it move to Resolved, and read announcements — all in a store-installable Android + iOS app.

---

## 1. Feature List (Basic / Intermediate / Advanced)

### Basic (MVP — ship first)
- Authentication (login, logout, password reset, JWT sessions)
- Role-based dashboards (Warden / Student)
- Profile management
- **Meal-ready notifications** (Breakfast / Lunch / Dinner quick actions)
- In-app + push notifications, notification history
- Complaint submission + status tracking (Pending → In Progress → Resolved → Closed)
- Meal attendance marking + monthly stats
- Notice board / announcements
- Warden dashboard widgets (counts)

### Intermediate
- Room & bed allocation, occupancy view, room transfer requests
- Leave management (apply / approve / calendar / export)
- Daily hostel attendance, check-in / check-out
- Fee management (invoices, payment history, due reminders, receipts)
- Maintenance module (categorized tickets, assignment, completion tracking)
- Visitor management (entry, approval, history)
- Feedback system (food, cleanliness, Wi-Fi, staff, facilities) + analytics
- Reports & analytics dashboards with charts
- Image uploads (complaints, maintenance, profile)

### Advanced
- Online fee payment (Razorpay / Stripe) + auto receipts
- QR-based visitor pass + QR-based gate attendance
- Emergency / SOS module with live location + auto-alert to warden & security
- Push notifications via FCM/APNs, email (SES/SendGrid), SMS (Twilio)
- Multi-hostel super-admin console
- Inventory & asset management with damage reporting
- Digital Hostel ID card (QR)
- Biometric / RFID gate integration (hardware webhook)
- AI: complaint auto-categorization & priority, feedback sentiment analysis
- Offline-first mobile app with sync
- Audit logs, data export (CSV/PDF), scheduled monthly reports

---

## 2. User Roles & RBAC

| Role | Description | Key Capabilities |
|------|-------------|------------------|
| **Super Admin** (future) | Owns the platform / multiple hostels | Create hostels, manage wardens, global analytics, billing |
| **Warden (Admin)** | Full control of one hostel | All management modules, approvals, notifications, reports |
| **Sub-Warden / Staff** (future) | Delegated warden | Scoped subset via permissions |
| **Mess Manager** (future) | Meals only | Trigger meal-ready, view meal attendance |
| **Security** (future) | Gate | Visitor check-in/out, gate attendance, SOS receipt |
| **Student** | End user | Own profile, meals, complaints, leave, fees, notices |

**Permission model:** Start with a simple `role` enum. Design the DB so you can migrate to `roles` + `permissions` + `role_permissions` (many-to-many) without breaking changes — the API already checks a `can(user, 'complaint:resolve')` helper rather than `if role === 'warden'`.

---

## 3. Tech Stack Recommendation

**Recommended (native mobile app, one codebase for Android + iOS):**

| Layer | Choice | Why |
|-------|--------|-----|
| **Mobile app** | **React Native + Expo (TypeScript)** | One codebase → Android + iOS; built-in push, camera, QR, biometrics, secure storage, and **OTA updates** (ship JS fixes without an app-store review) |
| Navigation | **Expo Router / React Navigation** (bottom tabs + stacks) | Native tab-bar UX, deep links from push notifications |
| App state / data | **TanStack Query** (server cache) + **Zustand** (UI/session) | Caching, background refetch, offline persistence |
| UI kit | **NativeWind** (Tailwind for RN) + **Tamagui** or **RN Paper** | Consistent, themeable, dark mode, accessible components |
| Local storage / offline | **expo-sqlite** + MMKV + a sync queue | Offline meal marking, cached notices, fast startup |
| Device features | expo-notifications, expo-camera / barcode-scanner, expo-local-authentication, expo-secure-store | Push, QR scan, Face ID / fingerprint, Keychain/Keystore |
| Alt. framework | **Flutter (Dart)** | Viable alternative if the team prefers Dart; same architecture applies |
| _Optional web dashboard_ | React + Vite (reuses the API) | Only for warden bulk report exports on desktop — not required |
| Backend | **Node.js + NestJS (TypeScript)** | Opinionated, modular, DI, guards for RBAC, first-class OpenAPI |
| Database | **PostgreSQL** | Relational integrity, JSONB flexibility, row-level security for multi-tenant |
| ORM | **Prisma** (or TypeORM) | Type-safe, migrations |
| Cache / queues | **Redis** + **BullMQ** | Sessions, rate limiting, background jobs (emails, reports) |
| Realtime | **Socket.IO** or **Pusher/Ably** | Instant notifications |
| File storage | **S3 / Cloudflare R2** | Images, receipts, ID cards |
| Search (later) | Postgres FTS → **Meilisearch/Elastic** | Student search at scale |
| Auth | JWT (access+refresh) or **Auth provider** (Clerk/Auth0/Supabase Auth) | Faster to secure |
| Notifications | **FCM (Android) + APNs (iOS)** via **Expo Push**, **SendGrid/SES** (email), **Twilio** (SMS) | Multi-channel; FCM/APNs power the lock-screen "🍛 Lunch is ready" alert |
| Payments | **Razorpay** / **Stripe** in-app SDK | Online fees inside the app |
| Charts | **react-native-gifted-charts** / Victory Native | In-app dashboards |
| App build & release | **EAS Build + EAS Submit** (→ Google Play + App Store), **Expo OTA / EAS Update** | Cloud builds, store submission, instant JS updates |
| Backend infra | Docker + a managed platform (Render/Railway/Fly.io/ECS) → Kubernetes at scale | Progressive |
| CI/CD | GitHub Actions + EAS | Test, build backend + mobile binaries, deploy |
| Observability | Sentry (mobile crash + backend errors), Prometheus + Grafana, structured logs (pino) | Prod-grade |

**Alternative fast-track stack:** React Native (Expo) + **Supabase** (Postgres + Auth + Storage + Realtime) — fewer moving parts, great for a solo dev / quick launch.

---

## 4. System Architecture

```
                       ┌─────────────────────────────┐
                       │   Clients                    │
                       │  📱 Native App (React Native)│
                       │   Android + iOS  (+opt. web) │
                       └───────────────┬──────────────┘
                                       │ HTTPS / WSS
                              ┌────────▼─────────┐
                              │   API Gateway /   │   rate limit, CORS,
                              │   Load Balancer   │   TLS termination
                              └────────┬─────────┘
                                       │
                 ┌─────────────────────┼─────────────────────┐
                 │                     │                      │
          ┌──────▼──────┐      ┌───────▼───────┐      ┌───────▼───────┐
          │  REST API    │      │  WebSocket    │      │  Webhooks     │
          │  (NestJS)    │      │  Gateway      │      │  (payments,   │
          │  Auth,RBAC   │      │  (realtime)   │      │  gate/RFID)   │
          └──┬────────┬──┘      └───────┬───────┘      └───────┬───────┘
             │        │                 │                      │
        ┌────▼───┐ ┌──▼─────┐    ┌──────▼──────┐        ┌──────▼──────┐
        │Postgres│ │ Redis  │    │ Redis Pub/Sub│        │ Job Queue   │
        │(primary│ │(cache, │    │ (fan-out)    │        │ (BullMQ):   │
        │ + read │ │session)│    └─────────────┘        │ email,sms,  │
        │ replica│ └────────┘                            │ push,reports│
        └────────┘                                       └──────┬──────┘
                                                                │
                         ┌──────────────────────────────────────┼───────┐
                         │              External services        │       │
                         │  S3/R2  FCM/APNs  SendGrid  Twilio  Razorpay  │
                         └───────────────────────────────────────────────┘
```

**Notification flow (event-driven, device push):**
```
Warden taps "🍛 Lunch Ready" in the app
  → POST /notifications/meal { type: "lunch" }      (API returns 200 instantly)
  → API writes a notifications row + recipient rows  (history / fan-out)
  → job enqueued in Redis + BullMQ                   (decoupled = API stays fast)
  → worker batches all students' Expo/FCM/APNs tokens → multicast push
  → students' phones buzz with "Lunch is ready 🍛"   (works even if app is closed)
  → tapping the push deep-links into "Today's Meal" screen; also shown in-app via WebSocket.
```
Queuing keeps the endpoint instant regardless of whether there are 50 or 5,000 students. Delivery + read receipts are tracked per recipient.

---

## 5. Database Schema (PostgreSQL)

> Conventions: `id UUID PK`, `created_at`, `updated_at`, soft-delete `deleted_at` where useful. Almost every table carries `hostel_id` for multi-tenancy. Money stored as integer minor units (paise/cents).

### Core / Auth
```sql
hostels(id, name, code, address, city, contact_email, contact_phone,
        logo_url, timezone, settings JSONB, created_at, updated_at)

users(id, hostel_id FK, role ENUM('super_admin','warden','staff','student'),
      full_name, email UNIQUE, phone, password_hash, avatar_url,
      status ENUM('active','inactive','suspended'),
      email_verified_at, last_login_at, created_at, updated_at, deleted_at)

-- future granular RBAC
permissions(id, key, description)
role_permissions(role, permission_id)

refresh_tokens(id, user_id FK, token_hash, expires_at, revoked_at, user_agent, ip)
password_resets(id, user_id FK, token_hash, expires_at, used_at)
audit_logs(id, hostel_id, actor_user_id, action, entity_type, entity_id,
           metadata JSONB, ip, created_at)
```

### Student / Room
```sql
student_profiles(id, user_id FK UNIQUE, hostel_id FK, roll_no, course, year,
                 department, guardian_name, guardian_phone, blood_group,
                 emergency_contact, address, dob, gender, photo_url,
                 admission_date, hostel_id_card_no, created_at, updated_at)

rooms(id, hostel_id FK, room_number, floor, block, room_type ENUM('single','double','triple','dormitory'),
      capacity INT, status ENUM('available','occupied','full','maintenance','reserved'),
      rent_amount INT, created_at, updated_at)

beds(id, room_id FK, bed_label, status ENUM('vacant','occupied','maintenance'))

room_allocations(id, hostel_id, room_id FK, bed_id FK, student_id FK,
                 allocated_by, from_date, to_date NULL, status ENUM('active','vacated'),
                 created_at)

room_transfer_requests(id, student_id FK, current_room_id, requested_room_id NULL,
                       reason, status ENUM('pending','approved','rejected'),
                       reviewed_by, review_note, created_at, updated_at)
```

### Notifications
```sql
notifications(id, hostel_id, type ENUM('meal','announcement','emergency',
              'maintenance','event','individual','fee','leave','complaint'),
              title, body, data JSONB, priority ENUM('low','normal','high','critical'),
              audience ENUM('all','individual','room','block','custom'),
              created_by, created_at)

notification_recipients(id, notification_id FK, user_id FK,
                        read_at NULL, delivered_at NULL, channel_status JSONB)

device_tokens(id, user_id FK, platform ENUM('web','android','ios'), token, created_at)
```

### Complaints & Maintenance
```sql
complaint_categories(id, hostel_id, name, default_priority)

complaints(id, hostel_id, student_id FK, category_id FK, title, description,
           status ENUM('pending','in_progress','resolved','closed'),
           priority ENUM('low','medium','high','urgent'),
           assigned_to NULL, resolved_at, created_at, updated_at)

complaint_attachments(id, complaint_id FK, file_url, uploaded_by, created_at)

complaint_replies(id, complaint_id FK, author_id, message, is_internal BOOL, created_at)

maintenance_tickets(id, hostel_id, raised_by, room_id NULL,
                    category ENUM('fan','light','water','wifi','cleaning','plumbing','electrical','other'),
                    description, status ENUM('open','assigned','in_progress','completed','cancelled'),
                    priority, assigned_to NULL, completed_at, created_at, updated_at)

maintenance_attachments(id, ticket_id FK, file_url, created_at)
```

### Meals
```sql
meal_sessions(id, hostel_id, date, meal_type ENUM('breakfast','lunch','dinner'),
              ready_marked_at, marked_by, menu TEXT)   -- created when warden clicks "ready"

meal_attendance(id, hostel_id, student_id FK, date, meal_type,
                status ENUM('present','absent','opted_out'),
                marked_at, source ENUM('self','qr','staff'),
                UNIQUE(student_id, date, meal_type))
```

### Leave & Attendance
```sql
leave_requests(id, hostel_id, student_id FK, type ENUM('home','medical','emergency','other'),
               reason, from_date, to_date, status ENUM('pending','approved','rejected','cancelled'),
               reviewed_by, review_note, contact_during_leave, created_at, updated_at)

attendance(id, hostel_id, student_id FK, date, check_in_at, check_out_at,
           status ENUM('present','absent','on_leave','late'), source, created_at,
           UNIQUE(student_id, date))
```

### Visitors
```sql
visitors(id, hostel_id, student_id FK, visitor_name, relationship, phone,
         id_proof_type, id_proof_no, purpose, expected_at,
         status ENUM('requested','approved','rejected','checked_in','checked_out'),
         pass_qr_token, approved_by, check_in_at, check_out_at, created_at)
```

### Fees & Payments
```sql
fee_structures(id, hostel_id, name, amount INT, frequency ENUM('monthly','quarterly','yearly','one_time'),
               due_day INT, active BOOL)

invoices(id, hostel_id, student_id FK, fee_structure_id, amount INT,
         due_date, status ENUM('pending','partial','paid','overdue','waived'),
         period_label, created_at)

payments(id, invoice_id FK, student_id, amount INT, method ENUM('cash','upi','card','netbanking'),
         gateway ENUM('razorpay','stripe','manual'), gateway_ref, status,
         receipt_url, paid_at, recorded_by, created_at)
```

### Inventory, Feedback, Events, Emergency
```sql
inventory_items(id, hostel_id, name, category ENUM('furniture','electrical','appliance','other'),
                room_id NULL, quantity, condition ENUM('good','damaged','needs_repair'),
                purchase_date, cost INT, created_at)

inventory_damage_reports(id, item_id FK, reported_by, description, photo_url, status, created_at)

feedback(id, hostel_id, student_id, category ENUM('food','cleanliness','wifi','staff','facilities'),
         rating INT CHECK 1..5, comment, created_at)

notices(id, hostel_id, title, body, category ENUM('announcement','event','holiday','rules','exam'),
        pinned BOOL, published_at, expires_at, created_by, created_at)

events(id, hostel_id, title, description, starts_at, ends_at, location, created_by)

emergency_alerts(id, hostel_id, student_id, type ENUM('sos','medical','fire','other'),
                 location JSONB, status ENUM('active','acknowledged','resolved'),
                 acknowledged_by, created_at, resolved_at)

emergency_contacts(id, hostel_id, label, phone, type)  -- warden, security, medical, fire
```

---

## 6. Entity Relationship Diagram (textual ERD)

```
hostels ──1:N── users
users ──1:1── student_profiles
users ──1:N── device_tokens, refresh_tokens, audit_logs(actor)

hostels ──1:N── rooms ──1:N── beds
rooms ──1:N── room_allocations ──N:1── student_profiles
student_profiles ──1:N── room_transfer_requests

hostels ──1:N── notifications ──1:N── notification_recipients ──N:1── users

student_profiles ──1:N── complaints ──1:N── complaint_replies
complaints ──1:N── complaint_attachments
complaint_categories ──1:N── complaints

hostels ──1:N── maintenance_tickets ──1:N── maintenance_attachments

hostels ──1:N── meal_sessions
student_profiles ──1:N── meal_attendance   (UNIQUE per student/date/meal)

student_profiles ──1:N── leave_requests
student_profiles ──1:N── attendance        (UNIQUE per student/date)

student_profiles ──1:N── visitors

fee_structures ──1:N── invoices ──1:N── payments
student_profiles ──1:N── invoices

hostels ──1:N── inventory_items ──1:N── inventory_damage_reports
hostels ──1:N── feedback, notices, events, emergency_alerts, emergency_contacts
student_profiles ──1:N── emergency_alerts
```

---

## 7. REST API Endpoints

> Base: `/api/v1`. Auth via `Authorization: Bearer <accessToken>`. All list endpoints support `?page&limit&sort&filter`. Responses: `{ data, meta }`. Errors: `{ error: { code, message, details } }`.

### Auth
```
POST   /auth/login                 { email, password } -> { accessToken, refreshToken, user }
POST   /auth/refresh               { refreshToken }
POST   /auth/logout
POST   /auth/forgot-password       { email }
POST   /auth/reset-password        { token, newPassword }
POST   /auth/change-password       { oldPassword, newPassword }
GET    /auth/me
```

### Users / Profile / Students
```
GET    /users/me
PATCH  /users/me                   (profile update)
GET    /students                   (warden; search: ?q, ?room, ?year)  
POST   /students                   (warden creates / imports)
GET    /students/:id
PATCH  /students/:id
GET    /students/:id/id-card       -> ID card (QR) PDF/PNG
```

### Rooms
```
GET    /rooms                      ?status&floor&block
GET    /rooms/:id
POST   /rooms                      (warden)
PATCH  /rooms/:id
POST   /rooms/:id/allocate         { studentId, bedId }
POST   /rooms/:id/vacate           { studentId }
GET    /rooms/:id/history
POST   /room-transfers             (student request)
GET    /room-transfers             (warden list)
PATCH  /room-transfers/:id         { status, note }
```

### Notifications  ⭐ (meal quick-actions)
```
POST   /notifications/meal         { mealType: 'breakfast'|'lunch'|'dinner', menu? }  -> fan-out to all students
POST   /notifications              { type, title, body, audience, targetIds?, priority }
GET    /notifications              (current user's inbox)  ?unread=true
PATCH  /notifications/:id/read
POST   /notifications/read-all
GET    /notifications/history      (warden; sent history)
POST   /device-tokens              { platform, token }
DELETE /device-tokens/:token
```

### Complaints
```
POST   /complaints                 { categoryId, title, description, attachments[] }
GET    /complaints                 (student: own; warden: all + ?status&priority&category)
GET    /complaints/:id
PATCH  /complaints/:id             (warden: status, priority, assignedTo)
POST   /complaints/:id/replies     { message }
GET    /complaint-categories
```

### Meals
```
POST   /meals/attendance           { date, meals: ['breakfast','lunch'], status }  (student self-mark)
GET    /meals/attendance/me        ?month=2026-07
GET    /meals/stats/me             ?month  -> { taken, skipped, percentage, byMeal }
GET    /meals/stats                 (warden) ?month&studentId
GET    /meals/sessions             ?date
```

### Leave & Attendance
```
POST   /leaves                     { type, reason, fromDate, toDate, contact }
GET    /leaves                     (student own / warden all) ?status
PATCH  /leaves/:id                 (warden: approve/reject)
GET    /leaves/calendar            ?month
GET    /leaves/export              ?from&to  -> CSV
POST   /attendance/check-in
POST   /attendance/check-out
GET    /attendance                 ?date&studentId
GET    /attendance/report          ?month  -> monthly report
```

### Visitors
```
POST   /visitors                   (student requests) { visitorName, relationship, phone, purpose, expectedAt }
GET    /visitors                   ?status
PATCH  /visitors/:id               (warden approve/reject)
POST   /visitors/:id/check-in      (security; validates QR)
POST   /visitors/:id/check-out
GET    /visitors/:id/pass          -> QR pass
```

### Fees
```
GET    /fees/invoices              (student own / warden all) ?status
GET    /fees/invoices/:id
POST   /fees/invoices              (warden create / bulk generate)
POST   /fees/invoices/:id/pay      { method } -> creates payment / gateway order
POST   /fees/webhook/razorpay      (payment confirmation)
GET    /fees/payments/:id/receipt  -> PDF
GET    /fees/summary               (warden dashboard)
```

### Maintenance / Inventory / Feedback / Notices / Emergency
```
POST   /maintenance                { category, description, roomId, attachments[] }
GET    /maintenance                ?status&category
PATCH  /maintenance/:id            (assign / complete)

GET    /inventory                  ?category&roomId
POST   /inventory
POST   /inventory/:id/damage       { description, photo }

POST   /feedback                   { category, rating, comment }
GET    /feedback/analytics         (warden) -> avg ratings, trends

GET    /notices                    ?category
POST   /notices                    (warden)
GET    /events

POST   /emergency/sos              { type, location } -> alerts warden+security instantly
GET    /emergency/alerts           (warden) ?status
PATCH  /emergency/alerts/:id       (acknowledge/resolve)
GET    /emergency/contacts
```

### Reports & Analytics
```
GET    /dashboard/warden           -> aggregated widget data (counts, today's meals, pending complaints...)
GET    /dashboard/student          -> personalized summary
GET    /reports/monthly            ?month -> full monthly report (JSON/PDF)
GET    /reports/occupancy
GET    /reports/meals
GET    /reports/complaints
```

---

## 8. Authentication Flow

```
1. Login: POST /auth/login → verify password (bcrypt/argon2)
   → issue short-lived accessToken (JWT, 15 min) + long-lived refreshToken (7–30 d)
   → tokens stored in the device secure enclave (expo-secure-store → iOS Keychain / Android Keystore),
     NOT in plain AsyncStorage. Optional biometric (Face ID / fingerprint) gate to unlock the app.
   → refreshToken hash stored server-side (rotation + revocation).
2. Requests: send accessToken. NestJS AuthGuard verifies signature/expiry;
   RolesGuard / PermissionsGuard checks role/permission for the route.
3. Refresh: on 401, client calls /auth/refresh with refreshToken → new access (+ rotated refresh).
4. Logout: revoke refreshToken.
5. Password reset: forgot-password → email one-time token (hashed, 30 min TTL) → reset-password.
6. Multi-tenant scoping: JWT carries { userId, role, hostelId }; every query filters by hostelId
   (enforced in a Prisma middleware / Postgres Row-Level Security).
```

2. On app launch: read stored refresh token → (optional biometric prompt) → silently refresh access token → land on the role-based tab navigator. If no valid token → Login screen.
3. Push registration: after login the app requests notification permission, gets an Expo/FCM/APNs token, and `POST /device-tokens` so the backend can target this device.

Add later: email verification, 2FA (TOTP/OTP), device management, account lockout after N failed attempts.

---

## 9. UI/UX Flows (native mobile)

**App navigation shell:** a **bottom tab bar** (not a sidebar). Each tab is a native stack. Push notifications **deep-link** straight to the relevant screen.
- **Warden tabs:** Home · Complaints · Students · Reports · More
- **Student tabs:** Home · Meals · Complaints · Notices · Profile
- Modal actions use **bottom sheets**; confirmations use native action sheets; feedback via toasts/haptics.

### Auth flow
`Splash → check secure-store token → (optional Face ID / fingerprint) → Role check → Warden tabs | Student tabs`
`First login → force Change password. Forgot password → email OTP/reset link → new password → Login.`

### Student core journeys
- **Mark meal:** Home → "Today's Meal" card → tap Breakfast/Lunch/Dinner toggles or "I had today's meal" → optimistic save (works **offline**, syncs later) → monthly bar updates.
- **Complaint:** Complaints tab → + → pick category → describe → attach photos **from camera/gallery** → submit → status timeline → push on reply/resolve.
- **Leave:** Home/More → Apply Leave → date pickers + reason → submit → status chip → push on decision.
- **Receive meal-ready:** Warden triggers → student's phone buzzes with lock-screen push "Lunch is ready 🍛" → tap → deep-links into Today's Meal.

### Warden core journeys
- **Meal ready:** Home → tap Quick-Action tile (🍳/🍛/🌙) → confirmation bottom sheet (optional menu text) → instant push fan-out → toast "Notified 248 students".
- **Complaint triage:** Complaints tab → filter chips (status/priority) → open → set priority / assign staff → reply → mark resolved.
- **Leave approval:** More → Leave requests → open → Approve/Reject with note → calendar updates.
- **Room allocation:** Students/More → Rooms → select room → allocate student to bed → occupancy updates.
- **Visitor / QR:** open camera → **scan visitor QR pass** → check-in/out recorded.

---

## 10. Screen-by-Screen UI Description

> All screens are **native mobile screens** in a bottom-tab + stack navigator, mobile-portrait first, with pull-to-refresh, swipe actions, bottom sheets, skeleton loaders, and haptic feedback.

### Shared
- **Splash / biometric unlock** — logo → Face ID / fingerprint prompt (if enabled) → auto-login.
- **Login** — logo, email, password, "Forgot password?", "Enable biometric login" toggle.
- **Notifications screen** — bell icon w/ unread badge in header; list with type icons, time, read/unread; pull-to-refresh; "mark all read"; tapping deep-links to the source item.
- **Profile** — avatar, editable personal info, change password, notification preferences, biometric toggle, device/session list, logout.

### Warden
1. **Home (dashboard)** — scrollable stat cards: *Total Students, Occupied Rooms, Vacant Rooms, Today's Meals (B/L/D counts), Pending Complaints, Leave Requests*. Below: a **Quick-Action tile grid** (🍳 Breakfast / 🍛 Lunch / 🌙 Dinner Ready, 📢 New Notice, 📢 Announcement, 🚨 Emergency Broadcast). Native charts: occupancy donut, meals-this-week line, complaints-by-status bar. Recent activity feed.
2. **Students** — searchable/filterable table; row → detail (profile, room, fees, complaints, meal %). Bulk import (CSV).
3. **Rooms** — grid/floor view color-coded by status; click room → beds, occupants, allocate/vacate, history, maintenance flag.
4. **Complaints** — kanban (Pending/In Progress/Resolved/Closed) or table w/ filters; detail w/ replies, priority, assignee, attachments.
5. **Meals** — daily attendance overview; per-student monthly stats; export.
6. **Leave** — request list + calendar view; approve/reject; export.
7. **Attendance** — daily check-in/out board; monthly report.
8. **Visitors** — pending approvals, active visitors, history, QR validation.
9. **Fees** — invoices, dues, collections chart, generate invoices, record/verify payments, receipts.
10. **Maintenance** — tickets board, assign staff, track completion.
11. **Inventory** — asset list per room, damage reports.
12. **Notices/Events** — composer + list; schedule/pin.
13. **Feedback analytics** — average ratings, trend lines per category.
14. **Reports** — filter by month; downloadable PDF/CSV; charts.
15. **Emergency** — live active alerts, acknowledge/resolve, contacts.

### Student
1. **Home** — greeting; **Today's Meal** toggle card; **Room details** card; **Notifications** (today); **Complaint status** mini-list; **Leave status**; **Monthly meal report** bar ("15/30 days — 50%"); **Notices** feed; **Upcoming events**; a persistent **SOS** floating button.
2. **Meals** — calendar heatmap of attendance + monthly stats.
3. **Complaints** — list + New complaint form + status timeline.
4. **Leave** — apply + history + status.
5. **Fees** — dues, pay now, payment history, receipts.
6. **Maintenance** — report issue + track.
7. **Visitors** — request a visitor + QR pass + history.
8. **Notices** — full board.
9. **Feedback** — rate categories.
10. **ID Card** — digital QR ID.
11. **Profile / Settings** — edit, notification preferences, change password.

**Design system:** NativeWind (Tailwind for RN) + a native component kit, 8-pt spacing, accessible color contrast (WCAG AA), light/dark mode following the OS theme, skeleton loaders, toasts + haptics, empty states, **bottom-tab navigation for both roles**, safe-area aware layouts, and platform-adaptive components (iOS vs Android date pickers, action sheets).

---

## 11. Folder Structure

### Backend (NestJS)
```
backend/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── common/            # guards, interceptors, filters, decorators, pipes
│   │   ├── guards/        # AuthGuard, RolesGuard, PermissionsGuard, TenantGuard
│   │   ├── decorators/    # @CurrentUser, @Roles, @Permissions
│   │   └── filters/       # HttpExceptionFilter
│   ├── config/            # env, database, redis, storage configs
│   ├── modules/
│   │   ├── auth/
│   │   ├── users/
│   │   ├── students/
│   │   ├── rooms/
│   │   ├── notifications/ # + gateway (websocket), meal quick-action service
│   │   ├── complaints/
│   │   ├── meals/
│   │   ├── leaves/
│   │   ├── attendance/
│   │   ├── visitors/
│   │   ├── fees/
│   │   ├── maintenance/
│   │   ├── inventory/
│   │   ├── feedback/
│   │   ├── notices/
│   │   ├── emergency/
│   │   └── reports/
│   ├── jobs/              # BullMQ processors (email, sms, push, reports)
│   ├── realtime/          # socket gateway, redis pub/sub
│   └── prisma/            # prisma service
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── test/
├── Dockerfile
└── package.json
```

### Mobile App (React Native + Expo, Android + iOS)
```
mobile/
├── app/                        # Expo Router — file-based navigation
│   ├── _layout.tsx             # root: providers, auth gate, theme
│   ├── (auth)/                 # login, forgot-password, reset
│   ├── (warden)/               # warden bottom-tab navigator
│   │   ├── _layout.tsx         # tabs: Home, Complaints, Students, Reports, More
│   │   ├── index.tsx           # Home (dashboard + quick actions)
│   │   ├── complaints/ students/ reports/ more/
│   └── (student)/              # student bottom-tab navigator
│       ├── _layout.tsx         # tabs: Home, Meals, Complaints, Notices, Profile
│       └── index.tsx  meals/  complaints/  notices/  profile/
├── src/
│   ├── api/                    # axios client + TanStack Query hooks per resource
│   ├── features/               # auth, dashboard, meals, complaints, notifications,
│   │                           #   leaves, rooms, fees, visitors, maintenance, ...
│   ├── components/             # shared native UI (cards, sheets, charts, buttons)
│   ├── navigation/             # tab configs, deep-link mapping (push → screen)
│   ├── notifications/          # push registration, handlers, deep-link router
│   ├── offline/                # SQLite/MMKV cache + sync queue (meal marking)
│   ├── hooks/
│   ├── lib/                    # rbac helper, socket client, secure-store, biometrics
│   ├── stores/                 # zustand (auth/session/ui)
│   └── theme/                  # NativeWind config, colors, dark mode
├── assets/                     # icons, splash, fonts
├── app.config.ts               # Expo config (bundle ids, permissions, FCM/APNs)
├── eas.json                    # EAS Build/Submit profiles (dev/preview/prod)
└── package.json
```
*(Optional `web-dashboard/` — React + Vite — can be added later for warden report exports, sharing the same `api/` layer.)*

---

## 12. Security Best Practices

- **Passwords:** argon2id / bcrypt (cost ≥ 12); never store plaintext.
- **Tokens (mobile):** short access JWT + rotating refresh; store refresh hashed server-side; on the device keep tokens in the **secure enclave** (expo-secure-store → iOS Keychain / Android Keystore), never in plain AsyncStorage. Optional biometric gate to open the app.
- **Mobile hardening:** certificate pinning for API calls, jailbreak/root detection (best-effort), obfuscate the JS bundle, no secrets shipped in the app (only public keys), enforce a minimum app version (force-update) from the backend.
- **RBAC + tenant isolation:** every query scoped by `hostelId`; enforce via guard + DB Row-Level Security so a bug can't leak cross-hostel data.
- **Input validation:** DTO validation (class-validator / Zod); reject unknown fields.
- **Authorization checks per object:** verify the student owns the complaint/leave before mutation (no IDOR).
- **File uploads:** validate MIME/type/size, virus scan, store in private bucket, serve via signed URLs, strip EXIF.
- **Rate limiting & brute-force protection:** on login, password reset, SOS; account lockout + captcha after repeated failures.
- **Transport:** HTTPS everywhere, HSTS; secure WebSocket (WSS).
- **Headers:** Helmet (CSP, X-Frame-Options, etc.), strict CORS allowlist.
- **Secrets:** in a vault / env manager, never in code; rotate.
- **SQL injection:** parameterized queries via ORM.
- **Audit logging:** fee edits, approvals, role changes, deletions.
- **PII / privacy:** encrypt sensitive fields at rest, data-retention policy, GDPR-style export/delete.
- **Payments:** verify gateway webhooks with signatures; never trust client-reported payment success.
- **Dependency hygiene:** automated scans (Dependabot, npm audit), pinned versions.
- **Backups:** automated encrypted DB backups + tested restore.

---

## 13. Native Mobile App (Android + iOS)

Built once in **React Native + Expo**, shipped to both the **Google Play Store** and **Apple App Store**. Native capabilities used:

- **Bottom-tab navigation** for both roles; native stacks, gestures, and transitions.
- **Real push notifications** (FCM + APNs via Expo Push) — sound, badge, vibration; **work when the app is closed or backgrounded**. This is the backbone of the meal-ready feature. Tapping a push **deep-links** into the exact screen.
- **Offline-first**: meal marking, cached notices, and dashboard data stored locally (SQLite/MMKV) with a background **sync queue** — students in Wi-Fi dead zones can still toggle meals; changes sync when back online.
- **Biometric login** (Face ID / Touch ID / fingerprint) with tokens in the secure enclave (Keychain/Keystore).
- **Camera**: complaint/maintenance photos, profile picture.
- **QR**: scan visitor passes & mess-counter attendance; render the student's digital Hostel ID QR.
- **Location**: attach location to SOS/emergency alerts; optional geofenced gate check-in.
- **Haptics, pull-to-refresh, swipe actions, native date pickers**, and **OS light/dark theme**.
- **OTA updates (EAS Update)**: push JS/UI fixes instantly without waiting for app-store review (native changes still require a store build).
- Handles thousands of devices: the meal-ready endpoint returns instantly and a queued worker fans push out to all device tokens in batches (see §4).

---

## 14. Reports & Analytics (Warden)

- **Live widgets:** total students, occupied/vacant rooms, today's meal counts, pending complaints, leave requests, unread emergencies.
- **Charts:** occupancy donut, meals-per-day line, complaints-by-status/category bar, fee-collection vs dues, feedback rating trends, attendance %.
- **Monthly report (PDF/CSV):** occupancy, meal attendance, complaints summary, leave summary, fee collection, maintenance closure rate. Auto-generated via scheduled job on the 1st and emailed.

---

## 15. Additional Features You May Have Missed (and why they matter)

1. **Mess menu planner & weekly menu display** — students see what's cooking; reduces "what's for lunch?" queries and improves opt-in accuracy for meal attendance (helps kitchen reduce food waste — real cost saving).
2. **Meal opt-out / headcount forecasting** — students pre-declare skips → kitchen cooks the right quantity → measurable food-cost reduction. Strong ROI selling point.
3. **Roommate / room-change marketplace** — students request swaps; warden approves. Cuts manual coordination.
4. **Digital gate pass + geofencing** — auto check-in/out; late-entry alerts to parents/warden. Safety + compliance.
5. **Parent portal / read-only guardian access** — parents see attendance, leave, fees, emergencies. Huge trust factor for institutions buying the product.
6. **Automated fee reminders & late-fee rules** — reduces overdue collections; recurring revenue for the hostel.
7. **Complaint SLA & escalation** — auto-escalate unresolved complaints after X hours; measures warden responsiveness.
8. **Anonymous feedback / grievance option** — honest feedback on staff/food; improves adoption.
9. **Lost & found board.**
10. **Laundry / gym / facility booking** with slots — avoids crowding.
11. **Attendance via QR at the mess counter** — students scan to mark meal → tamper-proof, feeds accurate stats automatically.
12. **Push notification preferences** — students choose channels; reduces opt-outs and respects DND.
13. **Announcement read-receipts** — warden sees who read critical notices (safety compliance).
14. **Broadcast to specific block/floor/year** — targeted comms.
15. **Health & wellness module** — sick-room log, medicine reminders, infirmary visits — pandemic-era must-have.
16. **Analytics on complaint hot-spots** — which rooms/blocks generate most maintenance → proactive repairs, budget planning.
17. **Multi-language (i18n)** — essential across regions to scale to thousands.
18. **Data export & institution reporting** — universities need audit reports; sells the product to admin.
19. **Bulk student onboarding (CSV/Excel + auto-invite emails).**
20. **In-app chat / helpdesk** between student and warden — centralizes communication vs WhatsApp chaos.

---

## 16. Deployment Strategy

**Environments:** `dev` → `staging` → `production` (separate DBs, secrets, and **separate FCM/APNs projects & bundle IDs** per env).

**Phase 1 (launch / MVP):**

*Backend:*
- Dockerize the API.
- Managed Postgres (Neon/Supabase/RDS) + managed Redis (Upstash) + a worker for BullMQ jobs.
- Deploy API on **Render/Railway/Fly.io/ECS**.
- Object storage on **Cloudflare R2/S3**; media/receipts via signed URLs.
- Domain + TLS (Let's Encrypt / platform-managed).

*Mobile app (the release pipeline):*
- **EAS Build** produces the Android `.aab` and iOS `.ipa` in the cloud (no local Xcode/Android Studio needed).
- **Internal testing:** EAS internal distribution / TestFlight (iOS) + Google Play Internal Testing (Android).
- **EAS Submit** uploads to **Google Play Console** and **App Store Connect**.
- App-store assets: icons, splash, screenshots, privacy policy, data-safety / privacy-nutrition-label declarations.
- **EAS Update (OTA)** channel per environment for instant JS fixes between store releases.
- Requires: Apple Developer account ($99/yr), Google Play Developer account ($25 one-time), FCM project + APNs key.

**Phase 2 (scale):**
- Containers on **Kubernetes** (EKS/GKE) with HPA autoscaling.
- Postgres primary + **read replicas**; connection pooling (PgBouncer).
- Redis cluster; separate worker pool for BullMQ jobs.
- CDN for static + images.
- **CI/CD (GitHub Actions + EAS):** backend → lint/test/build/migrate/deploy (blue-green/canary); mobile → EAS build on tagged release + auto-submit to stores + OTA update to the matching channel.
- **Observability:** **Sentry mobile SDK** (JS crashes, native crashes, release health per app version) + Sentry backend, Prometheus+Grafana (metrics), centralized logs (Loki/ELK), uptime monitoring.
- **Backups & DR:** automated encrypted snapshots, PITR, tested restores, multi-AZ.
- **Feature flags** for safe rollout; DB migrations backward-compatible (expand/contract).

**Multi-tenant scaling path:** start with shared DB + `hostel_id` scoping (+ RLS). At large scale, move heavy tenants to dedicated schemas/DBs; keep the tenant-resolution layer in the gateway so clients don't change.

---

## 17. Suggested Delivery Roadmap

| Sprint | Deliverable |
|--------|-------------|
| 1 | Auth, RBAC, profiles, DB schema, base UI shell |
| 2 | Notifications (incl. meal quick actions) + realtime + push |
| 3 | Complaints + Meal attendance + stats |
| 4 | Rooms/allocation + Student management + dashboards |
| 5 | Leave + Attendance + Notices/Events |
| 6 | Fees + online payments + receipts |
| 7 | Maintenance + Inventory + Visitors (QR) |
| 8 | Feedback analytics + Reports/PDF + Emergency/SOS |
| 9 | Native polish (offline sync, biometrics, deep links), hardening, load test, **EAS build → TestFlight + Play Internal → store submission** |

---

*End of design document.*
