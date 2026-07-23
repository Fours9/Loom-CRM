# LoomCRM

Модульний моноліт CRM: один логін, спільний PostgreSQL, Angular-клієнт лише через NestJS REST (`/api/v1`).

**Репозиторій:** https://github.com/Fours9/Loom-CRM

## Стек

| Шар | Технологія |
| --- | --- |
| Frontend | Angular (`apps/web`) |
| Backend | NestJS (`apps/api`) |
| БД | PostgreSQL 16 |
| Пакети | pnpm **10.15.0** (Corepack) |
| Node.js | **22.x** (`engines`: `>=22 <23`) |
| API | REST `/api/v1` |

## Шляхи

| Роль | Шлях |
| --- | --- |
| Корінь LoomCRM | `C:\Loom-CRM-Core` (локально) / клон репо |
| Read-only copy-source | `ProjectWeekend/` (gitignore; **не** змінювати в рамках LoomCRM) |

## Вимоги

- Node.js 22.x
- pnpm 10.15.0
- Docker (PostgreSQL) або локальний Postgres 16

```bash
corepack enable
corepack prepare pnpm@10.15.0 --activate
```

## Швидкий старт

```bash
git clone https://github.com/Fours9/Loom-CRM.git
cd Loom-CRM
cp .env.example .env
pnpm install
docker compose up -d postgres
pnpm migration:run
# опційно — демо-стан зі знімка (як у PW):
#   .\scripts\db-restore.ps1
pnpm dev
```

Windows: `start.bat` (migrate + api + web), `test.bat` (lint / typecheck / test / build).

| | URL / облікові дані |
| --- | --- |
| API live | http://localhost:3000/api/v1/health/live |
| Web (dev) | http://localhost:4200 |
| Адмін (seed) | `admin@loom.local` / `Admin123!` |

Корисні скрипти:

| Script | Призначення |
| --- | --- |
| `pnpm dev` | Міграції, потім api + web |
| `pnpm dev:apps` | Старт без міграцій |
| `pnpm migration:run` | Застосувати pending-міграції |
| `pnpm check:copy-source` | Fail, якщо `ProjectWeekend` має локальні зміни |
| `.\scripts\db-snapshot.ps1` | Жива Postgres → `data/app.snapshot.sql` (у git) |
| `.\scripts\db-restore.ps1` | Знімок → жива БД (з авто-бекапом `.bak`) |

## Compose (повний стек)

```bash
docker compose up -d --build
```

- Web (nginx): http://localhost:8080  
- API: http://localhost:3000  
- Порядок: postgres → migrate → api → web  

Секрети для smoke/prod: [`.env.production.example`](.env.production.example). Runbook: [docs/dev/deploy.md](docs/dev/deploy.md).

## Архітектура

Див. [docs/architecture.md](docs/architecture.md) і [docs/adr/](docs/adr/).

Правило залежностей: **стрілка `A → B` означає, що A може імпортувати public API B.**

```text
Organization → Platform
Absences → Platform
Absences → Organization
```

Заборонено: Platform → Absences; Organization → Absences; `apps/web` → вихідний код `apps/api`.

```text
apps/api          NestJS (platform / organization / modules)
apps/web          Angular CRM shell
libs/contracts/*  Shared API TypeScript contracts
libs/frontend/ui  Shared UI primitives
database/         Документація ownership міграцій (код у apps/api)
```

## Документація

Повний індекс: [`docs/README.md`](docs/README.md).

| Документ | Зміст |
| --- | --- |
| [Git sync](docs/dev/git-sync.md) | Новий ПК, pull/push, snapshot/restore БД |
| [Deploy](docs/dev/deploy.md) | Docker Compose single-host |
| [Operations](docs/dev/operations.md) | Env, backup/restore, checklist |
| [Cutover](docs/cutover.md) | Імпорт з ProjectWeekend SQLite |
| [AGENTS.md](AGENTS.md) | Правила для агентів і межі модулів |

## Cutover

Див. [docs/cutover.md](docs/cutover.md).

```bash
pnpm cutover:dry-run
pnpm cutover:import   # --reset: вирівняти Loom зі станом PW SQLite
.\scripts\db-snapshot.ps1
```
