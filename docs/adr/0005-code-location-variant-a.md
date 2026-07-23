# ADR 0005: Code location Variant A

## Context

We want clear module folders without premature npm/Nx library packaging.

## Decision

Place backend domains under `apps/api/src/{platform,organization,modules}` (Variant A). Introduce `libs/backend/*` with public `index.ts` only when a second backend consumer needs real package isolation.

Frontend may use `libs/frontend/ui` and `libs/contracts/*` early.

## Consequences

- Faster start, fewer build pipelines.
- Boundaries enforced by ESLint and review, not package exports (yet).

## Rejected alternatives

- Full Nx monorepo from day one.
- Empty packages for every future business module.
