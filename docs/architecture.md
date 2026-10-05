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

`OrganizationModule` is a **composition aggregator**. Feature modules (e.g. Questionnaires) should import concrete capabilities (`EmployeesModule`, `PositionCatalogModule`) rather than the full aggregator. Questionnaires → Position Catalog live reads go only through `PositionCatalogFacade` (`buildSnapshotForEmployee` / `buildSnapshotForPosition`; frozen `context_json` thereafter — [ADR 0010](adr/0010-position-catalog-and-questionnaire-context.md)).

## Layers

1. **Platform** — auth, identity, permissions, audit, notifications (list/unread exclude soft-dismissed; `POST /notifications/:id/dismiss` sets `dismissed_at`), settings, files (**planned**), health, bootstrap, database; **PdfModule** (`PdfRenderer` — employee profile + questionnaire A4; imports contracts only, not Organization/Questionnaires app modules); shared HTTP helpers (e.g. `attachmentContentDisposition`, `normalizeUploadedFileName`).
2. **Organization** — employees (Profile Core: contacts, emergency, important dates, employment assignments), departments, positions / Position Catalog (sidebar **`/positions`** «Керування посадами» — UI in `apps/web/src/app/features/positions/`; directions/departments/positions rail + full-width Groups+Skills block + position edit modal; root `/positions` tabs **Керування посадами** and **Формати** — employment catalogs with description + drag-reorder (`EmploymentCatalogService` single entry; [position-catalog.md](dev/position-catalog.md)); per-position catalog at **`/positions/:id/catalog`** via the book icon (does not load settings); [ADR 0010](adr/0010-position-catalog-and-questionnaire-context.md)), schedules, access scope. Skill native scale (`range`/`percent`): Context V1 questionnaire ratings stay 0–5; V2 uses frozen native scale + `skillId`. Profile `employee_skill_assessments` bridged from Managing proposals. Skill group is optional live classification (`group_id` nullable). `DELETE` skill/group is hard delete; `PATCH isActive` toggles. `SkillsService` is the application entry point for skill/group mutations (generated group codes, Group→Skill lock protocol). `PositionRequirementsService` lists requirements `createdAt ASC, id ASC`. Pre-create requirements exist only as a frontend draft queue.
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
- **Org mutate auth (shared):** pure `canMutateEmployeeOrgAssignment` (`employees.change_assignment` / Admin today) gates People `canEditEmployment`. Absences detail dept/position is **read-only** (Access SoT = active EA). Hire/create writes **initial active EA** + mirror + `IdentityRoleProjection`. Display `directionId`/`directionName` derived from current EA.

### Access variant 2 + ADR 0011 (visibility + account roles)

- **Org leadership:** Position `managementKindTemplate` / EA `managementKind` (`none` | `departments` | `direction`). Direction expands to all departments of the EA direction for Access scope. Legacy booleans are display mirrors only.
- **Account roles (Platform AccessControl):** `account_roles` + `app_surfaces` + `users.account_role_id` (NOT NULL). `AuthorizationContextService.resolve` is the authZ SoT for Guard / `/me` / Access adminEquivalent. `users.role` is a compatibility mirror.
- **No `adminAccess` toggle** — full admin = system role `admin` or custom `is_admin_equivalent`. RoleAccess assigns `accountRoleId` independently of EA `managementKind` (leadership is scope only; omitted-role create/attach may seed default employee/DM from leadership).
- Settings **«Доступи»** (`/settings/access-roles`) — adminEquivalent-only CRUD. Surface AND permission for UI. `GET /positions` = catalog; `GET /positions/manage` = scoped management. Profile toggles (extras): `employees.create` (global), `employees.create_account_at_create` (atomic login on create only; ≠ attach), `employees.manage_profiles` (managed-dept; not in DM preset), `employees.assign_account_role` + assignable catalog (`AssignableAccountRoleOption` wire SoT; FE entry `AccountRolesApiService.getAssignableRoles`) + admin-equivalent ceiling. Questionnaire toggles: template-code checklist (`account_role_questionnaire_templates`), Assign (extra; **not** in DM preset), Manage triad (`manage_lifecycle`∧`delete`∧`apply_profile_changes`; proposals accept/reject under Manage + fail-closed profile write policy). Create EA `managementKind` = Position template only (no client override on `CreateEmployeeRequest`). Legacy `PATCH /employees/:id` = adminEq-only.
- Living surfaces catalog: [access-surfaces.md](product/access-surfaces.md). Decision: [ADR 0011](adr/0011-org-leadership-vs-account-role.md).

