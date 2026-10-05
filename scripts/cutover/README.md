# ProjectWeekend → LoomCRM cutover tooling

Ops tooling (not a Nest module). Reads ProjectWeekend SQLite **readonly** and writes Loom PostgreSQL.

**Runbook (UA):** [docs/dev/pw-to-loom-port.md](../../docs/dev/pw-to-loom-port.md)

```powershell
node scripts/cutover/import-from-projectweekend.mjs --dry-run --sqlite ProjectWeekend/data/app.sqlite
.\scripts\db-snapshot.ps1   # mandatory before --reset on valuable DB
node scripts/cutover/import-from-projectweekend.mjs --reset --sqlite ProjectWeekend/data/app.sqlite
```

Invariants: ResetPolicy **NO CASCADE**, fail-closed roles/managers, deterministic uuid v5 (source + synthetic), EA SoT for manager scope.
