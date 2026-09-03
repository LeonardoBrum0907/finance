# AGENTS.md

## Cursor Cloud specific instructions

Full setup/run docs live in `README.md`. Notes below are non-obvious caveats for this cloud environment.

### Services
- **PostgreSQL** (required): the API refuses to boot without a reachable DB (`apps/api/src/env.ts` requires `DATABASE_URL` + `JWT_SECRET`).
- **API** `@finance/api` (Fastify) on `:3333` — `/health` and all `/api/*` routes.
- **Web** `@finance/web` (Vite/React) on `:5173` — Vite proxies `/api` → the API, so the session cookie stays same-origin.
- Pluggy (Open Finance) and the AI chat provider are **optional** external SaaS deps, gated by env vars. Core flows (auth, people, dashboard, budgets, goals) run fully without them; only bank-sync / AI-chat degrade when the keys are absent.

### Postgres in this environment
- Prefer the Cloud secret `DATABASE_URL` pointing at the **remote Postgres on the VPS** (Coolify). Use the `finance` database (schema of this app). Do **not** point at the `ems` database on the same host — that belongs to another app.
- `scripts/sync-api-env-from-cloud.sh` (run from `start` / `dev` terminal) copies injected Cloud secrets into `apps/api/.env` so dotenv/`getAiEnv` see them. It will not overwrite a remote `DATABASE_URL` with a localhost default.
- `scripts/ensure-db.sh` skips local Postgres when `DATABASE_URL` points at a remote host. Local Docker/native Postgres is only a fallback when the secret is unset or still `localhost`.
- Local fallback (no remote secret): `pnpm db:up` / `ensure-db.sh` — Docker Compose `--profile with-db`, or `sudo pg_ctlcluster 16 main start` when there is no Docker. Default local URL: `postgresql://finance:finance@localhost:5432/finance`.

### Env / DB migrations
- Cloud boots sync secrets into `apps/api/.env` before migrate/dev. Locally: copy `apps/api/.env.example` → `apps/api/.env` if missing.
- Apply schema with `pnpm --filter @finance/api exec prisma migrate deploy` (non-interactive). `pnpm db:migrate` runs `prisma migrate dev`, which can prompt — prefer `deploy` in automation.
- The API dev server (`tsx watch`) does not run migrations; run them yourself after pulling new migration files. Cloud `environment.json` already runs `migrate deploy` before `pnpm dev`.

### Run / build / test
- Run everything: `pnpm dev` (API + Web in parallel). Individually: `pnpm dev:api` / `pnpm dev:web`.
- Vite binds `0.0.0.0:5173` with `allowedHosts: true` so Cloud Agent port forwarding works.
- API runs in HTTP-friendly mode in dev (session cookie `secure:false`); in `NODE_ENV=production` the cookie is `secure:true` and needs HTTPS.
- Build/typecheck: `pnpm build`. Shared package tests: `pnpm --filter @finance/shared test`.
- There is **no lint script / ESLint config** in this repo — type-checking via `tsc` (part of `pnpm build`) is the closest static check.

### pnpm native builds
- `pnpm-workspace.yaml` lists `argon2`, `esbuild`, `prisma`, `@prisma/client`, `@prisma/engines` under `allowBuilds`. These MUST be built or `argon2` (password hashing) and Prisma fail at runtime. `pnpm install` runs these build scripts non-interactively; do not run the interactive `pnpm approve-builds`.
