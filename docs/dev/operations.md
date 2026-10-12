# Експлуатація (operations)

Операційний посібник: вимоги, змінні середовища, backup/restore, логи, типові помилки старту, checklist після деплою.

Пов’язані документи: [деплой](deploy.md), [git-sync](git-sync.md), [архітектура](../architecture.md).

---

## 1. Мінімальні вимоги до сервера

Цільовий масштаб: **~10–20 одночасних користувачів**, один процес API + статика web + один PostgreSQL.

| Ресурс | Мінімум (локалка / малий VPS) | Рекомендовано |
| --- | --- | --- |
| CPU | 1 vCPU | 2 vCPU |
| RAM | 2 GB | 4 GB |
| Диск | 10 GB вільно | 40+ GB (Postgres + backup) |
| ОС | Linux x64 з Docker, або Windows + Docker Desktop (dev) | Linux LTS |
| Node.js (dev без образів) | **22.x** | 22 LTS |
| pnpm | **10.15.0** (`packageManager` + Corepack) | як у `package.json` |

**Обмеження поточної поставки**

- Один Postgres; міграції — окремий one-shot (`migrate` у Compose) або `pnpm migration:run` у dev.
- Не вмикати TypeORM `synchronize`.
- Frontend у Compose віддає nginx; у dev — `ng serve` на `:4200`.

**Що займає місце**

| Шлях / ресурс | Зміст |
| --- | --- |
| Docker volume `postgres_data` | жива БД |
| образи `api` / `web` / `postgres` | збірки |
| каталог backup на хості | `pg_dump` файли |

---

## 2. Змінні середовища

Шаблони: [`.env.example`](../../.env.example) (dev), [`.env.production.example`](../../.env.production.example) (prod).

Валідація при старті API: `getApplicationConfig()` — обов’язкові `DATABASE_URL` і `JWT_SECRET`.

**Dev env SoT (єдина точка):** файл **кореня репо** `.env`. API при старті вантажить спочатку root `.env`, потім `apps/api/.env` (dotenv / ConfigModule не перезаписують уже задані ключі — root виграє). Не тримайте різні `JWT_SECRET` у root і `apps/api/.env` — інакше логін «ніби ок», а частина запитів 401 після рестарту. Краще синхронізувати або прибрати дубль з `apps/api/.env`.

| Змінна | Обов’язкова | Приклад | Призначення |
| --- | --- | --- | --- |
| `DATABASE_URL` | **так** | `postgres://loom:loom@127.0.0.1:5432/loom_crm` | підключення TypeORM |
| `JWT_SECRET` | **так** | довгий випадковий рядок | підпис JWT |
| `PORT` | ні (default `3000`) | `3000` | порт HTTP API |
| `NODE_ENV` | ні | `production` | режим Nest |
| `CORS_ORIGIN` | ні (default `http://localhost:4200`) | `https://app.example` або CSV | allowlist origin |
| `SEED_ADMIN_EMAIL` | ні | `admin@loom.local` | email seed-адміна (якщо ще немає) |
| `SEED_ADMIN_PASSWORD` | ні | сильний пароль | пароль seed-адміна |
| `CUTOVER_SMOKE_EMAIL` | для site smoke | існуючий user | automated login smoke (не SEED_ADMIN) |
| `CUTOVER_SMOKE_PASSWORD` | для site smoke | — | automated login smoke |

**Практика для production**

1. Скопіювати `.env.production.example` → `.env.production`, ніколи не комітити секрети.
2. Згенерувати `JWT_SECRET`: `openssl rand -base64 48`.
3. Заповнити `CUTOVER_SMOKE_*` користувачем зі snapshot/import.
4. Site cutover / daily deploy: [site-cutover.md](site-cutover.md), [deploy.md](deploy.md).
5. Compose wrappers завжди `-p loom-crm` + `--env-file .env.production`.

**Перший вхід і скидання пароля**

