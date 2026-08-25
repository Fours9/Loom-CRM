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

`OrganizationModule` is a **composition aggregator**. Feature modules (e.g. Questionnaires) should import concrete capabilities (`EmployeesModule`, `PositionCatalogModule`) rather than the full aggregator. Questionnaires → Position Catalog live reads go only through `PositionCatalogFacade` (frozen `context_json` thereafter — [ADR 0010](adr/0010-position-catalog-and-questionnaire-context.md)).

## Layers

1. **Platform** — auth, identity, permissions, audit, notifications (list/unread exclude soft-dismissed; `POST /notifications/:id/dismiss` sets `dismissed_at`), settings, files (**planned**), health, bootstrap, database; shared HTTP helpers (e.g. `attachmentContentDisposition`, `normalizeUploadedFileName`).
2. **Organization** — employees (Profile Core: contacts, emergency, important dates, employment assignments), departments, positions / Position Catalog (sidebar **`/positions`** «Керування посадами» — UI in `apps/web/src/app/features/positions/`; directions/departments/positions rail + full-width Groups+Skills block + position edit modal; root `/positions` tabs **Керування посадами** and **Формати** — employment catalogs with description + drag-reorder (`EmploymentCatalogService` single entry; [position-catalog.md](dev/position-catalog.md)); per-position catalog at **`/positions/:id/catalog`** via the book icon (does not load settings); [ADR 0010](adr/0010-position-catalog-and-questionnaire-context.md)), schedules, access scope. Skill native scale (`range`/`percent`) is independent of questionnaire matrix 0–5. Skill group is optional live classification (`group_id` nullable). `DELETE` skill/group is hard delete; `PATCH isActive` toggles. `SkillsService` is the application entry point for skill/group mutations (generated group codes, Group→Skill lock protocol). `PositionRequirementsService` lists requirements `createdAt ASC, id ASC`. Pre-create requirements exist only as a frontend draft queue.
3. **Business modules** — absences (product UI: **Робочий календар** / TimeEvent domain — [ADR 0008](adr/0008-work-calendar-via-absences.md); deletion workflow includes **rejected** via `pwPermissions.canRequestDeletion`); documents (MVP: employee multi-file submissions + People aggregate with time-event attachments); **questionnaires** (360° policy catalog + module — [ADR 0009](adr/0009-questionnaire-360-mvp.md), [field catalog](product/questionnaire-360-field-catalog.md)); later onboarding, reviews, goals, skills (see [hr-profile-roadmap.md](product/hr-profile-roadmap.md)).

### Position direction invariant

`resolvePositionDirectionId()` is the pure canonical policy for `create/update Position`.
`PositionsService` applies that policy before persistence for mutations of the `Position` entity itself.

`DepartmentsService` separately maintains the same invariant when `Department.directionId` changes, by transactionally cascading the new direction into child `positions.direction_id` rows.

Practical semantics:

- `departmentId == null` → `directionId` may be `null` or manually chosen
- `departmentId != null` → `directionId` is a persisted derived copy from `Department.directionId`
- partial update with omitted `directionId` must not clear a manual direction when the resulting position remains global

### Employment assignment aggregate

- `EmployeeProfileService` is the single assignment write entry point. Every assignment mutation locks the aggregate root (`employees FOR UPDATE`) before touching `employment_assignments`.
- Assignment org resolution is company-aware and transaction-bound: `Company -> Direction -> Department -> Position` lock order, manager-only reads inside the transaction, retry on hierarchy drift.
- `companyId` is derived only from the resolved direction; write DTO no longer accepts it.
- Future-effective transfers persist as `status='planned'`; activation runs through `EmploymentAssignmentLifecycleService` from the startup composition root, not from profile reads.
- `employees.hired_at` is now the employee-level hire/work-start date. Assignment `startDate` is the effective transfer date and no longer doubles as hire date.
- Assignment free-text field is **`comment`** (column/API; was `change_reason` / `changeReason`). Historical audit JSON may contain `changeReason`; new writes use `comment`. No backfill. Do not confuse with `employees.comment` or questionnaire assignment service comment.

### Documents MVP

