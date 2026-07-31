# Driver Loyalty, Wallet & Mini-ERP System

Mobile-first web app that tracks truck drivers visiting a facility, issues loyalty
"stamps" via Hikvision face recognition, and lets Operators manage cash advances
and goods exchanges — all backed by an immutable financial ledger.

## Monorepo layout

```
driver-loyalty-erp/
├── backend/     NestJS (TypeScript) API — Prisma + PostgreSQL
├── frontend/    Next.js (React) + Tailwind + shadcn/ui — mobile-first
└── docs/        Architecture notes, ERDs, API docs
```

## Tech stack

- **Backend:** NestJS, Prisma ORM, PostgreSQL
- **Frontend:** Next.js, Tailwind CSS, shadcn/ui
- **Auth:** JWT (access + refresh), phone/OTP for drivers, password for staff
- **Hardware integration:** Hikvision ISAPI (outbound face enrollment) + webhook (inbound recognition events)



## Status

- [x] Step 1 — Database schema (`backend/prisma/schema.prisma`)
- [x] Step 2 — Backend: Auth, Ledger service, Hikvision ISAPI + webhook with cooldown
- [x] Step 3 — Frontend: Operator & Driver mobile-first UIs (Next.js + Tailwind + shadcn/ui)



## Getting started (backend)

```bash
cd backend
cp .env.example .env   # then fill in DATABASE_URL, JWT secrets, etc.
npm install
npx prisma migrate dev --name init
npx prisma db seed      # creates a SuperAdmin + Operator + a demo product
npm run start:dev
```

Seeded accounts (change the password immediately in a real deployment):


| Role       | Phone           | Password       |
| ---------- | --------------- | -------------- |
| SuperAdmin | `940650257`     | `2010`         |
| Operator   | `+998900000002` | `ChangeMe123!` |




## Getting started (frontend)

```bash
cd frontend
cp .env.local.example .env.local   # points at the backend, defaults to http://localhost:3001/api
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000). The UI is fully in **Uzbek** and has a single, unified
login screen at `/` — enter "Telefon raqami" (phone) + "Parol" (password) and press
"Kirish". There is no sign-up/registration link anywhere; only staff can create accounts.
The frontend tries the credentials against the Staff login endpoint first, and — only if
that fails — falls back to the Driver login endpoint, so the same form works for every
role. Use the seeded accounts above to sign in as staff.

## Frontend route map

```
/                         Unified login (phone + password) — routes to staff or driver
                          dashboard automatically based on which account matched
/driver/dashboard         Driver wallet: balance + transaction history

/staff/dashboard          Driver list + search. SuperAdmin sees a "Yangi operator"
                          quick-create action here too; Operator only sees "Yangi haydovchi"
/staff/drivers/new        Register a driver (photo, optional login password, device enrollment)
/staff/drivers/[id]       Driver detail — balance, history, give advance,
                          exchange goods, (SuperAdmin) manual adjustment / block
/staff/devices            Hikvision device management       (SuperAdmin only)
/staff/products           Goods catalog management           (SuperAdmin only)
/staff/users              Operator account list + activate/deactivate (SuperAdmin only) —
                          creation happens via the dashboard's "Yangi operator" dialog
```

Auth is JWT-based with two independent token "kinds" (staff vs driver) so a
driver's session can never touch a staff-only endpoint or vice versa (see
`src/lib/auth-context.tsx`). Access tokens are refreshed transparently via an
axios interceptor in `src/lib/api-client.ts`.

### Role-based account creation (RBAC)

- **SuperAdmin** can create both Operators (staff) and Drivers, from the dashboard.
- **Operator** can only create Drivers — they never see any staff-creation UI, and the
underlying `/staff/users` route is guarded server- and client-side to SuperAdmin only.
- Staff accounts can only ever be created with the `OPERATOR` role from the UI — there is
no way to create another SuperAdmin through the app.
- Drivers can optionally be given a login password at registration time (`password` field,
hashed with bcrypt) so they can sign in through the unified login immediately; otherwise
they remain reachable only via the existing SMS-OTP driver login endpoint until a
password is set.



## Backend module map

```
src/
├── auth/         JWT auth for staff (password) and drivers (password or OTP)
├── users/        Staff account management (SuperAdmin only)
├── drivers/      Driver registration, photo upload, device enrollment, profile
├── devices/      Hikvision device (gate) CRUD + health check
├── products/     Goods catalog for point exchange
├── ledger/       THE LEDGER — cash advances, goods exchange, manual adjustments,
│                 balance/history reads (staff + driver "me" endpoints)
├── hikvision/    ISAPI client (digest auth) — face enrollment on devices
├── webhooks/     Inbound Hikvision recognition webhook + cooldown/anti-fraud
├── audit/        Audit log writer for staff actions
├── prisma/       PrismaService (DB client)
└── config/       Typed environment configuration
```