- Новий акаунт з тимчасовим паролем: після логіну UI відкриває `/change-password` (`mustChangePassword` з `/auth/login` / `/auth/me`). Успіх повертає новий JWT у тій самій відповіді.
- Адмінське скидання: People → Адміністрування → **Акаунт** (`POST /auth/reset-password/:userId`); інвалідовує сесію через `tokenVersion`. Наступний запит API дає 401; interceptor робить logout і веде на `/login`. Скидання собі дозволене; деактивація / видалення власного логіну / hard-delete власної анкети — заборонені.
- Hard-delete анкети (`DELETE /api/v1/employees/:id`) — незворотне видалення **operational aggregate** (не GDPR wipe усіх згадок про людину). Audit `employee.deleted` з `employeeNumber` навмисний. Surviving actor UUID → UI **«Видалений користувач»**.

У [`compose.yaml`](../../compose.yaml) змінні параметризовані (`${VAR:-dev}`). Production overlay вимагає `${VAR:?}`.

---

## 3. Backup, snapshot і restore (PostgreSQL)

### 3.1. Dev-знімок у git (як у ProjectWeekend)

| Файл / скрипт | Роль |
| --- | --- |
| Жива БД (volume / `DATABASE_URL`) | не в git; **не** файл `data/app.sqlite` (це лише PW) |
| `data/app.snapshot.sql` | знімок у git |
| `pnpm migration:run` | лише схема — **не** завантажує знімок |
| `.\scripts\db-snapshot.ps1` / `scripts/db-snapshot.sh` | жива → знімок (full `pg_dump --clean`) |
| `.\scripts\db-restore.ps1` | знімок → жива (+ авто-бекап `data/app.live.bak-*.sql`; Windows) |
| `scripts/db-recreate.sh` + `db-restore.sh` | VPS/site: **обов’язковий** DROP/CREATE, потім restore (empty-enough заборонено) |

Після clone / порожньої БД (dev): **спочатку** migrate, **потім** явно `db-restore.ps1`. Інакше логін зі знімка неможливий. `start.bat` **не** робить restore сам.

Site cutover на VPS: recreate → restore → migrate (або pw-refresh: recreate → migrate → importer) — [site-cutover.md](site-cutover.md).

Деталі щоденної роботи: [git-sync.md](git-sync.md).

```powershell
.\scripts\db-snapshot.ps1
git add data/app.snapshot.sql
git commit -m "Update DB snapshot"
```

### 3.2. Production backup (Compose, поза git)

Каталог `backups/` **gitignored** (cutover-state + host dumps).

```bash
mkdir -p backups
# Prefer wrappers (-p loom-crm):
#   source scripts/lib/compose-cli.sh
#   loom_compose production exec -T postgres pg_dump ...
docker compose -p loom-crm --env-file .env.production \
  -f compose.yaml -f compose.production.yaml \
  exec -T postgres pg_dump -U loom -d loom_crm --clean --if-exists --no-owner --no-acl -f /tmp/loom.dump.sql
docker compose -p loom-crm --env-file .env.production \
  -f compose.yaml -f compose.production.yaml \
  cp postgres:/tmp/loom.dump.sql "./backups/loom-$(date +%Y%m%d-%H%M%S).sql"
```

Робити backup **перед** destructive recreate / `git pull` + migrate на production. Production dump **не** комітити замість `app.snapshot.sql`.

### 3.3. Production restore (fail-closed recreate)

Canonical path for full baseline:

```bash
./scripts/db-recreate.sh --fileset production   # bak if non-empty → DROP/CREATE
./scripts/db-restore.sh --fileset production --snapshot ./backups/loom-….sql
./scripts/migrate-run.sh --fileset production
# then up -d --no-deps api/web (see deploy-vps.sh / site-cutover.sh)
```

**Заборонено** restore у «майже порожню» БД без recreate — dump `--clean` не гарантує відсутність новіших об’єктів.

---

## 4. Логи та діагностика

```bash
docker compose ps
docker compose logs -f migrate
docker compose logs -f api
docker compose logs -f web
docker compose logs -f postgres
```

Корисні health:

| URL | Очікування |
| --- | --- |
| `/api/v1/health/live` | процес живий |
| `/api/v1/health/ready` | БД + готовність приймати трафік |

У dev: `pnpm migration:show` — які міграції застосовані.

---

## 5. Типові помилки старту

