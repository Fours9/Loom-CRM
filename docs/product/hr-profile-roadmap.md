# HR / Employee profile roadmap

**Living status** (відповідає коду). Цільова / довга спека: [employee-profile-core.md](./employee-profile-core.md) — vision, не статус імплементації. Reference questionnaire: [references/anketa_360.html](./references/anketa_360.html).

| Phase | Scope | Status |
| --- | --- | --- |
| **1. Employee Profile Core** | Header, section edit (basics/contacts/personal/dates/employment), assignment history, capabilities, audit/history API, completeness, `/people/:id` | **Done** |
| 2. Self-service + approval | `/me/profile`, change requests, approval queue | Planned |
| 3. Questionnaires MVP | Seeded 360 template, assign, draft autosave, immutable submissions, review, profile proposals, fill wizard ([field catalog](./questionnaire-360-field-catalog.md), [ADR 0009](../adr/0009-questionnaire-360-mvp.md)). Track B: published Managing/Docs content. | **In progress / Partially implemented** (foundation + fill + Track B content shipped; see Remaining below) |
| 3b. Position Catalog | `/positions` («Керування посадами») + `/positions/:id/catalog` (book icon; list click does not open catalog), position↔direction/dept, skills requirements, frozen questionnaire context | **Shipped (PR1–PR6)** — closeout docs PR7; optional fill suggestions from `goalTemplates`/`duties` deferred ([ADR 0010](../adr/0010-position-catalog-and-questionnaire-context.md), [position-catalog.md](../dev/position-catalog.md)) |
| 4. Onboarding | Templates, tasks, progress widget | Planned |
| 5. Goals + probation reviews | Goals, manager review cycles | Planned |
| 6. Skills + development | Catalogs, position requirements, assessments | **Partial:** catalogs + requirements shipped (3b); `employee_skill_assessments` + People/Managing **two-block** matrix (profile vs extras) + Managing `add_skill` proposals + close-submit dual policy **shipped** (this increment); self/manager multi-assessment history still planned |
| 7. Documents + consents | File metadata, verification, consent versions | **Partially implemented** |
| 8. Compensation + grades + analytics | Separate sensitive APIs | Planned |
| 9. Recruitment + offboarding | Later | Planned |

Phase 1 boundaries: [ADR 0007](../adr/0007-employee-profile-boundaries.md).

## Profile completeness (living)

- **Core** (кадровий): identity, active assignment (status=active + department **або** position + startDate), work contact (`phoneNumber`/`workEmail` або contact rows). Badge / `header.completenessPercent` = core only.
- **Extended** (добровільний): photo, personalCore, personalContacts, emergency, importantDates. Не знижує core; UI без «обов’язково».
- **Особисті контакти (PR-P):** write SoT = `employee_contacts` (`personal_phone` / `personal_email` / `personal_telegram`, кілька рядків + `isPrimary`). Legacy колонки `employees.personal_*` — one-way mirror primary для Absences/completeness; read fallback якщо rows відсутні. API: `PUT /api/v1/employees/:id/personal-contacts`. People UI — add/remove у вкладці Контакти.
- Score рахується **role-independent** з повних даних; у response `extended: null` для Manager на чужому профілі (owner + Admin бачать breakdown).
- **Список `/people`:** той самий pure calculator (`employee-profile-completeness.ts`); у list DTO поле `completenessPercent` = **core only**. Query: `sortBy=completeness`, `maxCompleteness` (score ≤ N). Enrichment batch (work contacts + assignments); без `getProfile()` / per-row scope queries. Assignment parity з profile: `currentAssignmentId` має пріоритет; active-by-employee лише якщо `currentAssignmentId` відсутній.

## Phase 1 — що в UI зараз

`/people/:id` вкладки (visibility через `visiblePeopleProfileTabs` + `resolvePeopleProfileTab`):

