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

| Змінна | Обов’язкова | Приклад | Призначення |
| --- | --- | --- | --- |
| `DATABASE_URL` | **так** | `postgres://loom:loom@127.0.0.1:5432/loom_crm` | підключення TypeORM |
| `JWT_SECRET` | **так** | довгий випадковий рядок | підпис JWT |
| `PORT` | ні (default `3000`) | `3000` | порт HTTP API |
| `NODE_ENV` | ні | `production` | режим Nest |
| `CORS_ORIGIN` | ні (default `http://localhost:4200`) | `https://app.example` або CSV | allowlist origin |
| `SEED_ADMIN_EMAIL` | ні | `admin@loom.local` | email seed-адміна (якщо ще немає) |
| `SEED_ADMIN_PASSWORD` | ні | сильний пароль | пароль seed-адміна |

**Практика для production**

1. Скопіювати `.env.production.example` → `.env.production`, ніколи не комітити секрети.
2. Згенерувати `JWT_SECRET`: `openssl rand -base64 48`.
3. Змінити дефолтний пароль адміна одразу після першого входу.
4. Якщо UI за reverse proxy на іншому origin — виставити `CORS_ORIGIN` (або same-origin через nginx на `:8080` / TLS proxy).

У [`compose.yaml`](../../compose.yaml) частина змінних зараз задана inline у `environment:` — для продакшену замініть placeholder `JWT_SECRET` і узгодьте credentials з Postgres.

---

## 3. Backup, snapshot і restore (PostgreSQL)

### 3.1. Dev-знімок у git (як у ProjectWeekend)

| Файл / скрипт | Роль |
| --- | --- |
| Жива БД (volume / `DATABASE_URL`) | не в git |
| `data/app.snapshot.sql` | знімок у git |
| `.\scripts\db-snapshot.ps1` | жива → знімок |
| `.\scripts\db-restore.ps1` | знімок → жива (+ авто-бекап `data/app.live.bak-*.sql`) |

Деталі щоденної роботи: [git-sync.md](git-sync.md).

```powershell
.\scripts\db-snapshot.ps1
git add data/app.snapshot.sql
git commit -m "Update DB snapshot"
```

### 3.2. Production backup (Compose, поза git)

```bash
mkdir -p backups
docker compose exec -T postgres pg_dump -U loom -d loom_crm --format=custom -f /tmp/loom.dump
docker compose cp postgres:/tmp/loom.dump "./backups/loom-$(date +%Y%m%d-%H%M%S).dump"
```

Альтернатива (SQL на stdout хоста):

```bash
docker compose exec -T postgres pg_dump -U loom -d loom_crm --clean --if-exists > backups/loom.sql
```

Робити backup **перед** `git pull` + `--build` на production. Production dump **не** комітити замість `app.snapshot.sql`, якщо там є реальні персональні дані.

### 3.3. Production restore

Зупиніть writers (`api` / `web`), потім:

```bash
docker compose stop api web
docker compose cp ./backups/loom-YYYYMMDD.dump postgres:/tmp/loom.dump
docker compose exec -T postgres pg_restore -U loom -d loom_crm --clean --if-exists /tmp/loom.dump
docker compose start api web
```

Для plain SQL:

```bash
docker compose stop api web
cat backups/loom.sql | docker compose exec -T postgres psql -U loom -d loom_crm
docker compose start api web
```

Після restore перевірте `health/ready` і логін.

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
| Немає адміна | Seed не створив юзера — перевірте `SEED_ADMIN_*`, або відновіть демо: `.\scripts\db-restore.ps1` |
| Потрібен спільний демо-стан між ПК | Оновіть знімок на джерелі (`db-snapshot.ps1` + commit), на приймачі — `db-restore.ps1` |
| Після оновлення UI «старий» | Браузерний кеш / не перезібраний `web` — `docker compose up -d --build web` |
| Випадкові зміни в `ProjectWeekend/` | Copy-source read-only — відкотити; `pnpm check:copy-source` |

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
# або start.bat на Windows
```