Documents module owns `employee_documents` (submission) + `employee_document_files` (attachments; interim `content_base64` until Platform Files). Upload: `POST …/documents/employees/:employeeId` with `files` (multi, max 20; limits in `document-limits.ts`). Download: `GET …/documents/:documentId/files/:fileId/download`. List orders documents `createdAt DESC, id DESC` and files `createdAt ASC, id ASC`. Sensitive document types (`questionnaire`, `identity`, `medical`, `consent`) are projected server-side: owner + admin only; department managers see only employment/education/certificate/other when viewing others. Upload/delete: `documents.manage` (Admin). View: `documents.view` (all roles) + `EmployeeAccessService` scope.

### Identity roles (runtime)

`employee` · `department_manager` · `admin`. No separate `hr` role — admin (+ permissions) covers HR-like actions.

Password lifecycle is **Platform `AuthService`** only. `CurrentUserResponse.mustChangePassword` is mapped in one place (`toCurrentUser`) for login, `GET /auth/me`, and `POST /auth/change-password`. After login with the flag set, the web app opens **`/change-password`** (outside the shell). Success issues a **new JWT** (`tokenVersion++`, flag false) in the same response so the client can `SessionStore.setAuthenticated` atomically. Admin `POST /auth/reset-password/:userId` sets the flag and bumps `tokenVersion`; the next API call with the old token is 401. A single HTTP interceptor logs out and navigates to `/login` (login and change-password URLs are exempt). Absences does not own this flow or a second session.

### People UI

CRM employee profile: `/people/:id` — tabs Дані працівника, Робота (Посада · Графік роботи · Заявки · Календар), Документи, Анкети (Questionnaires 360 — [ADR 0009](adr/0009-questionnaire-360-mvp.md)), Показники (stub), Адміністрування (підвкладка Історія), Згодом (stub). Tab «Робота» always visible (hosts Посада); schedule/requests/calendar subtabs gated by `absences.calendar.view`. Also gated: `documents.view`, `questionnaires.view`, `capabilities.canViewHistory` (hide, not empty-state). History timeline: actor label + UA summary. People list `/people`: core `completenessPercent`, `sortBy=completeness`, `maxCompleteness`. Absences PW-parity card: `/absences/employees/:id` (unchanged). Living phase status: [hr-profile-roadmap.md](product/hr-profile-roadmap.md). Work calendar intent: [work-calendar-roadmap.md](product/work-calendar-roadmap.md), [ADR 0008](adr/0008-work-calendar-via-absences.md). Boundaries: [ADR 0007](adr/0007-employee-profile-boundaries.md).

People «Посада» (under Робота) create/edit uses a dedicated modal dialog (exclusive create|edit state, scrollable body, Create/Save; free-text field **Коментар** → API `comment`). FE write entry remains `EmploymentAssignmentsApiService`; cascade filters stay in `employment-org-filter.policy`.

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

Single Nest `OnModuleInit` in `apps/api/src/application-startup/` orchestrates `ApplicationBootstrapService.ensureReady()`, then `QuestionnaireSeedService.ensureEmployee360V1()`, then `EmploymentAssignmentLifecycleService.activateDueAssignments()`. Platform must not import Questionnaires; seed services do not self-init via `OnModuleInit`.

### Profile completeness

Role-independent dual score (`core` / `extended`) via pure calculator (`employee-profile-completeness.ts`); `header.completenessPercent` and list `completenessPercent` = core only; `extended` is `null` for managers viewing others. List enrichment is batched (no per-row scope queries). See [hr-profile-roadmap.md](product/hr-profile-roadmap.md).

## Code location (Variant A)

Backend modules live under `apps/api/src/{platform,organization,modules}` — not separate npm packages until a second backend app needs them.

## Contracts

`libs/contracts/*` hold API shapes only (`@loom/contracts-auth`, `employees`, `absences`, `documents`, `questionnaires`, …). Entities and Nest DTOs stay in the API. Mappers convert domain → response.

## Data access

Single NestJS REST API is the only data entry point for the Angular client. One PostgreSQL database; tables owned by modules; no TypeORM `synchronize`.
