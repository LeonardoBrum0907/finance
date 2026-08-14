# AGENTS.md

## Cursor Cloud specific instructions

Full setup/run docs live in `README.md`. Notes below are non-obvious caveats for this cloud environment.

### Services
- **PostgreSQL** (required): the API refuses to boot without a reachable DB (`apps/api/src/env.ts` requires `DATABASE_URL` + `JWT_SECRET`).
- **API** `@finance/api` (Fastify) on `:3333` — `/health` and all `/api/*` routes.
- **Web** `@finance/web` (Vite/React) on `:5173` — Vite proxies `/api` → the API, so the session cookie stays same-origin.
- Pluggy (Open Finance) and the AI chat provider are **optional** external SaaS deps, gated by env vars. Core flows (auth, people, dashboard, budgets, goals) run fully without them; only bank-sync / AI-chat degrade when the keys are absent.

### Postgres in this environment
- There is **no Docker** here, so `pnpm db:up` (which runs `docker compose up -d db`) does not work. Postgres 16 is installed natively via apt instead and must be started with `sudo pg_ctlcluster 16 main start` (it does not auto-start on VM boot).
- The DB is created to match the default `DATABASE_URL` in `apps/api/.env.example`: role `finance` / password `finance` / database `finance` on `localhost:5432`. If the cluster is fresh, recreate with:
  `sudo -u postgres psql -c "CREATE ROLE finance LOGIN PASSWORD 'finance';"` then `sudo -u postgres createdb -O finance finance`.

### Env / DB migrations
- Copy `apps/api/.env.example` → `apps/api/.env` and set a `JWT_SECRET` (the update script does not create `.env`). The default `DATABASE_URL` already points at the local Postgres.
- Apply schema with `pnpm --filter @finance/api exec prisma migrate deploy` (non-interactive). `pnpm db:migrate` runs `prisma migrate dev`, which can prompt — prefer `deploy` in automation.
- The API dev server (`tsx watch`) does not run migrations; run them yourself after pulling new migration files.

### Run / build / test
- Run everything: `pnpm dev` (API + Web in parallel). Individually: `pnpm dev:api` / `pnpm dev:web`.
- API runs in HTTP-friendly mode in dev (session cookie `secure:false`); in `NODE_ENV=production` the cookie is `secure:true` and needs HTTPS.
- Build/typecheck: `pnpm build`. Shared package tests: `pnpm --filter @finance/shared test`.
- There is **no lint script / ESLint config** in this repo — type-checking via `tsc` (part of `pnpm build`) is the closest static check.

### pnpm native builds
- `pnpm-workspace.yaml` lists `argon2`, `esbuild`, `prisma`, `@prisma/client`, `@prisma/engines` under `allowBuilds`. These MUST be built or `argon2` (password hashing) and Prisma fail at runtime. `pnpm install` runs these build scripts non-interactively; do not run the interactive `pnpm approve-builds`.
