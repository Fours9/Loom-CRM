# Architecture

## Dependency semantics

**Arrow `A → B` means module A may import the public API of module B.**

```text
Organization → Platform
Absences → Platform
Absences → Organization
Documents → Platform
Documents → Organization
Future modules → Platform
Future modules → Organization
```

Forbidden: Platform → Absences; Platform → Documents; Organization → Absences; Organization → Documents; frontend → backend source.

## Layers

1. **Platform** — auth, identity, permissions, audit, notifications, settings, files (**planned**), health, bootstrap, database; shared HTTP helpers (e.g. `attachmentContentDisposition`, `normalizeUploadedFileName`).
2. **Organization** — employees (Profile Core: contacts, emergency, important dates, employment assignments), departments, positions, schedules, access scope.
3. **Business modules** — absences (product UI: **Робочий календар** / TimeEvent domain — [ADR 0008](adr/0008-work-calendar-via-absences.md)); documents (MVP: employee file list/upload + People aggregate with time-event attachments); later questionnaires, onboarding, reviews, goals, skills (see [hr-profile-roadmap.md](product/hr-profile-roadmap.md)).

### Documents MVP

Documents module owns `employee_documents` (interim `content_base64` storage until Platform Files). Sensitive document types (`questionnaire`, `identity`, `medical`, `consent`) are projected server-side: owner + admin only; department managers see only employment/education/certificate/other when viewing others. Upload/delete: `documents.manage` (Admin). View: `documents.view` (all roles) + `EmployeeAccessService` scope.

### Identity roles (runtime)

`employee` · `department_manager` · `admin`. No separate `hr` role — admin (+ permissions) covers HR-like actions.

### People UI

CRM employee profile: `/people/:id` — tabs Дані працівника, Робочий календар, Документи, Показники (stub), Історія, Згодом (stub). Absences PW-parity card: `/absences/employees/:id` (unchanged). Living phase status: [hr-profile-roadmap.md](product/hr-profile-roadmap.md). Work calendar intent: [work-calendar-roadmap.md](product/work-calendar-roadmap.md), [ADR 0008](adr/0008-work-calendar-via-absences.md). Boundaries: [ADR 0007](adr/0007-employee-profile-boundaries.md).

### Profile completeness

Role-independent dual score (`core` / `extended`) via pure calculator; `header.completenessPercent` = core only; `extended` is `null` for managers viewing others. See [hr-profile-roadmap.md](product/hr-profile-roadmap.md).

## Code location (Variant A)

Backend modules live under `apps/api/src/{platform,organization,modules}` — not separate npm packages until a second backend app needs them.

## Contracts

`libs/contracts/*` hold API shapes only (`@loom/contracts-auth`, `employees`, `absences`, `documents`, …). Entities and Nest DTOs stay in the API. Mappers convert domain → response.

## Data access

Single NestJS REST API is the only data entry point for the Angular client. One PostgreSQL database; tables owned by modules; no TypeORM `synchronize`.