| Вкладка | Стан | Видимість |
| --- | --- | --- |
| Дані працівника | Основні · Контакти · Дати (редагування за capabilities) | завжди |
| Робота | **Посада** (planned/blocked assignment history) + **Графік роботи** + Заявки + Календар (Absences `public-api`: schedule panel через `getEmployee` + `PUT .../schedule`; UI = `ScheduleEditor`. Empty API schedule ≠ default Пн–Пт — дефолт лише в draft при редагуванні. Compat TimeEvent — [work-calendar-roadmap](./work-calendar-roadmap.md)). Підвкладки графіка — за `absences.calendar.view` | завжди (Посада); графік — `absences.calendar.view` |
| Документи | Documents MVP + агрегат вкладень time-event (Absences) | `documents.view` |
| Анкети | Directory `/questionnaires` + People panel; assign/cancel/reactivate/close/delete; fill wizard | `questionnaires.view` |
| Показники | Stub (roadmap Phase 5 / 8) | завжди |
| Адміністрування | Підвкладки **Історія** + **Акаунт** + **Роль та допуски**: audit; account lifecycle + email; adminAccess + visibility overrides | `canViewHistory` **або** account/delete **або** access caps |
| Згодом | Stub (майбутні модулі) | завжди |

Недоступні вкладки **ховаються** (не disabled empty-state). Після reload / зміни permissions активна недоступна вкладка скидається на «Дані працівника».

Адміністрування (деталі):

- Top tab visible when history **or** any account/delete cap **or** `canEditAdminAccess` / `canEditVisibilityOverrides`.
- Subtabs: **Історія** → **Акаунт** → **Роль та допуски** (fallback у цьому порядку).
- **Роль та допуски:** toggle «Адміністратор» (`adminAccess`); computed DM/employee read-only; visibility overrides. `PATCH …/access-settings` → `updateAccessSettings` (не generic `PATCH /employees/:id` з `role`).
- **Акаунт:** login email view/edit (`canViewAccountDetails` / `canEditAccountEmail`); `PATCH …/account/email`.
- Hard-delete confirm = `employeeNumber`; navigate `/people`. Not GDPR wipe.
- Absences card: без role/managed/overrides/account email; dept/position read-only. Hire створює initial active EA; без ручного role/manager.

### Access variant 2 (living)

- Position → manager **template** only (`isDepartmentManagerTemplate` + join).
- Active EA → actual manager membership + managed depts; sole **visibility-scope** SoT (actor + target).
- `IdentityRoleProjection.apply({ adminAccess })` — sole `User.role` / `Employee.role` mirror writer; `tokenVersion++` on role change.
- `employees.departmentId` / `positionId` — display mirror only, never authorization SoT.
- Legacy `employee_managed_departments` + `User/Employee.isDepartmentManager` — stop-read/write for auth (physical DROP later).

### Адміністрування → Історія / Акаунт / Роль (living)

- Історія: `GET …/history` → дата · актор · UA summary (`EmployeeProfileHistoryItem`). Missing User → **«Видалений користувач»**.
- Акаунт: `EmployeeAccountApiService` + panel — attach (`POST …/account`, **без** `role`), reset, activate/deactivate/delete login, email change, hard-delete.
- Роль: `EmployeeRoleAccessApiService` + panel → `PATCH …/access-settings`.
- Caps: `canCreateAccount`, `canResetPassword`, `canManageAccount`, `canDeleteEmployee`, `canEditAdminAccess`, `canEditVisibilityOverrides`, `canViewAccountDetails`, `canEditAccountEmail`.

- Endpoint: `GET /api/v1/employees/:id/history?limit=` (1–100, default 50; **cursor pagination ще немає**).
- Response item: `action`, `summary` (статична UA-мапа), `actor: { userId, label } | null` (`null` = «Система»), `createdAt` ISO, redacted `metadata`.
- Actor label (поточний display, не historical snapshot): linked Employee → ПІБ; User без Employee → email; missing User → «Видалений користувач».
- Batch: `UsersService.findByIds` + Employees by `userId`; без N+1.

### Список `/people` (living)

- Flat contract `@loom/contracts-employees` → `EmployeeListItem` (incl. `completenessPercent`, ISO dates).
- UI: колонка/badge `%`, фільтр повноти (Усі / до 25 / 50 / 75 / менше 100%), sort ПІБ або повнота — **серверні** query params.

PW-паритетна картка `/absences/employees/:id`: Напрямок / Відділ / Посада **read-only**; role / managed / overrides / account email **прибрано** (People Admin). Hire: initial active EA з org + Position template.

### Робота -> Посада / Дані працівника -> Дати (living)

