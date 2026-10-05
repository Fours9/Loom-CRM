# Деплой (Docker Compose, single-host)

Головний runbook для запуску LoomCRM на одному хості з Docker: **nginx (Angular static) → `/api/` → NestJS → PostgreSQL** (named volume).

Пов’язане: [операції](operations.md), [site cutover](site-cutover.md), [git-sync](git-sync.md), [архітектура](../architecture.md).

Файли Compose:

| Файл | Роль |
| --- | --- |
| [`compose.yaml`](../../compose.yaml) | base (dev/smoke ports 5432/3000/8080) |
| [`compose.production.yaml`](../../compose.production.yaml) | prod: без публічних 5432/3000; web `:80`; `${VAR:?}` |
| [`compose.cutover-acceptance.yaml`](../../compose.cutover-acceptance.yaml) | до go_live: web лише `127.0.0.1:8080` |

Образи: [`docker/api.Dockerfile`](../../docker/api.Dockerfile), [`docker/web.Dockerfile`](../../docker/web.Dockerfile), [`docker/cutover.Dockerfile`](../../docker/cutover.Dockerfile).

Wrappers: `scripts/lib/compose-cli.sh` (`-p loom-crm`, filesets `base|production|acceptance`).

---

## 0. Модель розгортання

### Dev / smoke (base)

```text
Browser → web (:8080, nginx)
            ├─ /        → Angular dist
            └─ /api/    → api (:3000)
                            └─▶ Postgres (:5432 published)
```

### Production (після go_live)

```text
Browser → web (:80, nginx) → api (internal) → Postgres (internal)
```

### Acceptance (до go_live)

```text
Admin (SSH tunnel) → 127.0.0.1:8080 → web → api → Postgres
Public :80 → not Loom
```

Послідовність bootstrap (cutover) — див. [site-cutover.md](site-cutover.md). Daily:

```text
explicit migrate-run.sh → up -d --no-deps api → up -d --no-deps web
```

Інваріанти:

- Схему змінюють **лише** міграції. TypeORM `synchronize` **ніколи** не вмикати.
- Після explicit migrate **не** робити звичайний `up api` (подвійний `depends_on` migrate) — лише `--no-deps`.
- migrate і api мають **identical** resolved `DATABASE_URL`.
- Daily migrations **backward-compatible** з running API, або `LOOM_STOP_API_BEFORE_MIGRATE=1`.
- Секрети не в git. Login smoke: `CUTOVER_SMOKE_*`, не `SEED_ADMIN_*`.
- Жива БД — volume `postgres_data`; `git pull` її не чіпає.

---

## 1. Шлях впровадження

1. **Локальний dev** — Postgres у Compose або локальний, `start.bat` / `pnpm dev`.
2. **Compose smoke** — `compose.yaml` на `:8080`.
3. **VPS site cutover** — [site-cutover.md](site-cutover.md).
4. **Daily updates** — `./scripts/deploy-vps.sh`.

---

## 2. Передумови на хості

- Linux x64, Docker Engine + Compose **≥ 2.24.4**.
- Для production: порт **80** вільний після stop PW.
- Секрети в `.env.production` (з [`.env.production.example`](../../.env.production.example)).

```bash
git clone https://github.com/Fours9/Loom-CRM.git
cd Loom-CRM
cp .env.production.example .env.production
# JWT_SECRET, POSTGRES_PASSWORD, DATABASE_URL, CORS_ORIGIN, CUTOVER_SMOKE_*
chmod +x scripts/*.sh scripts/lib/*.sh
./scripts/preflight-compose.sh --env-file .env.production
```

---

## 3. Перший запуск (smoke, не site cutover)

```bash
docker compose -p loom-crm up -d --build
docker compose -p loom-crm ps
curl -fsS http://127.0.0.1:8080/api/v1/health/ready
```

Для production-like без cutover window:

```bash
docker compose -p loom-crm --env-file .env.production \
  -f compose.yaml -f compose.production.yaml up -d --build
```

Після порожньої БД дані з’являються лише після restore/cutover bootstrap — `migrate` не підвантажує snapshot.

### Seed-адмін

`SeedService` створює адміна лише якщо email ще немає. Після restore PW snapshot seed зазвичай **noop** — для automated smoke використовуйте `CUTOVER_SMOKE_*`.

---

## 4. Оновлення (daily)

```bash
./scripts/deploy-vps.sh
# або для breaking migrations:
LOOM_STOP_API_BEFORE_MIGRATE=1 ./scripts/deploy-vps.sh
```

Контракт: `git pull` → build → `migrate-run.sh` → `up -d --no-deps api` → web → smoke. **Без** restore.

---

## 5. Rollback (коротко)

1. Backup/restore Postgres ([operations](operations.md); site cutover — [site-cutover.md](site-cutover.md) §6).
2. Попередній коміт + `deploy-vps.sh` / compose up.
3. Не змішуйте покоління схеми без `migration:show` / exact-set verify.

---

## 6. Що цей runbook свідомо не покриває

- Multi-instance API без окремого migrate-job.
- TLS termination перед `:80` (додайте reverse proxy за потреби).
- Повне вікно заміни PW — це [site-cutover.md](site-cutover.md).

**Демо через тунель (локальна машина):** [git-sync.md](git-sync.md) (`start-tunnel.bat` / ngrok). Не production.
