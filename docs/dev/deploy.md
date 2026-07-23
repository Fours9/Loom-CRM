# Деплой (Docker Compose, single-host)

Головний runbook для запуску LoomCRM на одному хості з Docker: **nginx (Angular static) → `/api/` → NestJS → PostgreSQL** (named volume).

Пов’язане: [операції](operations.md), [git-sync](git-sync.md), [архітектура](../architecture.md).

Файл Compose у корені репозиторію: [`compose.yaml`](../../compose.yaml). Образи: [`docker/api.Dockerfile`](../../docker/api.Dockerfile), [`docker/web.Dockerfile`](../../docker/web.Dockerfile).

---

## 0. Модель розгортання

```text
Browser → web (:8080, nginx)
            ├─ /        → Angular dist (static)
            └─ /api/    → api (:3000, NestJS)
                            └─▶ Postgres (volume postgres_data)
```

Послідовність сервісів:

```text
postgres (healthy) → migrate (one-shot, migration:run) → api (ready) → web
```

Інваріанти:

- Схему змінюють **лише** міграції. TypeORM `synchronize` **ніколи** не вмикати.
- Сервіс `migrate` завершується успішно **до** старту `api` (`service_completed_successfully`).
- API сам **не** повинен бути єдиним місцем застосування міграцій у production — для Compose це окремий job.
- Секрети й `.env*` з реальними паролями **не** в git (лише `*.example`).
- Жива БД — у volume `postgres_data`; `git pull` її не чіпає.

---

## 1. Шлях впровадження

1. **Локальний dev** — Postgres у Compose або локальний, `start.bat` / `pnpm dev` (див. [README](../../README.md), [git-sync](git-sync.md)).
2. **Compose smoke** — повний стек з [`compose.yaml`](../../compose.yaml) на одній машині (цей runbook, §3).
3. **VPS / single-host production** — той самий Compose + сильні секрети + backup (див. [operations](operations.md)).

---

## 2. Передумови на хості

- Linux x64 (або Docker Desktop на Windows/macOS для smoke).
- Docker Engine + `docker compose` v2.
- Порти **8080** (web) і за потреби **3000** (api, якщо публікується) вільні; Postgres у Compose також публікує **5432** (для smoke; у жорсткішому проді можна прибрати publish).

```bash
git clone https://github.com/Fours9/Loom-CRM.git
cd Loom-CRM
cp .env.production.example .env.production
# відредагувати секрети (JWT_SECRET, паролі БД тощо)
```

Шаблон: [`.env.production.example`](../../.env.production.example).

У поточному [`compose.yaml`](../../compose.yaml) змінні для `api`/`migrate` задані inline. Для production **обов’язково** замініть `JWT_SECRET` (і паролі Postgres, якщо змінюєте) на значення з `.env.production` — через правку `environment:` у Compose або підстановку `${JWT_SECRET}` після експорту змінних:

```bash
set -a && source .env.production && set +a   # bash
docker compose up -d --build
```

На Windows PowerShell:

```powershell
Get-Content .env.production | ForEach-Object {
  if ($_ -match '^\s*#' -or $_ -notmatch '=') { return }
  $k,$v = $_.Split('=',2); Set-Item -Path "Env:$k" -Value $v.Trim()
}
# потім оновіть compose.yaml environment або передайте -e
docker compose up -d --build
```

Мінімум для безпечного smoke поза localhost: унікальний `JWT_SECRET` (≥32 символи), не placeholder з репозиторію.

---

## 3. Перший запуск

### 3.1. Bootstrap-послідовність

```text
postgres healthy (pg_isready)
→ migrate: pnpm --filter @loom/api migration:run
→ api: Nest bootstrap + SeedService (admin, якщо ще немає)
→ health/ready
→ web: nginx + static + proxy /api/
```

### 3.2. Команди

```bash
docker compose up -d --build
docker compose ps
docker compose logs -f migrate api
```

Дочекайтесь успішного завершення `migrate` і healthy `api`.

### 3.3. Seed-адмін

При першому старті API з порожньою БД `SeedService` створює адміна (якщо email ще немає):

| | Default |
| --- | --- |
| Email | `admin@loom.local` (або `SEED_ADMIN_EMAIL`) |
| Password | `Admin123!` (або `SEED_ADMIN_PASSWORD`) |

У production одразу змініть пароль і не залишайте дефолти в публічному доступі. Змінні seed можна передати в `environment` сервісу `api`.

### 3.4. Перевірка

```bash
curl -fsS http://<host>:3000/api/v1/health/live
curl -fsS http://<host>:3000/api/v1/health/ready
curl -fsS http://<host>:8080/          # Angular
curl -fsS http://<host>:8080/api/v1/health/live   # через nginx proxy
```

UI: http://\<host\>:8080

---

## 4. Оновлення

```bash
cd Loom-CRM
git pull --ff-only
docker compose up -d --build
```

Compose знову прожене `migrate` перед `api`. Перед оновленням зробіть backup БД ([operations](operations.md)).

Перевірка після оновлення — ті самі `health/live` і `health/ready`, плюс логін у UI.

---

## 5. Rollback (коротко)

1. Відновіть попередній backup Postgres (якщо міграції вже застосовані й несумісні зі старим кодом — restore обов’язковий).
2. Зачекайте / зберіть попередній коміт або тег:

```bash
git checkout <previous-sha>
docker compose up -d --build
```

3. Не запускайте два різні покоління схеми без розуміння міграцій (`pnpm migration:show` у dev).

---

## 6. Що цей runbook свідомо не покриває

- Cloudflare / ngrok tunnel-скрипти (у LoomCRM їх немає — лише Compose і локальний `start.bat`).
- Multi-instance API на спільну БД без окремого migrate-job у CI/CD.
- Окремий TLS termination — додайте reverse proxy (Caddy/nginx/Traefik) перед `:8080` за потреби.