- `Дати` редагує employee-level `hiredAt` через `PATCH /employees/:id/employment-meta`. Це дата початку роботи / найму і вона не змінюється автоматично від переводів.
- `Посада` (підвкладка вкладки **Робота**) використовує shared org catalog snapshot (`directions -> departments -> positions`) і довідники `workFormats` / `employmentTypes`.
- Створення й редагування призначення — **модалка** (`EmploymentAssignmentDialogComponent`): один exclusive dialog slot (`create` | `edit`), крестик / Escape / backdrop close, scrollable body, кнопка **Створити** або **Зберегти**. Поле **Коментар** → API/DB `comment` (не плутати з `employees.comment`). Historical audit metadata may still have `changeReason`; new assignment API/domain/audit uses `comment`; no backfill. Write path лишається `EmploymentAssignmentsApiService` → `EmployeeProfileService`.
- `companyId` більше не вводиться в UI вручну; компанія лишається read-model, derived з обраного напрямку.
- Майбутня дата переводу створює `planned` assignment. Поточне активне призначення не перемикається відразу; activation виконується lifecycle service.
- Якщо planned assignment не може активуватися на дату старту, запис лишається `planned` і показує `activationBlockedReason` в історії/деталях.

## Phase 3 — Questionnaires 360 (living)

**Status:** In progress / Partially implemented.

**Shipped:**
- foundation: module `apps/api/src/modules/questionnaires/`; contracts `@loom/contracts-questionnaires`; permissions; seed `employee-360` v1 (steps: особисті дані · контакти · … · сильні сторони …; **без** «робота в компанії» — лише Managing); assign/list/detail/draft PATCH (optimistic revision)/submit/request-changes/review; profile proposals + accept/reject via `EmployeeProfileService`
- assign panel + snapshot summary on People «Анкети»
- **fill wizard (PR-4):** immersive chrome-less `/questionnaires/:id` (route `hideAppChrome`); FillChrome + section progress rail (`fill/progress/`; UX grouping ≠ linear step order); sidebar stepper removed; schema-driven wizard (Intro → schema steps → Review); serialized autosave; unified manual save via RevisionCoordinator; 409 conflict UI; `flush()` before submit; browse SoT in `questionnaire-step-browse` + DraftStore; FE entry `questionnaires/public-api.ts` (+ `buildQuestionnaireAssignmentLink` only — wizard/store private). **First-fill** (`assigned`/`in_progress` + `canEditDraft` + 0 submissions) auto-begins edit session **inside** `store.load()` before step resolve (linear gating). Lock-in on Review = «Надіслати» (`flush` + POST submit); revision on other steps = chrome «Зберегти і закрити»; `changes_requested` / submitted|reviewed stay view-first. List `canStartFill` → People «Почати».
- **schema UX:** steps `family` + `celebration_dates`; `visibleWhen`; layout groups; from/to periods; preferred_language multi; submit projects visible answers; `@loom/questionnaire-schema`; startup composition root; fail-safe `pnpm questionnaires:reset` ([runbook](../dev/questionnaire-test-reset.md)); `family.other_dates` repeating list (Назва/З/По, **snapshot**, не профіль)
- **revision + proposals:** owner `POST .../reopen` vs HR request-changes (different submission review side effects); pending → `superseded` on reopen; atomic submit+proposal generate; proposals nested under assignment; UI «Зберегти і закрити» = new immutable submission
- **request-changes UX** — див. підрозділ нижче
- **assignment lifecycle:** create without employee → `new` (optional employee + service `comment` + immutable `assignment.code`); cancel detaches (`employeeId=null`, `detachedFromEmployeeId=previous` auth provenance); attach — **any** employee for `new` (Assign) and cancelled (ManageLifecycle); audit from→to; close terminal; hard delete when `canDelete`. People excludes cancelled. Detached: `new` pool for Assign; cancelled scoped by `detachedFromEmployeeId`. Comment read: `questionnaires.read_assignment_comment` (Admin). Templates create list: published + version.
- **permissions split:** `questionnaires.assign` (create + attach new; Admin + DM); `questionnaires.manage_lifecycle` (cancel/close/reattach; Admin); `questionnaires.delete` (Admin). DM does **not** get CompleteAny — may assign Managing/Docs; Admin fills.
- **types:** `full` | `managing` | `docs` (`QUESTIONNAIRE_TYPE_CATALOG`). `employee-360` = `full` («Повна анкета»); `employee-starter` = `full` («Стартова», поки лише вступ + перегляд). **Track B content schemas shipped:** published `employee-managing` (grade without `net_salary`, `skills.matrix` / `position_skills_matrix`, career + probation goals) and `employee-docs` (onboarding repeating_groups + hr_documents checklist). `manager_review` / `grade.net_salary` **not** shipped. Owner ACL: plain owner sees/fills only `full`; elevated (Assign/ManageLifecycle/CompleteAny/Delete) all types. No `hr` role — product «HR» = Admin.
- **Managing/Docs UX parity (shipped):** Docs/Managing personal = ПІБ + `birth_date` + `city` (**no** `preferred_name`); Managing `company_work` = `organization_ref` org lists (shared `employment-org-filter` + `profileMirrorKey`); Full 360 **omits** `company_work` (org SoT = Profile Core); skills matrix + Context V2 (`skillId` + native scale + `questionnaire_extra` via `desiredExtraSkillCodes` sync).
- **Position Catalog (Phase 3b):** sidebar `/positions` (directions/departments/positions rail + Groups+Skills block + position edit modal with pre-create draft skill queue; `/settings/positions` redirects); dedicated catalog page `/positions/:id/catalog` from the book icon on the position row; clicking the position name does nothing (inline panel not opened from list); Organization skill catalog with optional groups, hard-delete vs `PATCH isActive` toggle, native `range`/`percent` scale independent of questionnaire 0–5; assign/attach freezes **Context V2** (`buildSnapshotForEmployee`; custom skill codes + `source`). Matrix: legacy null = registry; V1 historical = frozen rows; V2 = requirements + `questionnaire_extra`. See [ADR 0010](../adr/0010-position-catalog-and-questionnaire-context.md).
- **directory + access:** nav «Анкети»; `canCreate` / `attachConstraint` on directory; `new` draft editable without submit (CompleteAny); cancelled/closed fill = read-only; print stubs («Незабаром»). **PDF (planned):** blank template and filled questionnaire share one layout; filled only substitutes values — not shipped yet.
- **directory + access (legacy note):** historical cancelled with non-null employeeId stay attach-blocked until manual detach; view/close/delete only.

