# Документація LoomCRM

Модульний моноліт CRM: один логін, один PostgreSQL, Angular-клієнт лише через NestJS REST (`/api/v1`). Тимчасовий пароль змінюється на `/change-password`; скидання інвалідовує JWT (`tokenVersion`) і наступний 401 веде на `/login` — [архітектура](architecture.md), [експлуатація](dev/operations.md).

Документація розділена за аудиторіями:

| Розділ | Для кого |
| --- | --- |
| [Практичне](#практичне) | клон, щоденна робота з git, новий ПК |
| [Розробницьке](#розробницьке) | архітектура, ADR, деплой, експлуатація, cutover, parity |
| [Агенти](#агенти) | правила для AI / розробників у репозиторії |

Швидкий старт і стек — у кореневому [README.md](../README.md).

**Новий ПК:** інструменти (Node **22**, pnpm 10.15, Postgres/Docker, ngrok для демо) + після `migration:run` обов’язково `.\scripts\db-restore.ps1`. Деталі: [git-sync § Налаштування нового ПК](dev/git-sync.md#налаштування-нового-пк-перший-раз).

**Демо керівництву (публічний HTTPS з локальної машини):** [git-sync — Демо через тунель](dev/git-sync.md#демо-через-тунель-керівництво--зовнішній-https) (`.\start-tunnel.bat`).

## Зараз у коді

| Шар / модуль | Стан |
| --- | --- |
| **Platform** | auth, identity, permissions, audit, notifications (soft-dismiss: `dismissed_at`, `POST …/dismiss`), settings, health, bootstrap, DB |
| **Organization** | employees (Profile Core), departments, positions (+ manager template), schedules, **Access variant 2** (active EA scope); assignment `comment` |
| **Absences** | повний PW-паритетний модуль; `canRequestDeletion` для approved\|rejected\|cancelled (`pwPermissions`) |
| **Documents** | MVP + confidential classification (`is_confidential`, `confidential.view`); multi-file upload; People-вкладка + агрегат вкладень Absences (storage поки `content_base64`; Platform Files — planned) |
| **Questionnaires** | Phase 3: immersive fill; unattached `new` + attach/detach; template types (360=Повна); print stubs; PDF layout contract in roadmap (not shipped) |

**Ролі runtime:** `employee` · `department_manager` · `admin`. Окремої ролі `hr` немає (кадрові дії — через Admin + permissions).

**Профіль UI:** список `/people` = Absences-like directory (+ напрямок, AccountRole.name); створення — `/people/new` (`employees.create` ∧ `employees.view`, напрямок + AccountRole-at-create, [ADR 0013](adr/0013-employee-create-sot.md)); деталі `/people/:id` — вкладки Дані, **Робота**, Документи, **Анкети**, **Про себе**, Показники, **Адміністрування** (Історія · **Акаунт** · **Роль та допуски**). **Про себе:** soft voluntary ([people-about-tab](product/people-about-tab.md)); surface `people.tab.about`. **Роль та допуски:** assign `accountRoleId` + visibility overrides (без adminAccess toggle). Org leadership = `managementKind` на посаді/EA. Access: Platform `AuthorizationContext` + active EA scope; Settings **Доступи** (+ checkbox confidential). Living: [hr-profile-roadmap](product/hr-profile-roadmap.md), [access-surfaces](product/access-surfaces.md), [ADR 0011](adr/0011-org-leadership-vs-account-role.md), [ADR 0012](adr/0012-confidential-classification.md), [ADR 0013](adr/0013-employee-create-sot.md).

**Робочий календар:** UI-назва; технічний namespace лишається Absences. Intent: [work-calendar-roadmap](product/work-calendar-roadmap.md), [ADR 0008](adr/0008-work-calendar-via-absences.md).

**Анкета 360°:** types `full`/`managing`/`docs`; seed `employee-360` = full («Повна») + Variant A stubs managing/docs; immutable `questionnaire_submissions` ([ADR 0009](adr/0009-questionnaire-360-mvp.md)). Fill UI = schema-driven wizard на `/questionnaires/:id`. Кожне призначення має людський `code` (напр. `360-002`); створення через попап (тип+опис / працівник / службова примітка); каталог + профіль — пошук за кодом. Permissions: Assign (DM+Admin) vs Manage triad Lifecycle/Delete/Apply (Admin; proposals under Manage + profile write policy).

| Тип документа | Призначення |
| --- | --- |
| **Living status** | цей hub, [roadmap](product/hr-profile-roadmap.md), [work calendar](product/work-calendar-roadmap.md), [architecture](architecture.md), [AGENTS.md](../AGENTS.md) |
| **Target / vision** | [employee-profile-core.md](product/employee-profile-core.md) — **не** статус імплементації |
| **Frozen decisions** | [ADR](adr/) 0001–0012 (рішення зафіксовані) |

Відкладено (Phase 1 polish): photo upload у профілі (потрібен Platform Files). History cursor pagination — поза поточним polish.

## Практичне

- [Синхронізація через Git](dev/git-sync.md) — pull/push, новий ПК, `db-snapshot` / `db-restore`, **демо-тунель**, типові проблеми
- [Reset анкет (pre-prod)](dev/questionnaire-test-reset.md) — dry-run / execute + snapshot DoD
- [Position Catalog](dev/position-catalog.md) — skill registry, context envelope ([ADR 0010](adr/0010-position-catalog-and-questionnaire-context.md)); UI `/positions` (керування + налаштування) + `/positions/:id/catalog`

## Розробницьке

- [Архітектура](architecture.md)
- [ADR](adr/) — зафіксовані рішення
- [Деплой (Docker Compose)](dev/deploy.md)
- [Експлуатація (operations)](dev/operations.md)
- [Reset анкет (pre-prod)](dev/questionnaire-test-reset.md)
- [Production readiness checklist](dev/production-readiness.md)
- [Cutover ProjectWeekend → LoomCRM](cutover.md)
- [COPYMAP](COPYMAP.md)
- [Absences API parity](absences-api-parity.md)
- [Absences UI parity](absences-ui-parity.md)

## Продукт / HR

- [HR profile roadmap](product/hr-profile-roadmap.md) — **living** статус фаз
- [People «Про себе»](product/people-about-tab.md) — вкладка + planned subtabs
- [Access surfaces](product/access-surfaces.md) — surfaces + permissions
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
- Демо через ngrok-тунель → [git-sync § тунель](dev/git-sync.md#демо-через-тунель-керівництво--зовнішній-https)
- Що вже зроблено / що далі → [roadmap](product/hr-profile-roadmap.md) + блок «Зараз у коді» вище
- Production / VPS → [deploy](dev/deploy.md) + [operations](dev/operations.md)
- Межі модулів → [architecture](architecture.md) + [AGENTS.md](../AGENTS.md)
- Цільове бачення профілю → [employee-profile-core.md](product/employee-profile-core.md) (після living docs)
