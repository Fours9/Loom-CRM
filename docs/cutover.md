# Cutover: ProjectWeekend → LoomCRM

## Goal

Move production data from ProjectWeekend SQLite into LoomCRM PostgreSQL without modifying ProjectWeekend files.

## Prerequisites

1. LoomCRM migrations applied (`pnpm migration:run`).
2. Freeze ProjectWeekend writes (maintenance window).
3. Backup SQLite: copy `ProjectWeekend/data/app.sqlite` to a safe path.
4. Optional: `pnpm add -wD better-sqlite3` (importer dependency).

## Procedure

### 1. Dry-run

```bash
node scripts/cutover/import-from-projectweekend.mjs --dry-run --sqlite ProjectWeekend/data/app.sqlite
```

Review `cutover-report-*.json` counts.

### 2. Apply import

```bash
set DATABASE_URL=postgres://loom:loom@127.0.0.1:5432/loom_crm
node scripts/cutover/import-from-projectweekend.mjs --reset --sqlite ProjectWeekend/data/app.sqlite
```

`--reset` clears Loom domain tables (users, employees, catalogs, requests, …) then imports. Keeps `migrations` / `bootstrap_state`.

Then refresh the tracked DB snapshot:

```powershell
.\scripts\db-snapshot.ps1
git add data/app.snapshot.sql
```

The importer:

- reads SQLite readonly
- inserts into Postgres with new UUIDs
- stores old→new ID mapping in the report
- validates orphan FK for absence requests
- rolls back on failure

### 3. Reconciliation

- Compare counts users/employees/departments/requests (report vs SQL).
- Spot-check login for admin and sample employees.
- Spot-check absences calendar for a known date range.

### 4. Freeze & switch

- Keep ProjectWeekend read-only.
- Point DNS / reverse proxy to LoomCRM.
- Monitor `/api/v1/health/ready`.

### 5. Rollback

If LoomCRM must be abandoned mid-cutover:

1. Restore previous reverse-proxy target to ProjectWeekend.
2. Drop/recreate LoomCRM DB from backup if partial import polluted it:
   ```bash
   dropdb / createdb + pnpm migration:run
   ```
3. ProjectWeekend SQLite backup remains authoritative until cutover is declared done.

## Non-goals

- Live dual-write sync.
- Editing ProjectWeekend during import.
- Keeping old integer IDs (LoomCRM uses UUID; mapping is in the report).