### Запит змін (request-changes) — living

Спільний шлях ревʼюера «потрібні правки» (не плутати з owner `reopen` / admin `start-revision`). Статус assignment `changes_requested` може зʼявитися і без reviewer comment — тоді **немає** фальшивого банера «Потрібні зміни».

#### Кнопка «Запросити зміни»

- Capability: `QuestionnairesReview` + status ∈ `{submitted, reviewed}` + **`!canEditDraft`** (немає **прямого** редагування чернетки в **поточному** статусі). Це **не** `!canStartRevision`.
- На поточній матриці ролей Admin у `submitted|reviewed` зазвичай уже має `canEditDraft === false`, тож кнопку бачить; далі може сам відкрити редагування через lifecycle і **сам** резолвити свій запит (self-resolve дозволено).
- UI: popover «Що потрібно змінити?» (обовʼязковий trim-коментар, max 2000); після успіху — reload **без** `beginEditSession` (ревʼюер лишається в перегляді).

#### API

| Endpoint | Примітка |
| --- | --- |
| `POST …/assignments/:id/request-changes` | Body: `{ reviewComment: string }` (обовʼязково) |
| `POST …/submissions/:id/review` з `reviewStatus: changes_requested` | Той самий обовʼязковий comment; **лише latest** submission, інакше **409** |
| `POST …/assignments/:id/resolve-changes` | `{ outcome: 'completed', expectedDraftRevision }` або `{ outcome: 'declined' }` |

Доменний fail-closed: whitespace-only comment → помилка навіть якщо HTTP-валідація обійдена. У `applyReopenTransition` для `reviewer_request_changes` також **скидаються** `changeRequestResolution` / `resolvedBy` / `resolvedAt` (повторний request після declined знову активний). На одному submission зберігається лише **останній** цикл запиту; повна історія циклів — окрема entity (поза скоупом).

Summary (list `latestSubmission`, detail `submissions`, directory): поля `reviewComment`, **`reviewedByUserId`**, **`changeRequestResolution`** (`completed` \| `declined` \| `null`). `resolvedBy` / `resolvedAt` на FE не віддаються.

#### Активний reviewer request (`hasActiveReviewerRequest`)

