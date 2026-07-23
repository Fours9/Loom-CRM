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
- Allowed: Organization → Platform; Absences → Platform; Absences → Organization.
- Forbidden: Platform → Absences; Organization → Absences; `apps/web` → `apps/api` source.
- Backend layout (Variant A): `apps/api/src/{platform,organization,modules}`.
- Contracts: `libs/contracts/*` — API shapes only (no TypeORM / Nest / Angular).
- Do not enable TypeORM `synchronize: true` in any environment.
- Schema changes: TypeORM migrations only (`pnpm migration:run` / Compose `migrate` service).

## Package manager

Use the exact `packageManager` from root `package.json` (`pnpm@10.15.0`) via Corepack when possible. Node **22.x** (`engines`: `>=22 <23`).

## Database snapshot (PW-style)

- **Live** PostgreSQL is never in git (Compose volume / local `DATABASE_URL`).
- **Tracked snapshot:** `data/app.snapshot.sql` via `scripts/db-snapshot.ps1` (live → snapshot) and `scripts/db-restore.ps1` (snapshot → live, with `data/app.live.bak-*.sql` auto-backup).
- Do not commit live dumps or `.bak` files; only update the snapshot when the demo/shared state should move between machines.
- After `git pull` of a new snapshot, restore is explicit (`db-restore.ps1`) — pull alone does not overwrite the live DB.

## Documentation

- Human-facing LoomCRM docs for onboarding/ops: Ukrainian, under `docs/` (hub: `docs/README.md`).
- Practical runbooks: `docs/dev/git-sync.md`, `docs/dev/deploy.md`, `docs/dev/operations.md`.
- Do **not** invent tunnels/ngrok scripts that do not exist; DB sync uses the PowerShell scripts above (Postgres SQL dump, not SQLite files).
- Do not write product docs into `ProjectWeekend/docs`.
- Keep ADRs in `docs/adr/`; architecture overview in `docs/architecture.md`.

## Secrets and generated noise

- Never commit `.env`, `.env.production`, real JWT secrets, or credentials.
- Prefer not to commit local `cutover-report-*.json` unless explicitly requested.
- Templates only: `.env.example`, `.env.production.example`.

## UI language

- Absences / employee-facing UI strings: Ukrainian (i18n), matching ProjectWeekend copy where ported.
- Agent-facing files (`AGENTS.md`, `.cursor/rules`) may stay English.
