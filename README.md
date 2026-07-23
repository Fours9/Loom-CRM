# LoomCRM

Modular monolith CRM platform. Angular client talks only to the NestJS REST API (`/api/v1`). PostgreSQL is the single database.

## Paths

| Role | Path |
|------|------|
| LoomCRM repository root | `C:\Loom-CRM-Core` |
| Read-only copy source | `C:\Loom-CRM-Core\ProjectWeekend` |

**Never modify `ProjectWeekend` as part of LoomCRM work.** It remains a separate local Absence Manager until cutover.

## Requirements

- Node.js 22.x (`engines`: `>=22 <23`)
- pnpm **10.15.0** (see `packageManager` in `package.json`)
- Docker (PostgreSQL)

```bash
corepack enable
corepack prepare pnpm@10.15.0 --activate
```

## Quick start

```bash
pnpm install
docker compose up -d postgres
pnpm migration:run
pnpm dev
```

Windows: `start.bat` (migrate + api + web), `test.bat` (lint/typecheck/test/build).

- API: http://localhost:3000/api/v1/health/live
- Web: http://localhost:4200

Useful scripts:

| Script | Purpose |
|--------|---------|
| `pnpm dev` | Run migrations, then api + web |
| `pnpm dev:apps` | Start apps without touching DB |
| `pnpm migration:run` | Apply pending migrations |
| `pnpm check:copy-source` | Fail if ProjectWeekend has local changes |

## Architecture

See [docs/architecture.md](docs/architecture.md) and [docs/adr/](docs/adr/).

Dependency rule: **arrow `A → B` means A may import B's public API.**

```text
Organization → Platform
Absences → Platform
Absences → Organization
```

## Cutover

See [docs/cutover.md](docs/cutover.md). Dry-run:

```bash
pnpm cutover:dry-run
```

```text
apps/api          NestJS API (platform / organization / modules)
apps/web          Angular CRM shell
libs/contracts/*  Shared API TypeScript contracts (no TypeORM / Nest / Angular)
libs/frontend/ui  Shared UI primitives
database/         Migration ownership docs (code lives under apps/api)
```
