# Agent rules for LoomCRM

Hard invariants. Prefer these over improvisation.

## ProjectWeekend is read-only

`ProjectWeekend/**` is a local **read-only copy-source** for migrating domain logic into LoomCRM.

**Do not** edit, format, rename, delete, or generate files inside `ProjectWeekend/`.

- LoomCRM repository root: clone of https://github.com/Fours9/Loom-CRM (e.g. `C:\Loom-CRM-Core`)
- Read-only copy source: `ProjectWeekend/` (gitignored; never commit into LoomCRM)
- Prefer copying logic into `apps/` / `libs/` instead of changing the copy-source

Before finishing work that may have touched the copy-source accidentally:

```bash
pnpm check:copy-source
```

## Architecture boundaries

- Arrow `A → B` means module A may import the public API of module B.
- Allowed: Organization → Platform; Absences → Platform; Absences → Organization; Documents → Platform; Documents → Organization.
- Forbidden: Platform → Absences; Platform → Documents; Organization → Absences; Organization → Documents; `apps/web` → `apps/api` source.
- Backend layout (Variant A): `apps/api/src/{platform,organization,modules}`.
- Contracts: `libs/contracts/*` — API shapes only (no TypeORM / Nest / Angular).
- Do not enable TypeORM `synchronize: true` in any environment.
- Schema changes: TypeORM migrations only (`pnpm migration:run` / Compose `migrate` service).

## Package manager

Use the exact `packageManager` from root `package.json` (`pnpm@10.15.0`) via Corepack when possible. Node **22.x** (`engines`: `>=22 <23`).

## Database snapshot (PW-style)

- **Live** PostgreSQL is never in git (Compose volume / local `DATABASE_URL`). There is **no** `data/app.sqlite` — unlike ProjectWeekend, the live DB is a server, not a file in the repo.
- **Tracked snapshot:** `data/app.snapshot.sql` — **full** `pg_dump --clean` baseline (not data-only). Windows: `scripts/db-snapshot.ps1` / `db-restore.ps1` + `scripts/lib/postgres-cli.ps1`. Linux/VPS: `scripts/db-snapshot.sh` / `db-restore.sh` / `db-recreate.sh`.
- **Site cutover restore** is always `DROP DATABASE` + `CREATE DATABASE` then restore into the fresh DB. Forbidden: “empty-enough” restore relying only on dump `--clean` (newer target objects can survive).
- **`pnpm migration:run` is schema only.** It does **not** load demo data. After clone / empty DB, always run `.\scripts\db-restore.ps1` explicitly (`start.bat` does **not** auto-restore).
- Do not commit live dumps, `.bak` files, or `backups/` (gitignored cutover state). Only update the tracked snapshot when demo/shared state should move between machines.
- After `git pull` of a new snapshot, restore is explicit — pull alone does not overwrite the live DB.
- When onboarding a machine or debugging “empty DB / can’t log in”, check restore before inventing other fixes.

## Site cutover / VPS deploy

- Runbook: [`docs/dev/site-cutover.md`](docs/dev/site-cutover.md). Orchestrator: `scripts/site-cutover.sh`. Daily: `scripts/deploy-vps.sh`.
- **Dual bootstrap:** `sourceMode=snapshot` → recreate → restore → migrate; `sourceMode=pw-refresh` → recreate → migrate → cutover importer (never importer on unmigrated DB). Importer runs in `docker/cutover.Dockerfile` one-shot image (not api production image).
- **go_live boundary:** until go_live, web is only `127.0.0.1:8080` (`compose.cutover-acceptance.yaml`); after go_live, production `:80`. Data-safe PW rollback only before go_live.
- After explicit migrate, start api/web with `up -d --no-deps` (do not re-trigger `depends_on` migrate).
- Daily migrations **MUST** be backward-compatible with the running API, or stop writers first (`LOOM_STOP_API_BEFORE_MIGRATE=1`).
- Smoke login secrets: `CUTOVER_SMOKE_EMAIL` / `CUTOVER_SMOKE_PASSWORD` (not `SEED_ADMIN_*`). Marker `backups/cutover-state.json` — no secrets.

## Documentation

- Human-facing LoomCRM docs for onboarding/ops: Ukrainian, under `docs/` (hub: `docs/README.md`).
- **Living status** (must match code): `docs/README.md`, `docs/architecture.md`, `docs/product/hr-profile-roadmap.md`, this file.
- **Target / vision** (not implementation status): `docs/product/employee-profile-core.md`.
- Practical runbooks: `docs/dev/git-sync.md`, `docs/dev/deploy.md`, `docs/dev/operations.md`, `docs/dev/site-cutover.md` (VPS PW→Loom).
- Demo tunnel tooling (exists): `start-tunnel.bat` → `scripts/start-tunnel.ps1` (ngrok reserved domain). Do **not** invent other tunnel providers (Cloudflare, etc.) without an architecture decision. DB sync uses `db-snapshot` / `db-restore` (Postgres SQL dump, not SQLite files).
- Do not write product docs into `ProjectWeekend/docs`.
- Keep ADRs in `docs/adr/`; architecture overview in `docs/architecture.md`.
- Access / account roles: [ADR 0011](docs/adr/0011-org-leadership-vs-account-role.md), [access-surfaces.md](docs/product/access-surfaces.md). Platform AccessControl owns roles/surfaces/`AuthorizationContextService`; Organization must not invent a second authZ SoT.
- Confidential classification: [ADR 0012](docs/adr/0012-confidential-classification.md) — `confidential.view` + Documents `is_confidential`; type policy via managed scope; no `permissionsForRole` / `User.role` authZ branches in Documents confidential/type policies.

## Secrets and generated noise

- Never commit `.env`, `.env.production`, real JWT secrets, or credentials.
- Prefer not to commit local `cutover-report-*.json` unless explicitly requested.
- PW → Loom data port: `scripts/cutover/` + UA runbook [`docs/dev/pw-to-loom-port.md`](docs/dev/pw-to-loom-port.md). Never write into `ProjectWeekend/**`; use `--dry-run --reset` then mandatory snapshot before `--reset` apply on valuable DBs.
- Templates only: `.env.example`, `.env.production.example`.

## UI language

- Absences / employee-facing UI strings: Ukrainian (i18n), matching ProjectWeekend copy where ported.
- Agent-facing files (`AGENTS.md`, `.cursor/rules`) may stay English.
