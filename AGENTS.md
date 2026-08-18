# AGENTS.md

## Cursor Cloud specific instructions

Monorepo with three runnable pieces (see `README.md` and each subfolder's README for standard commands):

- `backend/` — NestJS API (Prisma + PostgreSQL), runs on `http://localhost:3001` with a global `/api` prefix. Dev: `npm run start:dev`.
- `frontend/` — Next.js 16 (Turbopack) admin/driver UI in Uzbek, runs on `http://localhost:3000`. Dev: `npm run dev`. It defaults to the backend at `http://localhost:3001/api`, so no `.env.local` is needed for local dev.
- `relay-agent/` — Node script that runs on the office LAN and pushes faces to Hikvision Face ID terminals over ISAPI. It talks to **real hardware**, so it cannot be exercised end-to-end in this VM; treat its behavior as untestable here.

Non-obvious setup/run caveats:

- PostgreSQL must be running locally. The dev DB is `driver_loyalty` (user/password `postgres`/`postgres`). The backend reads `backend/.env`; it is git-ignored, so copy `backend/.env.example` to `backend/.env` if it is missing — the example's defaults already point at the local Postgres and work as-is for dev.
- TLS to Postgres is only enforced when `NODE_ENV=production` (`backend/src/prisma/ensure-ssl.ts`), so local `sslmode`-less URLs are fine in dev.
- Schema changes require `npx prisma migrate deploy` (or `migrate dev`) and seeding with `npx prisma db seed` (uses `ts-node`). These are intentionally **not** in the startup update script.
- Seeded logins are `+998900000001` / `ChangeMe123!` (SuperAdmin) and `+998900000002` / `ChangeMe123!` (Operator). The README's `940650257` / `2010` row is outdated — use the phone numbers above.
- `npm run lint` (backend) and `eslint` (frontend) both report several **pre-existing** errors in files unrelated to typical changes (e.g. `prisma/seed.ts`, `webhooks/*`, `components/pwa/install-prompt.tsx`). Don't treat those as regressions; only fix lint in files you actually touch.

Driver → device enrollment model (important for the drivers area):

- Enrollment state lives per driver+device on `DriverDeviceRegistration.syncStatus`: `PENDING` (UI "Agent kutmoqda"), `SYNCED` ("Yuklangan"), `FAILED` ("Xato"). There is no separate queue table — `AgentService.listPending()` *is* the queue.
- The cloud never calls the LAN device directly; for agent-backed devices a job stays `PENDING` until the local relay agent polls, pushes the face, and acks. A `FAILED` job is only re-offered to the agent after a 60s backoff.
- Bulk "qayta ulash" (reconnect): `POST /api/drivers/reconnect-pending` resets every non-blocked driver's `PENDING`/`FAILED` registrations back to `PENDING` (clearing the error) so the relay agent retries immediately. It's wired to the "Qayta ulash" button on the staff dashboard (`/staff/dashboard`).
