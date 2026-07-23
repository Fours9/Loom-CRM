# Документація LoomCRM

Модульний моноліт CRM: один логін, один PostgreSQL, Angular-клієнт лише через NestJS REST (`/api/v1`).

Документація розділена за аудиторіями:

| Розділ | Для кого |
| --- | --- |
| [Практичне](#практичне) | клон, щоденна робота з git, новий ПК |
| [Розробницьке](#розробницьке) | архітектура, ADR, деплой, експлуатація, cutover, parity |
| [Агенти](#агенти) | правила для AI / розробників у репозиторії |

Швидкий старт і стек — у кореневому [README.md](../README.md).

## Практичне

- [Синхронізація через Git](dev/git-sync.md) — pull/push, новий ПК, `db-snapshot` / `db-restore`, типові проблеми

## Розробницьке

- [Архітектура](architecture.md)
- [ADR](adr/) — зафіксовані рішення
- [Деплой (Docker Compose)](dev/deploy.md)
- [Експлуатація (operations)](dev/operations.md)
- [Cutover ProjectWeekend → LoomCRM](cutover.md)
- [COPYMAP](COPYMAP.md)
- [Absences API parity](absences-api-parity.md)
- [Absences UI parity](absences-ui-parity.md)

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
- Production / VPS → [deploy](dev/deploy.md) + [operations](dev/operations.md)
- Межі модулів → [architecture](architecture.md) + [AGENTS.md](../AGENTS.md)
