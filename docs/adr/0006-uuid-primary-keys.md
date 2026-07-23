# ADR 0006: UUID primary keys

## Context

Need one ID strategy before the first real domain migrations.

## Decision

Use **UUID** strings for entity primary keys (`EntityId = string` in contracts). Prefer UUID v7 when convenient; UUID v4 is acceptable.

## Consequences

- Consistent IDs across modules.
- Slightly larger indexes than bigint; fine for target scale.

## Rejected alternatives

- Mixing integer and UUID per table.
- Database-specific serial IDs as the public API identity.
