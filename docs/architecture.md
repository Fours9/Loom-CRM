# Architecture

## Dependency semantics

**Arrow `A → B` means module A may import the public API of module B.**

```text
Organization → Platform
Absences → Platform
Absences → Organization
Future modules → Platform
Future modules → Organization
```

Forbidden: Platform → Absences, Organization → Absences, frontend → backend source.

## Layers

1. **Platform** — auth, identity, permissions, audit, notifications, settings, files, health, bootstrap, database.
2. **Organization** — employees (Profile Core: contacts, emergency, employment assignments), departments, positions, schedules, access scope.
3. **Business modules** — absences (first); later questionnaires, onboarding, reviews, goals, skills, documents (see [hr-profile-roadmap.md](product/hr-profile-roadmap.md)).

CRM employee profile UI: `/people/:id`. Absences PW-parity card: `/absences/employees/:id` (unchanged). Boundaries: [ADR 0007](adr/0007-employee-profile-boundaries.md).

## Code location (Variant A)

Backend modules live under `apps/api/src/{platform,organization,modules}` — not separate npm packages until a second backend app needs them.

## Contracts

`libs/contracts/*` hold API shapes only. Entities and Nest DTOs stay in the API. Mappers convert domain → response.

## Data access

Single NestJS REST API is the only data entry point for the Angular client. One PostgreSQL database; tables owned by modules; no TypeORM `synchronize`.
