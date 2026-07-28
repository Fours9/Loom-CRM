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

## База даних (як у ProjectWeekend, але PostgreSQL)

| Що | Де | У git? |
| --- | --- | --- |
| **Жива БД** | PostgreSQL за `DATABASE_URL` (Compose volume `postgres_data` або локальний Postgres 16) | **ні** |
| **Знімок** | `data/app.snapshot.sql` | **так** |

- `pnpm migration:run` / `start.bat` створюють **лише схему** (порожні таблиці або seed-адмін).
- Демо-акаунти й дані зі знімка з’являються **тільки** після `.\scripts\db-restore.ps1`.
- `git pull` **не** перезаписує живу БД. Новий знімок з GitHub → знову `db-restore.ps1`.

Детальніше: [docs/dev/git-sync.md](docs/dev/git-sync.md).

## Вимоги

- Node.js 22.x
- pnpm 10.15.0
- Docker (PostgreSQL) **або** локальний Postgres 16 (`psql` / `pg_dump` у PATH)

```bash
corepack enable
corepack prepare pnpm@10.15.0 --activate
```

## Швидкий старт (новий ПК)

Порядок обов’язковий. Без кроку restore логін зі знімка не спрацює.

```powershell
git clone https://github.com/Fours9/Loom-CRM.git
cd Loom-CRM
copy .env.example .env
pnpm install
docker compose up -d postgres
pnpm migration:run
.\scripts\db-restore.ps1
.\start.bat
```

На Windows `start.bat` ставить залежності й ганяє міграції; **не** робить auto-restore зі знімка (щоб не затирати живу БД). Після clone / порожньої БД один раз явно: `.\scripts\db-restore.ps1`.

| | URL / облікові дані |
| --- | --- |
| API live | http://localhost:3000/api/v1/health/live |
| Web (dev) | http://localhost:4200 |
| Після restore (знімок) | див. дані в знімку; часто `hr@tier.ua` |
| Порожня БД без restore (seed) | `admin@loom.local` / `Admin123!` |

Корисні скрипти:

| Script | Призначення |
| --- | --- |
| `pnpm dev` | Міграції, потім api + web (**без** auto-restore) |
| `pnpm dev:apps` | Старт без міграцій |
| `pnpm migration:run` | Застосувати pending-міграції (схема, не дані) |
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

Compose **не** підставляє `data/app.snapshot.sql` автоматично. Для демо-стану після першого підйому: `.\scripts\db-restore.ps1` (коли Postgres уже healthy).

Секрети для smoke/prod: [`.env.production.example`](.env.production.example). Runbook: [docs/dev/deploy.md](docs/dev/deploy.md).

## Архітектура

Див. [docs/architecture.md](docs/architecture.md) і [docs/adr/](docs/adr/).

Правило залежностей: **стрілка `A → B` означає, що A може імпортувати public API B.**

```text
Organization → Platform
Absences → Platform
Absences → Organization
Documents → Platform
Documents → Organization
```

Заборонено: Platform → Absences; Platform → Documents; Organization → Absences; Organization → Documents; `apps/web` → вихідний код `apps/api`.

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