### Documents MVP

Documents module owns `employee_documents` (submission) + `employee_document_files` (attachments; interim `content_base64` until Platform Files). Upload: `POST …/documents/employees/:employeeId` with `files` (multi, max 20; limits in `document-limits.ts`); optional multipart `isConfidential` (omitted → false). Download: `GET …/documents/:documentId/files/:fileId/download`. List orders documents `createdAt DESC, id DESC` and files `createdAt ASC, id ASC`.

**AuthZ (ADR 0012):** `DocumentTypeAccessPolicy` (owner / adminEquivalent / managed-scope manager-visible types) + `DocumentResourceAccessPolicy` (type ∧ confidential) + Platform `ConfidentialAccessPolicy` (`confidential.view`; canView ≠ canMark). Sensitive types (`questionnaire`, `identity`, `medical`, `consent`) remain type-gated; confidential is additive and never widens type write/read. Upload/delete require `documents.manage` + scope + type write; mark requires `canMark`. SoftDelete uses the same resource mutation gate as download (404 concealment). Resolve AuthZ + `resolveTargetAccess` once per op. Decision: [ADR 0012](adr/0012-confidential-classification.md).

### Identity roles (runtime)

`employee` · `department_manager` · `admin`. No separate `hr` role — admin (+ permissions) covers HR-like actions.

Password lifecycle is **Platform `AuthService`** only. `CurrentUserResponse.mustChangePassword` is mapped in one place (`toCurrentUser`) for login, `GET /auth/me`, and `POST /auth/change-password`. After login with the flag set, the web app opens **`/change-password`** (outside the shell). Success issues a **new JWT** (`tokenVersion++`, flag false) in the same response so the client can `SessionStore.setAuthenticated` atomically. Admin `POST /auth/reset-password/:userId` sets the flag and bumps `tokenVersion`; the next API call with the old token is 401. A single HTTP interceptor logs out and navigates to `/login` (login and change-password URLs are exempt). Absences does not own this flow or a second session.

### People UI

CRM employee profile: `/people/:id` — tabs Дані працівника, Робота (Посада · Графік роботи · Заявки · Календар), Документи, Анкети (Questionnaires 360 — [ADR 0009](adr/0009-questionnaire-360-mvp.md)), **Про себе** (`people.tab.about`; Profile Core — [people-about-tab](product/people-about-tab.md), [ADR 0014](adr/0014-employee-about.md)), Показники (підвкладка **Матриця навичок**), Адміністрування (підвкладки **Історія** · **Акаунт**). Surface `people.tab.later` reserved (no UI «Згодом» tab). Tab «Робота» always visible (hosts Посада); schedule/requests/calendar subtabs gated by `absences.calendar.view`. Also gated: `documents.view`, `questionnaires.view`; Адміністрування when `canViewHistory` **or** any account/delete cap (hide, not empty-state). History timeline: actor label + UA summary (missing User → **«Видалений користувач»**). **Акаунт:** create/attach, reset password (incl. self), activate/deactivate/delete login (not self), hard-delete Employee **operational aggregate** via `DELETE /api/v1/employees/:id` → `EmployeeDeletionCoordinator` + module erasure facades (Absences/Documents/Questionnaires/Organization) in one TX; FK `ON DELETE RESTRICT`; aggregate `pessimistic_write` lock; external files via `file_deletion_outbox` after COMMIT (not GDPR total erasure). **Create:** `/people/new` SoT ([ADR 0013](adr/0013-employee-create-sot.md)); Absences `/employees/new` redirects; UI gate `EmployeesCreate`∧`EmployeesView`; API `POST /employees` + AuthorizationContext. People list `/people`: Absences-like directory (без completeness UI). Absences PW-parity card `/absences/employees/:id` has **no** account admin UI. Living phase status: [hr-profile-roadmap.md](product/hr-profile-roadmap.md). Work calendar intent: [work-calendar-roadmap.md](product/work-calendar-roadmap.md), [ADR 0008](adr/0008-work-calendar-via-absences.md). Boundaries: [ADR 0007](adr/0007-employee-profile-boundaries.md).

