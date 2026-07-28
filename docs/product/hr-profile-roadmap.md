# HR / Employee profile roadmap

**Living status** (відповідає коду). Цільова / довга спека: [employee-profile-core.md](./employee-profile-core.md) — vision, не статус імплементації. Reference questionnaire: [references/anketa_360.html](./references/anketa_360.html).

| Phase | Scope | Status |
| --- | --- | --- |
| **1. Employee Profile Core** | Header, section edit (basics/contacts/personal/dates/employment), assignment history, capabilities, audit/history API, completeness, `/people/:id` | **Done** |
| 2. Self-service + approval | `/me/profile`, change requests, approval queue | Planned |
| 3. Questionnaires MVP | Seeded 360 template, assign, autosave, submit, review, profile proposals | Planned |
| 4. Onboarding | Templates, tasks, progress widget | Planned |
| 5. Goals + probation reviews | Goals, manager review cycles | Planned |
| 6. Skills + development | Catalogs, position requirements, assessments | Planned |
| 7. Documents + consents | File metadata, verification, consent versions | **Partially implemented** |
| 8. Compensation + grades + analytics | Separate sensitive APIs | Planned |
| 9. Recruitment + offboarding | Later | Planned |

Phase 1 boundaries: [ADR 0007](../adr/0007-employee-profile-boundaries.md).

## Profile completeness (living)

- **Core** (кадровий): identity, active assignment (status=active + department **або** position + startDate), work contact (`phoneNumber`/`workEmail` або contact rows). Badge / `header.completenessPercent` = core only.
- **Extended** (добровільний): photo, personalCore, personalContacts, emergency, importantDates. Не знижує core; UI без «обов’язково».
- Score рахується **role-independent** з повних даних; у response `extended: null` для Manager на чужому профілі (owner + Admin бачать breakdown).
- **Список `/people`:** той самий pure calculator (`employee-profile-completeness.ts`); у list DTO поле `completenessPercent` = **core only**. Query: `sortBy=completeness`, `maxCompleteness` (score ≤ N). Enrichment batch (work contacts + assignments); без `getProfile()` / per-row scope queries. Assignment parity з profile: `currentAssignmentId` має пріоритет; active-by-employee лише якщо `currentAssignmentId` відсутній.

## Phase 1 — що в UI зараз

`/people/:id` вкладки (visibility через `visiblePeopleProfileTabs` + `resolvePeopleProfileTab`):

| Вкладка | Стан | Видимість |
| --- | --- | --- |
| Дані працівника | Основні · Контакти · Дати · Посада (редагування за capabilities) | завжди |
| Робочий календар | Заявки + календар (compat Absences / TimeEvent — [work-calendar-roadmap](./work-calendar-roadmap.md)) | `absences.calendar.view` |
| Документи | Documents MVP + агрегат вкладень time-event (Absences) | `documents.view` |
| Показники | Stub (roadmap Phase 5 / 8) | завжди |
| Історія | Audit timeline: дата · актор · UA summary (`EmployeeProfileHistoryItem`) | `capabilities.canViewHistory` |
| Згодом | Stub (майбутні модулі) | завжди |

Недоступні вкладки **ховаються** (не disabled empty-state). Після reload / зміни permissions активна недоступна вкладка скидається на «Дані працівника».

### Історія (living)

- Endpoint: `GET /api/v1/employees/:id/history?limit=` (1–100, default 50; **cursor pagination ще немає**).
- Response item: `action`, `summary` (статична UA-мапа), `actor: { userId, label } | null` (`null` = «Система»), `createdAt` ISO, redacted `metadata`.
- Actor label (поточний display, не historical snapshot): linked Employee → ПІБ; User без Employee → email; missing User → «Невідомий користувач».
- Batch: `UsersService.findByIds` + Employees by `userId`; без N+1.

### Список `/people` (living)

- Flat contract `@loom/contracts-employees` → `EmployeeListItem` (incl. `completenessPercent`, ISO dates).
- UI: колонка/badge `%`, фільтр повноти (Усі / до 25 / 50 / 75 / менше 100%), sort ПІБ або повнота — **серверні** query params.

PW-паритетна картка без змін: `/absences/employees/:id`.

## Phase 1 — відкладені polish (не блокують Done)

- ~~Збагачена історія (actor + UA summary)~~ — **зроблено** (див. вище; cursor pagination поза scope).
- ~~Ховати вкладки без доступу~~ — **зроблено**.
- ~~Completeness filter/sort на `/people`~~ — **зроблено**.
- Photo upload у профілі (потрібен Platform Files).

## Phase 7 — Documents (деталь)

**Є:** `employee_documents`; permissions `documents.view` / `documents.manage`; People-вкладка Документи; upload/list/download/soft-delete; агрегат absence attachments; type-aware projection (manager не бачить чужі questionnaire/identity/medical/consent).

**Немає:** Platform Files (зараз interim `content_base64`); verification workflow; consent versions; окремий consents module.
