# Документація LoomCRM

Модульний моноліт CRM: один логін, один PostgreSQL, Angular-клієнт лише через NestJS REST (`/api/v1`).

Документація розділена за аудиторіями:

| Розділ | Для кого |
| --- | --- |
| [Практичне](#практичне) | клон, щоденна робота з git, новий ПК |
| [Розробницьке](#розробницьке) | архітектура, ADR, деплой, експлуатація, cutover, parity |
| [Агенти](#агенти) | правила для AI / розробників у репозиторії |

Швидкий старт і стек — у кореневому [README.md](../README.md).

**Новий ПК:** після `migration:run` обов’язково `.\scripts\db-restore.ps1` — інакше жива Postgres порожня (знімок `data/app.snapshot.sql` сам не підхоплюється). Деталі: [git-sync](dev/git-sync.md).

## Зараз у коді

| Шар / модуль | Стан |
| --- | --- |
| **Platform** | auth, identity, permissions, audit, notifications, settings, health, bootstrap, DB |
| **Organization** | employees (Profile Core), departments, positions, schedules, access scope |
| **Absences** | повний PW-паритетний модуль відсутностей |
| **Documents** | MVP: `employee_documents`, People-вкладка + агрегат вкладень Absences (storage поки `content_base64`; Platform Files — planned) |
| **Questionnaires** | Phase 3 In progress: [field catalog](product/questionnaire-360-field-catalog.md), [ADR 0009](adr/0009-questionnaire-360-mvp.md); fill UI окремо |

**Ролі runtime:** `employee` · `department_manager` · `admin`. Окремої ролі `hr` немає (кадрові дії — через Admin + permissions).

**Профіль UI:** `/people/:id` — вкладки Дані працівника, **Робочий графік** (Графік роботи · Заявки · Календар; Absences `public-api`), Документи, **Анкети** (Questionnaires — [ADR 0009](adr/0009-questionnaire-360-mvp.md), [catalog](product/questionnaire-360-field-catalog.md); fill wizard окремо), Показники (stub), Історія, Згодом (stub); visibility gated by permissions/capabilities. Історія: актор + UA summary. Список `/people`: core `completenessPercent`, filter/sort. PW-картка: `/absences/employees/:id`. Living: [hr-profile-roadmap](product/hr-profile-roadmap.md).

**Робочий календар:** UI-назва; технічний namespace лишається Absences. Intent: [work-calendar-roadmap](product/work-calendar-roadmap.md), [ADR 0008](adr/0008-work-calendar-via-absences.md).

**Анкета 360°:** policy catalog → seed → `schema_json`; immutable `questionnaire_submissions` ([ADR 0009](adr/0009-questionnaire-360-mvp.md)).

| Тип документа | Призначення |
| --- | --- |
| **Living status** | цей hub, [roadmap](product/hr-profile-roadmap.md), [work calendar](product/work-calendar-roadmap.md), [architecture](architecture.md), [AGENTS.md](../AGENTS.md) |
| **Target / vision** | [employee-profile-core.md](product/employee-profile-core.md) — **не** статус імплементації |
| **Frozen decisions** | [ADR](adr/) 0001–0009 (рішення зафіксовані) |

Відкладено (Phase 1 polish): photo upload у профілі (потрібен Platform Files). History cursor pagination — поза поточним polish.

## Практичне

- [Синхронізація через Git](dev/git-sync.md) — pull/push, новий ПК, `db-snapshot` / `db-restore`, типові проблеми

## Розробницьке

- [Архітектура](architecture.md)
- [ADR](adr/) — зафіксовані рішення
- [Деплой (Docker Compose)](dev/deploy.md)
- [Експлуатація (operations)](dev/operations.md)
- [Production readiness checklist](dev/production-readiness.md)
- [Cutover ProjectWeekend → LoomCRM](cutover.md)
- [COPYMAP](COPYMAP.md)
- [Absences API parity](absences-api-parity.md)
- [Absences UI parity](absences-ui-parity.md)

## Продукт / HR

- [HR profile roadmap](product/hr-profile-roadmap.md) — **living** статус фаз
- [Work calendar roadmap](product/work-calendar-roadmap.md) — expand Absences → TimeEvent (MVP)
- [Employee Profile Core (target-спека)](product/employee-profile-core.md) — vision / Draft, не «що вже в коді»
- [Анкета 360° — reference only](product/references/README.md)
- [ADR 0007: profile boundaries](adr/0007-employee-profile-boundaries.md)
- [ADR 0008: work calendar via Absences](adr/0008-work-calendar-via-absences.md)

## Агенти

- [AGENTS.md](../AGENTS.md) — інваріанти репозиторію (ProjectWeekend read-only, межі модулів, migrations)

## Зафіксовані технічні рішення

| Рішення | Вибір |
| --- | --- |
| Frontend | Angular + TypeScript (`apps/web`) |
| Backend | NestJS + TypeScript (`apps/api`) |
| БД | PostgreSQL 16 (один інстанс; без TypeORM `synchronize`) |
| Пакети | pnpm **10.15.0** (поле `packageManager` + Corepack) |
| Node | **22.x** (`engines`: `>=22 <23`) |
| API | REST `/api/v1` |
| Copy-source | `ProjectWeekend/` — read-only, не комітиться в LoomCRM |

## Як читати

- Локальна робота / новий ПК → [git-sync](dev/git-sync.md) + кореневий README
- Що вже зроблено / що далі → [roadmap](product/hr-profile-roadmap.md) + блок «Зараз у коді» вище
- Production / VPS → [deploy](dev/deploy.md) + [operations](dev/operations.md)
- Межі модулів → [architecture](architecture.md) + [AGENTS.md](../AGENTS.md)
- Цільове бачення профілю → [employee-profile-core.md](product/employee-profile-core.md) (після living docs)
