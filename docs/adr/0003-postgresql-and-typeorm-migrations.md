# ADR 0003: PostgreSQL and TypeORM migrations

## Context

ProjectWeekend used SQLite with `synchronize` in places suitable for a tiny deployment. CRM needs production-grade schema control.

## Decision

- PostgreSQL for all environments (dev via Docker, test, prod).
- `synchronize: false` everywhere shared.
- Schema only via TypeORM migrations.
- Production: one-shot **migrate job**, then API startup (seed/integrity/ready). Local `pnpm dev` runs migrations via orchestration scripts, not inside Nest bootstrap.

## Consequences

- Dev/prod parity on types, constraints, transactions.
- Requires Docker for local Postgres.
- No SQLite pragmas or file-DB patterns.

## Rejected alternatives

- SQLite in development / Postgres in production.
- Auto-migrate on every API process start in production.