| Симптом | Причина та рішення |
| --- | --- |
| `Missing required environment variable: DATABASE_URL` / `JWT_SECRET` | Не передані в процес API — перевірте `.env` / Compose `environment` |
| `migrate` exit ≠ 0 | Postgres ще не готовий або помилка SQL — `logs migrate`, `pg_isready` |
| `api` unhealthy | migrate не пройшов або ready-check fail — логи api, `DATABASE_URL` до сервісу `postgres` |
| 502 на `/api/` через `:8080` | api ще не healthy або ім’я сервісу — `depends_on` + healthcheck |
| Немає адміна / «пуста» БД після clone | Зробили лише migrate — `.\scripts\db-restore.ps1` (або `start.bat` при порожніх `users`) |
| Немає адміна на порожній БД без знімка | Seed — перевірте `SEED_ADMIN_*`; демо-стан: `.\scripts\db-restore.ps1` |
| Потрібен спільний демо-стан між ПК | Оновіть знімок на джерелі (`db-snapshot.ps1` + commit), на приймачі — `db-restore.ps1` |
| `Neither Compose postgres nor local pg_dump` | Немає Docker **і** клієнтських tools. На Windows часто Postgres уже стоїть, але `\bin` не в PATH — скрипти самі шукають `Program Files\PostgreSQL\<ver>\bin` через `scripts/lib/postgres-cli.ps1`. |
| Після оновлення UI «старий» | Браузерний кеш / не перезібраний `web` — `docker compose up -d --build web` |
| Випадкові зміни в `ProjectWeekend/` | Copy-source read-only — відкотити; `pnpm check:copy-source` |
| UI клікається, даних немає («бек ніби вимкнений») | Часто **жива вкладка SPA** або процес ще на `:4200`, а API на `:3000` мертвий — не витік БД. Див. § [SPA vs сервер](#spa-shell-vs-вимкнений-сервер) |
| «Некоректні параметри» на `/people` з фільтром відділ/посада | Раніше DTO вимагав UUID **v4**, а org ids з cutover часто **v5**. List query: `@IsUUID('all')` для `departmentIds` / `positionIds` / `directionIds`. |
| Сортування списку працівників б’є в API / 400 | FE SoT: in-memory `sortEmployeeDirectoryItems` (People + Absences) — без refetch при кліку по колонці. Server `sortBy` лишається на filter/reload. |
| Vite `http proxy error` / `ECONNREFUSED 127.0.0.1:3000` одразу після старту | Використовуйте `pnpm dev` / `pnpm dev:apps` / `start.bat` — web стартує лише після `GET /api/v1/health/live` (`scripts/dev-apps.mjs`). Не запускайте `pnpm -r --parallel dev` для apps (є лише `dev:apps:parallel` для свідомого race). `◇ injected env (0)` від dotenv v17 = ключі вже в `process.env`. |

---

## SPA shell vs вимкнений сервер

Angular після завантаження роутить у браузері **без** бекенду; порожні списки ≠ «сервер віддає дані офлайн».

**Перевірка портів (PowerShell):**

```powershell
Get-NetTCPConnection -LocalPort 4200,3000 -State Listen -ErrorAction SilentlyContinue |
  Select-Object LocalPort, OwningProcess
```

Або: `netstat -ano | findstr ":4200 :3000"`.

| Спостереження | Висновок |
| --- | --- |
| Hard refresh `http://localhost:4200` → Connection refused | Web-процес реально зупинений |
| `:4200` Listen, `:3000` ні | SPA може клікатись; API down → UI lock «Сервер недоступний» |
| Вкладка вже відкрита, процеси вбиті | In-memory SPA до refresh; це не live server |

Жива вкладка ≠ сервер увімкнений.

---

## 6. Checklist після деплою

- [ ] `curl` `health/live` і `health/ready` (напряму на api і через `:8080/api/`)
- [ ] Відкривається UI на `:8080`
- [ ] Логін адміном працює; пароль змінено з дефолту (prod)
- [ ] `JWT_SECRET` не з репозиторійного placeholder
- [ ] Зроблено й збережено свіжий `pg_dump` після стабілізації
- [ ] `docker compose ps` — postgres/api/web у очікуваному стані; `migrate` Exited (0)

---

## 7. Локальна розробка (коротко)

Див. кореневий [README](../../README.md) і [git-sync](git-sync.md).

```bash
docker compose up -d postgres
cp .env.example .env
pnpm install
pnpm migration:run
pnpm dev
# pnpm dev / start.bat → scripts/dev-apps.mjs (API health, потім web)
# лише apps: pnpm dev:apps
```
