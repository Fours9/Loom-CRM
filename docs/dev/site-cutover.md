# Site cutover: ProjectWeekend → LoomCRM (той самий VPS)

Операційний runbook для заміни production PW (`hr-app`, `:80`) на LoomCRM (`loom-crm`) з fail-closed bootstrap, acceptance-only localhost UI до `go_live`, і окремим daily deploy.

Пов’язане: [деплой](deploy.md), [операції](operations.md), [локальний PW→Loom порт](pw-to-loom-port.md), [cutover overview](../cutover.md).

---

## 0. Інваріанти

1. Ops tooling у `scripts/**` **не** імпортує `apps/api/src`.
2. Tracked snapshot [`data/app.snapshot.sql`](../../data/app.snapshot.sql) = **повний** `pg_dump --clean` baseline (не data-only).
3. **Два** `sourceMode` з різним порядком bootstrap (див. §3).
4. Destructive restore = завжди `DROP DATABASE` + `CREATE DATABASE` після fail-closed backup. **Заборонено** «empty-enough» і покладатися лише на dump `--clean`.
5. До `go_live` web **не** на публічному `:80` — лише `127.0.0.1:8080` через [`compose.cutover-acceptance.yaml`](../../compose.cutover-acceptance.yaml).
6. Compose project: завжди `-p loom-crm` (wrapper); PW — subshell `-p hr-app`. Ніколи global `export COMPOSE_PROJECT_NAME`.
7. Compose **≥ 2.24.4** (`!reset` / `!override`).
8. Login smoke: `CUTOVER_SMOKE_EMAIL` / `CUTOVER_SMOKE_PASSWORD` — **не** `SEED_ADMIN_*`.
9. Data-safe rollback на PW гарантований **лише до** `go_live`.
10. Daily migrations мають бути **backward-compatible** з running API, або `LOOM_STOP_API_BEFORE_MIGRATE=1`.

---

## 1. Артефакти

| Шлях | Роль |
| --- | --- |
| [`compose.yaml`](../../compose.yaml) | base; parameterized env; profile `cutover` |
| [`compose.production.yaml`](../../compose.production.yaml) | `!reset` postgres/api ports; web `:80`; required secrets |
| [`compose.cutover-acceptance.yaml`](../../compose.cutover-acceptance.yaml) | web `127.0.0.1:8080:80` до go_live |
| [`docker/cutover.Dockerfile`](../../docker/cutover.Dockerfile) | one-shot importer (Node 22 + better-sqlite3/pg/uuid) |
| [`scripts/lib/compose-cli.sh`](../../scripts/lib/compose-cli.sh) | filesets `base` \| `production` \| `acceptance` |
| [`scripts/db-recreate.sh`](../../scripts/db-recreate.sh) | bak → terminate → DROP/CREATE |
| [`scripts/db-restore.sh`](../../scripts/db-restore.sh) | restore **лише** у freshly recreated DB |
| [`scripts/migrate-run.sh`](../../scripts/migrate-run.sh) | `compose run --rm migrate` + exact migration-set verify |
| [`scripts/site-cutover.sh`](../../scripts/site-cutover.sh) | window orchestrator + marker |
| [`scripts/deploy-vps.sh`](../../scripts/deploy-vps.sh) | daily pull/build/migrate/`--no-deps` |
| [`scripts/smoke-site.sh`](../../scripts/smoke-site.sh) | health + SPA + login (`--bind localhost\|public`) |
| [`scripts/preflight-compose.sh`](../../scripts/preflight-compose.sh) | non-destructive asserts |
| `backups/cutover-state.json` | resume marker (**gitignored**, без секретів) |

---

## 2. Підготовка на VPS

```bash
# Loom clone (окремий каталог від /root/ProjectWeekend)
cd /root/Loom-CRM   # або актуальний шлях
git pull --ff-only
cp .env.production.example .env.production
$EDITOR .env.production
```

Обов’язково в `.env.production`:

- сильні `POSTGRES_PASSWORD` / `DATABASE_URL` (узгоджені);
- `JWT_SECRET` (`openssl rand -base64 48`);
- `CORS_ORIGIN` (публічний origin після go_live, напр. `http://your.domain`);
- `CUTOVER_SMOKE_EMAIL` / `CUTOVER_SMOKE_PASSWORD` — **існуючий** користувач у snapshot/після import (не placeholder і не обов’язково seed admin).

Перевірка без деструкції:

```bash
chmod +x scripts/*.sh scripts/lib/*.sh
./scripts/preflight-compose.sh --env-file .env.production
# optional: ./scripts/preflight-compose.sh --build
```

Compose filesets (через wrapper):

```text
acceptance = compose.yaml + compose.production.yaml + compose.cutover-acceptance.yaml
go_live    = compose.yaml + compose.production.yaml
```

