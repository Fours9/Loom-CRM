# Порт ProjectWeekend → LoomCRM (локальний / повторюваний)

Інструкція для переносу **живої** SQLite бази ProjectWeekend у **локальний** PostgreSQL LoomCRM.

Інструмент: `scripts/cutover/` (ops tooling, **не** Nest-модуль). ProjectWeekend лишається **read-only**.

Пов’язане: [cutover.md](../cutover.md), [site-cutover.md](site-cutover.md) (VPS), [git-sync.md](git-sync.md), [operations.md](operations.md), [architecture.md](../architecture.md).

Для production replace на тому самому VPS використовуйте **[site-cutover.md](site-cutover.md)** (`sourceMode=pw-refresh` + cutover image), не лише локальний `node scripts/cutover/...`.

---

## 1. Мета і коли використовувати

- Підтягнули `ProjectWeekend/data/app.sqlite` з VPS / іншого середовища і хочете той самий org/absences стан у локальному Loom.
- Повторюваний порт після змін у PW (не live dual-write).

**Не** для: синхронного продакшен-різання без вікна; порту questionnaire/documents з PW (у PW їх немає).

---

## 2. Передумови

| Вимога | Примітка |
| --- | --- |
| Node **22.x**, pnpm 10.15.0 | як у LoomCRM |
| Міграції Loom застосовані | `pnpm migration:run` |
| Postgres доступний | `DATABASE_URL` або default `postgres://loom:loom@127.0.0.1:5432/loom_crm` |
| `better-sqlite3` | root: `pnpm add -wD better-sqlite3` якщо немає |
| `pg` + `uuid` | з `apps/api` (скрипт резолвить через `requireApi`) |
| Свіжий SQLite | `ProjectWeekend/data/app.sqlite` |
| Writers | бажано зупинити Loom API на час `--reset` |

---

## 3. Архітектура порту (коротко)

- **Модулі:** `SqliteSource`, `PostgresTarget`, `IdMap` (uuid v5), чисті `mappers/*`, `importers`, `ResetPolicy`, `PortOrchestrator`.
- **ResetPolicy:** явний `TRUNCATE` runtime/domain таблиць, **без CASCADE**; catalogs (`account_roles`, templates, skills, directions, …) **KEEP**. Нова залежна таблиця, забута в policy → Postgres **fail-closed**.
- **AuthZ:** `account_role_id` = SoT; `users.role` = mirror через `userRoleMirrorFor`. Невідомий PW role → **exit 1**.
- **Manager scope:** SoT = `employment_assignments` + `management_kind` + `employment_assignment_managed_departments` (не legacy `employee_managed_departments` alone).
- **Детермінізм:** uuid v5 з фіксованого namespace; source-backed і synthetic (`employment-assignment:…:active:v1`, `contact:…`) — усі PK **explicit INSERT**.

---

## 4. Що портується / що ні

| Портується | Не портується |
| --- | --- |
| departments, positions, users, employees | PW `audit_logs` |
| employment_assignments (+ managed depts) | questionnaire/documents **дані** (у PW немає) |
| employee_contacts (canonical work_*/personal_*) | binary `request_attachments` (fail якщо >0) |
| work_schedule_days | напрямки/компанії з PW (немає семантики → `direction_id` null) |
| absence_requests + history | |
| notifications (preserve payload + remap request ids) | |
| privacy_settings → `application_settings` | |

---

## 5. Крок 1 — dry-run

Dry-run читає **SQLite і Postgres** (PG лише SELECT / `BEGIN READ ONLY`), **нічого не пише**.

Якщо в target уже є рядки в truncate-domain — потрібен прапорець `--reset` і в dry-run (сигнал «плануємо wipe»):

```powershell
cd C:\Loom-CRM-Core
node scripts/cutover/import-from-projectweekend.mjs --dry-run --reset --sqlite ProjectWeekend/data/app.sqlite
```

Перегляньте `cutover-report-*.json`: counts, errors, skipped. Exit `0` = можна йти далі.

---

## 6. Крок 2 — backup перед `--reset` (обов’язково для цінної БД)

Transaction rollback захищає лише **до COMMIT**. Помилка на smoke після COMMIT не відкочується.

```powershell
.\scripts\db-snapshot.ps1
# або скопіюйте live bak вручну
```

Для disposable local demo можна пропустити лише свідомо; у runbook для будь-якої цінної БД — **mandatory**.

---

## 7. Крок 3 — apply `--reset`

```powershell
$env:DATABASE_URL = 'postgres://loom:loom@127.0.0.1:5432/loom_crm'
node scripts/cutover/import-from-projectweekend.mjs --reset --sqlite ProjectWeekend/data/app.sqlite
```

Без `--reset` імпорт **завжди** fail, якщо будь-яка truncate-таблиця непорожня.

---

## 8. Крок 4 — reconciliation

1. Counts ≈ PW: users, employees, departments, positions, schedules, requests, history.
2. `users.account_role_id` join `account_roles`; `users.role` == mirror preset.
3. Employees з dept/pos/manager мають `current_assignment_id`; manager → `management_kind='departments'` + EA managed depts.
4. Login з PW password hash; People list; absence detail (times/comment); calendar/schedule.
5. Повторний `--reset` на тій самій SQLite → **той самий** `mapping` у report (детермінізм).

---

## 9. Крок 5 — оновити tracked snapshot

```powershell
.\scripts\db-snapshot.ps1
git add data/app.snapshot.sql   # коміт лише за окремим запитом
```

---

## 10. Rollback

```powershell
.\scripts\db-restore.ps1
```

PW `app.sqlite` лишається authoritative до прийняття Loom стану.

---

## 11. FAQ

| Симптом | Дія |
| --- | --- |
| Unknown PW role | Виправити роль у PW або додати `account_roles.code`; **немає** fallback на employee |
| TRUNCATE fail (FK) | Нова таблиця з FK — додати в `ResetPolicy.TRUNCATE` |
| Without --reset … has rows | Додайте `--reset` або очистіть target |
| Manager without EA | Preflight fail — потрібні managed depts або org placement |
| request_attachments > 0 | v1 не портує файли — fail-closed |
| better-sqlite3 missing | `pnpm add -wD better-sqlite3` |

---

## Exit codes

| Code | Meaning |
| --- | --- |
| 0 | success |
| 1 | validation / import failure |
| 2 | missing sqlite / dependency / env |
