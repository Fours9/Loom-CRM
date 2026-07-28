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

## Phase 1 — що в UI зараз

`/people/:id` вкладки:

| Вкладка | Стан |
| --- | --- |
| Дані працівника | Основні · Контакти · Дати · Посада (редагування за capabilities) |
| Робочий календар | Заявки + календар (compat Absences / TimeEvent — [work-calendar-roadmap](./work-calendar-roadmap.md)) |
| Документи | Documents MVP + агрегат вкладень time-event (Absences) |
| Показники | Stub (roadmap Phase 5 / 8) |
| Історія | Audit timeline (базовий) |
| Згодом | Stub (майбутні модулі) |

PW-паритетна картка без змін: `/absences/employees/:id`.

## Phase 1 — відкладені polish (не блокують Done)

- Збагачена історія: `actorDisplayName` + UA summary у UI (API вже віддає `actorUserId` / `action`).
- Ховати вкладки без доступу (`canViewHistory`, `documents.view`), замість empty-state «немає доступу».
- Completeness filter/sort на списку `/people`.
- Photo upload у профілі (потрібен Platform Files).

## Phase 7 — Documents (деталь)

**Є:** `employee_documents`; permissions `documents.view` / `documents.manage`; People-вкладка Документи; upload/list/download/soft-delete; агрегат absence attachments; type-aware projection (manager не бачить чужі questionnaire/identity/medical/consent).

**Немає:** Platform Files (зараз interim `content_base64`); verification workflow; consent versions; окремий consents module.
