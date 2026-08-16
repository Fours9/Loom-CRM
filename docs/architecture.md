# Architecture

## Dependency semantics

**Arrow `A → B` means module A may import the public API of module B.**

```text
Organization → Platform
Absences → Platform
Absences → Organization
Documents → Platform
Documents → Organization
Questionnaires → Platform
Questionnaires → Organization
```

Forbidden: Platform → Absences / Documents / Questionnaires; Organization → Absences / Documents / Questionnaires; frontend → backend source.

## Layers

1. **Platform** — auth, identity, permissions, audit, notifications, settings, files (**planned**), health, bootstrap, database; shared HTTP helpers (e.g. `attachmentContentDisposition`, `normalizeUploadedFileName`).
2. **Organization** — employees (Profile Core: contacts, emergency, important dates, employment assignments), departments, positions / Position Catalog (Settings UI **`/settings/positions`** «Керування посадами» — [ADR 0010](adr/0010-position-catalog-and-questionnaire-context.md), [position-catalog.md](dev/position-catalog.md)), schedules, access scope.
3. **Business modules** — absences (product UI: **Робочий календар** / TimeEvent domain — [ADR 0008](adr/0008-work-calendar-via-absences.md)); documents (MVP: employee file list/upload + People aggregate with time-event attachments); **questionnaires** (360° policy catalog + module — [ADR 0009](adr/0009-questionnaire-360-mvp.md), [field catalog](product/questionnaire-360-field-catalog.md)); later onboarding, reviews, goals, skills (see [hr-profile-roadmap.md](product/hr-profile-roadmap.md)).

### Documents MVP

Documents module owns `employee_documents` (interim `content_base64` storage until Platform Files). Sensitive document types (`questionnaire`, `identity`, `medical`, `consent`) are projected server-side: owner + admin only; department managers see only employment/education/certificate/other when viewing others. Upload/delete: `documents.manage` (Admin). View: `documents.view` (all roles) + `EmployeeAccessService` scope.

### Identity roles (runtime)

`employee` · `department_manager` · `admin`. No separate `hr` role — admin (+ permissions) covers HR-like actions.

### People UI

CRM employee profile: `/people/:id` — tabs Дані працівника, Робочий графік (Графік роботи · Заявки · Календар), Документи, Анкети (Questionnaires 360 — [ADR 0009](adr/0009-questionnaire-360-mvp.md)), Показники (stub), Адміністрування (підвкладка Історія), Згодом (stub). Visibility gated by session permissions (`absences.calendar.view`, `documents.view`, `questionnaires.view`) and `capabilities.canViewHistory` (hide, not empty-state). History timeline: actor label + UA summary. People list `/people`: core `completenessPercent`, `sortBy=completeness`, `maxCompleteness`. Absences PW-parity card: `/absences/employees/:id` (unchanged). Living phase status: [hr-profile-roadmap.md](product/hr-profile-roadmap.md). Work calendar intent: [work-calendar-roadmap.md](product/work-calendar-roadmap.md), [ADR 0008](adr/0008-work-calendar-via-absences.md). Boundaries: [ADR 0007](adr/0007-employee-profile-boundaries.md).

### Questionnaires FE boundary

- **Public:** `apps/web/src/app/features/questionnaires/public-api.ts` — People panel, snapshot summary, `buildQuestionnaireAssignmentLink` (URL only).
- **Private:** immersive chrome-less fill `/questionnaires/:id` (`fill/` — FillChrome, section progress rail under `fill/progress/`, DraftStore, AutosaveCoordinator, RevisionCoordinator, WizardShell, field widgets, `questionnaire-fill-session.policy`). Not re-exported; left sidebar stepper removed. First-fill auto-edit before step resolve; Review lock-in «Надіслати». Request-changes: comment popover, active-request banner + resolve actions, list amber indicators — living detail in [hr-profile-roadmap.md](product/hr-profile-roadmap.md) § «Запит змін».
- Shell hides topbar/sidebar via route `data.hideAppChrome` (leaf walk); directory `/questionnaires` keeps chrome.
- Assignments may be **unattached** (`status: new` or detached `cancelled` with `employeeId = null`, `detachedFromEmployeeId` as **authorization provenance** while detached). Reattach via `POST .../attach` to **any** attachable employee (`new` needs Assign; cancelled needs ManageLifecycle); audit records `fromEmployeeId`→`toEmployeeId`. People list excludes `cancelled`. Each assignment has immutable human `code` (e.g. `360-002`); template **types** `full` | `managing` | `docs` (`employee-360` = `full` / «Повна»; published stubs for managing/docs). Print UI stubs only; future PDF blank ≡ filled layout 1:1 with values filled in.
- Profile mirror: assignment `profileMirror` and/or private `QuestionnaireProfileMirrorService`; skipped when `employeeId` is null.
- Questionnaires HTTP: `QuestionnairesApiService` only (no employee endpoints on that gateway).

### Questionnaire schema library

- `@loom/contracts-questionnaires` — API/DTO/schema **shapes only** (incl. `visibleWhen`, layout meta).
- `@loom/questionnaire-schema` — framework-free domain helpers: visibility, `projectVisibleQuestionnaireAnswers`, completion %, preferred-language serialize/parse, schema validation. Used by `apps/api` + `apps/web`. Contracts must **not** import this package. API loads compiled `dist/` (CJS); web path-maps to `src/` (Angular). Build via `pnpm --filter @loom/questionnaire-schema build` (also from API `dev`).
- `@loom/employee-contacts` — canonical contacts bundle shape, draft normalize vs write validate, snapshot/completion helpers. Shared by API Organization facade, questionnaire proposals, and web shared editor (`apps/web/src/app/shared/employee-contacts/public-api.ts`). Questionnaires module uses Organization `EmployeeContactsFacade` only (no direct contact entities).
- `@loom/position-skill-catalog` — stable skill codes/labels (HTML §7) for questionnaire `position_skills_matrix` and future Organization skills seed. Questionnaires and Organization both import this lib; Organization must never import Questionnaires seed. Context envelope: `QuestionnaireContextV1` in contracts ([ADR 0010](adr/0010-position-catalog-and-questionnaire-context.md), [position-catalog.md](dev/position-catalog.md)).

### Application startup

Single Nest `OnModuleInit` in `apps/api/src/application-startup/` orchestrates `ApplicationBootstrapService.ensureReady()` then `QuestionnaireSeedService.ensureEmployee360V1()`. Platform must not import Questionnaires; seed services do not self-init via `OnModuleInit`.

### Profile completeness

Role-independent dual score (`core` / `extended`) via pure calculator (`employee-profile-completeness.ts`); `header.completenessPercent` and list `completenessPercent` = core only; `extended` is `null` for managers viewing others. List enrichment is batched (no per-row scope queries). See [hr-profile-roadmap.md](product/hr-profile-roadmap.md).

## Code location (Variant A)

Backend modules live under `apps/api/src/{platform,organization,modules}` — not separate npm packages until a second backend app needs them.

## Contracts

`libs/contracts/*` hold API shapes only (`@loom/contracts-auth`, `employees`, `absences`, `documents`, `questionnaires`, …). Entities and Nest DTOs stay in the API. Mappers convert domain → response.

## Data access

Single NestJS REST API is the only data entry point for the Angular client. One PostgreSQL database; tables owned by modules; no TypeORM `synchronize`.