---

## 3. Dual `loom_db_bootstrap`

### 3.1. `sourceMode=snapshot` (default)

```text
up postgres
→ bak if non-empty (fail-closed)
→ DROP/CREATE database
→ restore full baseline (data/app.snapshot.sql)
→ migrate HEAD
→ verify exact migration set == typeorm registry
→ loom_start (api --no-deps + acceptance web)
```

### 3.2. `sourceMode=pw-refresh`

```text
up postgres
→ bak if non-empty (fail-closed)
→ DROP/CREATE database
→ migrate HEAD          # schema FIRST — importer needs account_roles etc.
→ cutover image: import --reset (RO sqlite mount)
→ optional post-import pg_dump → backups/
→ loom_start
```

Importer **ніколи** на unmigrated DB. API production image **не** використовується для importer.

---

## 4. Вікно cutover

```bash
# Default: tracked snapshot
./scripts/site-cutover.sh

# Або свіжий PW SQLite на VPS:
./scripts/site-cutover.sh \
  --refresh-from-pw=/root/ProjectWeekend/runtime/data/app.sqlite
```

Фази:

| Phase | Дія |
| --- | --- |
| `preflight` | Compose≥2.24.4; identical migrate/api `DATABASE_URL`; build api/web/cutover; smoke creds |
| `pw_backup` | PW `backup.sh` + copy under `backups/` (зробіть off-box копію) |
| `pw_stop` | `docker compose -p hr-app down` |
| `loom_db_bootstrap` | за `sourceMode` |
| `loom_start` | api `--no-deps` + web acceptance (`127.0.0.1:8080`) |
| `smoke` | localhost semantic |
| `acceptance` | адмін checklist (SSH tunnel); інтерактивно `ACCEPT` |
| `go_live` | web → production `:80`; **другий** public smoke; authority |
| `done` | PW каталог зберігається; без auto-rollback |

Resume / окремі фази:

```bash
./scripts/site-cutover.sh --resume
./scripts/site-cutover.sh --resume --phase go_live
./scripts/site-cutover.sh --force-new-run
```

Drift у marker (`repoCommit` / `snapshotSha256` / `sourceMode`) → resume відхиляється без `--force-new-run`.

### 4.1. Acceptance access

До `go_live` публічний `:80` **не** експонує Loom UI.

```bash
# З ноутбука:
ssh -L 8080:127.0.0.1:8080 root@vps
# браузер → http://127.0.0.1:8080
```

Checklist (мінімум): логін smoke-юзера, People/Absences smoke, health через nginx proxy.

### 4.2. go_live

Технічна межа: recreate web **без** acceptance overlay → `:80` → public smoke → `goLiveAt` у marker.

Після live writes rollback на PW **не** data-safe.

---

## 5. Daily deploy (після cutover)

```bash
./scripts/deploy-vps.sh
# breaking migrations:
LOOM_STOP_API_BEFORE_MIGRATE=1 ./scripts/deploy-vps.sh
```

Контракт: pull → build → **explicit** `migrate-run.sh` → `up -d --no-deps api` → `up -d --no-deps web` → smoke.

**Не** робить restore. **Не** покладається на прихований другий `migrate` через `depends_on`.

Інваріант: daily migrations **MUST** бути backward-compatible з currently running API, інакше stop writers перед migrate.

---

## 6. Rollback

| Момент | Дія |
| --- | --- |
| До `go_live` | `loom` down; підняти PW (`-p hr-app`); дані PW не змінювались після `pw_stop` |
| Після `go_live` | лише forward fix / restore Loom з `backups/*.sql`; PW може бути застарілим |

---

## 7. FAQ

**Чому importer не замість snapshot у тому ж порядку?**  
Importer читає вже мігровану схему (`account_roles`, ResetPolicy tables). На чистій БД спочатку migrate, потім import.

**Чому не api image для cutover?**  
`better-sqlite3` — root/dev dependency; production api image його не містить. One-shot `docker/cutover.Dockerfile`.

**Чому DROP DATABASE, а не лише `pg_dump --clean`?**  
`--clean` прибирає лише об’єкти з dump. Новіші таблиці/індекси target можуть вижити → гібрид schema.

**Чому `--no-deps` після migrate?**  
Інакше `up api` знову тригерить service `migrate` через `depends_on`.

---

## 8. DoD (операційний)

Перевірте пункти плану **13–40**. Стислий чеклист у репо: [site-cutover-dod.md](site-cutover-dod.md).

Зокрема:

- snapshot: recreate → restore → migrate;
- pw-refresh: recreate → migrate → importer;
- acceptance лише localhost; go_live змінює exposure + другий smoke;
- migrate/api `DATABASE_URL` identical;
- `backups/` gitignored; marker без секретів;
- daily BC migration invariant задокументований.