People «Посада» (under Робота) create/edit uses a dedicated modal dialog (exclusive create|edit state, scrollable body, Create/Save; free-text field **Коментар** → API `comment`). FE write entry remains `EmploymentAssignmentsApiService`; cascade filters live in shared `apps/web/.../shared/organization/employment-org-filter.policy` (also used by Managing `organization_ref` fill fields).

### Questionnaires FE boundary

- **Public:** `apps/web/src/app/features/questionnaires/public-api.ts` — People panel, snapshot summary, `buildQuestionnaireAssignmentLink` (URL only).
- **Contextual help:** engine in `apps/web/src/app/core/help/` (`HelpTourService` single runtime entry — owns **Escape** in capture phase while `session()!=null`; `HelpSpotlightOverlay` presenter + **Tab focus trap**, z-index 9000 under API lock 10000; `OverlayScrollLockService` ref-counted). Composition root `apps/web/src/app/help/register-app-help.ts` registers tours/descriptors at boot (pure leaf modules only). Global `?` = `HelpMenu` in Shell / fill chrome; **modal titlebar** `loom-help-trigger` is the guaranteed dialog entry (Shell reachability is conditional — e.g. document-upload backdrop can cover topbar). Page context via route descriptors + feature `setFeatureContext` REPLACE-by-owner with **dialog precedence** (Positions / People / Settings access-roles); children emit dialog kind, owners write context; cleared on destroy / dialog close without navigation. Domain copy SoT in `*-help.definition.ts` — block-level page steps that describe what the highlighted UI is for; dialog field tours describe controls; no meta «після підказки натисніть…» / advertising modal `?`. Statistics stays `soon`.
- **Private:** immersive chrome-less fill `/questionnaires/:id` (`fill/` — FillChrome, section progress rail under `fill/progress/`, DraftStore, AutosaveCoordinator, RevisionCoordinator, WizardShell, field widgets, `questionnaire-fill-session.policy`). Not re-exported; left sidebar stepper removed. First-fill auto-edit before step resolve; Review lock-in «Надіслати». Request-changes: comment popover, active-request banner + resolve actions, list amber indicators — living detail in [hr-profile-roadmap.md](product/hr-profile-roadmap.md) § «Запит змін».
- Shell hides topbar/sidebar via route `data.hideAppChrome` (leaf walk); directory `/questionnaires` keeps chrome.
- Assignments may be **unattached** (`status: new` or detached `cancelled` with `employeeId = null`, `detachedFromEmployeeId` as **authorization provenance** while detached). Reattach via `POST .../attach` to **any** attachable employee (`new` needs Assign; cancelled needs ManageLifecycle), including cross-employee after fill (portable answers kept; org allowlist + skills.matrix reconciled; draft revision bumps). Submissions store immutable `subjectEmployeeId`; employee-facing snapshot reads filter by it. Audit records `fromEmployeeId`→`toEmployeeId`. Unattached `new` **READ** = Assign∨Lifecycle∨Delete ∧ template-code grant (View alone never sees the global pool). People list excludes `cancelled`. Each assignment has immutable human `code` (e.g. `360-002`); template **types** `full` | `managing` | `docs` (`employee-360` = `full` / «Повна анкета»; `employee-starter` = `full` / «Первинна» — особисті/контакти/сімʼя/освіта/досвід + Managing `company_work` + consents; published Managing/Docs content). Visibility is **per AccountRole template-code grants** (not owner type ACL). **PDF (paper-form layout 2.4):** Platform `PdfModule` / `PdfRenderer.renderQuestionnaire` (atomic controls, measure-before-draw); Questionnaires `QuestionnairePdfExportService` single entry; blank + filled formats; print-source + projector in `@loom/questionnaire-schema`; blank printable under View (`/templates/printable`). Download names include employee таб.№ + ПІБ when attached (`buildQuestionnairePdfFilenames`); FE uses `Content-Disposition` (`filename*`). Living: [questionnaire-pdf.md](product/questionnaire-pdf.md), [ADR 0015](adr/0015-questionnaire-pdf.md).
- **Profile mirror:** assignment `profileMirror` from `buildQuestionnaireProfileMirror` — **ACL slicing** via `includePersonal` / `includeEmployment` (not «canEditDraft ⇒ full mirror»). Schema `profileMirrorKey` hydrates display defaults; `proposalMapping` drives profile proposals. Skipped when `employeeId` is null.
- **Position context sync:** `syncLocked` core + `QuestionnairePositionContextSyncService` (`POST …/sync-position-context`) — Managing only; body includes `desiredExtraSkillCodes`; Facade `buildSnapshotForPosition` + canonical org freeze; prune stale ratings + revision bump. Close-submit reuses `syncLocked` (extras from persisted V2) without nested TX ([ADR 0010](adr/0010-position-catalog-and-questionnaire-context.md)).
- **Skill matrix buckets:** People `GET …/skill-assessments` → `{ profileItems, extraItems, capabilities }`; Managing fill UI splits profile vs extras the same way ([ADR 0010](adr/0010-position-catalog-and-questionnaire-context.md)).
- Questionnaires HTTP: `QuestionnairesApiService` only (no employee endpoints on that gateway).

