# Cutover: ProjectWeekend → LoomCRM

## Goal

Move production data from ProjectWeekend SQLite into LoomCRM PostgreSQL without modifying ProjectWeekend files.

**Local / repeatable port runbook (UA):** [docs/dev/pw-to-loom-port.md](dev/pw-to-loom-port.md) — modular importer, fail-closed ResetPolicy (NO CASCADE), dual role mapping, EA manager SoT, deterministic uuid v5.

## Prerequisites

1. LoomCRM migrations applied (`pnpm migration:run`).
2. Freeze ProjectWeekend writes (maintenance window) for production cutover.
3. Backup SQLite: copy `ProjectWeekend/data/app.sqlite` to a safe path.
4. **Mandatory** Loom backup before `--reset` on any valuable target: `.\scripts\db-snapshot.ps1`.
5. `better-sqlite3` at repo root if missing: `pnpm add -wD better-sqlite3` (`pg` / `uuid` resolved from `apps/api`).

## Procedure (local port)

### 1. Dry-run (SQLite + Postgres read-only)

If the target already has domain rows, include `--reset` so preflight knows wipe is intended:

```powershell
node scripts/cutover/import-from-projectweekend.mjs --dry-run --reset --sqlite ProjectWeekend/data/app.sqlite
```

Review `cutover-report-*.json`. Unknown PW roles, orphan managed depts, missing absence actors → **exit 1** (no silent fallback).

### 2. Apply import

```powershell
.\scripts\db-snapshot.ps1
$env:DATABASE_URL = 'postgres://loom:loom@127.0.0.1:5432/loom_crm'
node scripts/cutover/import-from-projectweekend.mjs --reset --sqlite ProjectWeekend/data/app.sqlite
```

`--reset` runs explicit `TRUNCATE … RESTART IDENTITY` on runtime/domain tables (**no CASCADE**). Keeps migrations, bootstrap_state, account_roles, surfaces, employment catalogs, skills, questionnaire **templates**, directions/companies, application_settings.

Then refresh the tracked DB snapshot:

```powershell
.\scripts\db-snapshot.ps1
git add data/app.snapshot.sql
```

The importer:

- reads SQLite readonly
- inserts into Postgres with **deterministic uuid v5** (source-backed + synthetic EA/contacts)
- sets `users.account_role_id` (AuthZ SoT) and `users.role` via `userRoleMirrorFor`
- synthesizes `employment_assignments` + EA managed departments (manager scope SoT)
- imports full absence columns + history; notifications preserve payload keys
- stores mapping in the report; rolls back on failure

### 3. Reconciliation

See checklist in [pw-to-loom-port.md](dev/pw-to-loom-port.md) §8 (counts, role mirror, EA manager scope, dual-import same mapping).

### 4. Freeze & switch (production)

- Keep ProjectWeekend read-only.
- Point DNS / reverse proxy to LoomCRM.
- Monitor `/api/v1/health/ready`.

### 5. Rollback

1. Restore reverse-proxy to ProjectWeekend if needed.
2. `.\scripts\db-restore.ps1` from pre-reset snapshot / bak.
3. ProjectWeekend SQLite remains authoritative until cutover is declared done.

## Non-goals

- Live dual-write sync.
- Editing ProjectWeekend during import.
- Reusing PW ids as Loom PKs without v5 mapping (mapping is in the report).
- Porting binary attachments / PW audit_logs (v1).