```text
assignment.status === 'changes_requested'
&& latest.reviewStatus === 'changes_requested'
&& непорожній reviewComment
&& reviewedByUserId !== null
&& changeRequestResolution === null
```

Якщо `reviewedByUserId` відсутній (старі/биті дані): банер не як запит ревʼюера; resolve → **409**; notify при резолві не створюється.

- **Банер** fill: amber «Потрібні зміни» + коментар **лише** при активному запиті; кнопки «Правки виконано» / «В правках відмовлено» при `canResolveChangeRequest` (= активний запит + `canEditDraft`).
- **People-картки:** amber `!` + tooltip з коментарем при активному запиті; інакше при статусі `changes_requested` — нейтральний «Анкету відкрито для редагування» (owner reopen тощо).
- **Каталог:** підсвітка рядка (`td`) лише при активному запиті, не при голому статусі після declined+reopen.

Індикатори списків — **для всіх**, хто бачить список; **не** залежать від того, хто отримав inbox.

#### Inbox (лише in-app notifications)

| type | Кому | Коли |
| --- | --- | --- |
| `questionnaire.changes_requested` | `assignedByUserId` (активний User); якщо автор відсутній/неактивний **або** після transition `canEditDraft === false` — також усі активні `admin`; без self-notify | Після успішного request у **тій самій TX**, що й transition |
| `questionnaire.changes_completed` | `reviewedByUserId` запиту (skip якщо === actor) | Resolve `completed` |
| `questionnaire.changes_declined` | те саме | Resolve `declined` |

Оцінка `canEditDraft(assignedBy)` — **після** transition (status уже `changes_requested`). До transition у `submitted|reviewed` майже завжди `false` → хибний fan-out на всіх Admin. Крайній кейс: actor === assignedBy і після transition може редагувати → **0** notifications (очікувано).

`payload.assignmentId` → deep link `/questionnaires/:id`. Absences: `payload.requestId` → `/absences/requests/:id` (FE mapper з raw `payload`).

#### Resolve

- **`completed`:** lock assignment + response + active submission; `response.revision === expectedDraftRevision` (інакше **409**, без snapshot/proposals/notify); `submitWithinTransaction` у тій самій TX; resolution на **тому** submission, що тримав запит; notify ревʼюеру.
- **`declined`:** assignment → `submitted`; resolution = `declined` на submission; notify ревʼюеру; без нового snapshot.
- Draft PATCH — атомарний CAS (`UPDATE … WHERE revision = :expected`); mismatch → 409.

**Remaining (request-changes):** окрема entity циклів запиту; email/push; Playwright e2e матриця request→decline→re-request.

**Remaining (загальне Phase 3):** auto-apply answers to profile (explicitly out); Phase 2 `/me` approval queue; IndexedDB offline; full Playwright matrix; template builder; production template v2 when real assignments exist; optional fill suggestions from frozen `goalTemplates` / `duties` (context already captured).


## Phase 1 — відкладені polish (не блокують Done)

- ~~Збагачена історія (actor + UA summary)~~ — **зроблено** (див. вище; cursor pagination поза scope).
- ~~Ховати вкладки без доступу~~ — **зроблено**.
- ~~Completeness filter/sort на `/people`~~ — **зроблено**.
- Photo upload у профілі (потрібен Platform Files).

## Phase 7 — Documents (деталь)

**Є:** `employee_documents` + `employee_document_files` (одне подання → кілька файлів, як absence attachments); permissions `documents.view` / `documents.manage`; People-вкладка Документи; upload через модалку (multi-file в одному поданні, FE cumulative max 20), list/download (`…/files/:fileId/download`)/preview/soft-delete подання; агрегат absence attachments; type-aware projection (manager не бачить чужі questionnaire/identity/medical/consent).

**Немає:** Platform Files (зараз interim `content_base64`); verification workflow; consent versions; окремий consents module.

## Notifications inbox (living)

- Soft-dismiss: `POST /api/v1/notifications/:id/dismiss` → `dismissed_at`; list/unread exclude dismissed (не hard delete).
- Frame tones: normalize legacy `absence.request.*` → `request.*` only; new absences emits use `request.approved` / `request.rejected`.

## Absences deletion (living)

- `pwPermissions.canRequestDeletion`: statuses **approved | rejected | cancelled**; actors admin | owner | submission-department manager. Runtime SoT = `pw-permissions.ts` only.