### Questionnaire schema library

- `@loom/contracts-questionnaires` — API/DTO/schema **shapes only** (incl. `visibleWhen`, layout meta, `organization_ref`, `profileMirrorKey`, `QuestionnaireContextV1`/`V2`).
- `@loom/questionnaire-schema` — framework-free domain helpers: visibility, `projectVisibleQuestionnaireAnswers`, completion %, preferred-language serialize/parse, schema validation. Used by `apps/api` + `apps/web`. Contracts must **not** import this package. API loads compiled `dist/` (CJS); web path-maps to `src/` (Angular). Build via `pnpm --filter @loom/questionnaire-schema build` (also from API `dev`).
- `@loom/employee-contacts` — canonical contacts bundle shape, draft normalize vs write validate, snapshot/completion helpers. Shared by API Organization facade, questionnaire proposals, and web shared editor (`apps/web/src/app/shared/employee-contacts/public-api.ts`). Questionnaires module uses Organization `EmployeeContactsFacade` only (no direct contact entities).
- `@loom/position-skill-catalog` — stable skill codes/labels (HTML §7) for questionnaire `position_skills_matrix` and future Organization skills seed. Questionnaires and Organization both import this lib; Organization must never import Questionnaires seed. Context envelopes: `QuestionnaireContextV1`/`V2` in contracts ([ADR 0010](adr/0010-position-catalog-and-questionnaire-context.md), [position-catalog.md](dev/position-catalog.md)).
- Shared FE org cascade: `shared/organization/employment-org-filter.policy` — People assignment + Managing `organization_ref`.
### Application startup

Single Nest `OnModuleInit` in `apps/api/src/application-startup/` orchestrates `ApplicationBootstrapService.ensureReady()`, then `QuestionnaireSeedService.ensureEmployee360V1()`, then `EmploymentAssignmentLifecycleService.activateDueAssignments()`. Platform must not import Questionnaires; seed services do not self-init via `OnModuleInit`.

### Profile completeness

Role-independent dual score (`core` / `extended`) via pure calculator (`employee-profile-completeness.ts`); `header.completenessPercent` and list `completenessPercent` = core only; `extended` is `null` for managers viewing others. List enrichment is batched (no per-row scope queries). See [hr-profile-roadmap.md](product/hr-profile-roadmap.md).

### Employee list org projection

`EmployeesService.findAll`: `listVisibleEmployees` → `batchDisplayedOrgProjection` (canonical `selectCurrentEmploymentAssignment` + `resolveEmployeeDisplayedDirection`) → org/q/status filters → `batchCompleteness` on survivors → uk-UA label sort → `toListDto` with `displayedDirection` + `accountRole`. Direction filter/sort/DTO share one projection. Account with missing `user.accountRole` fails closed.

## Code location (Variant A)

Backend modules live under `apps/api/src/{platform,organization,modules}` — not separate npm packages until a second backend app needs them.

## Contracts

`libs/contracts/*` hold API shapes only (`@loom/contracts-auth`, `employees`, `absences`, `documents`, `questionnaires`, …). Entities and Nest DTOs stay in the API. Mappers convert domain → response.

## Data access

Single NestJS REST API is the only data entry point for the Angular client. One PostgreSQL database; tables owned by modules; no TypeORM `synchronize`.
