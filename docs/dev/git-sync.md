# Синхронізація проєкту через Git

Проєкт синхронізується між комп’ютерами через GitHub: https://github.com/Fours9/Loom-CRM

## Ключовий принцип роботи з базою (як у ProjectWeekend)

У ProjectWeekend жива БД — файл `data/app.sqlite`. У LoomCRM жива БД — **сервер PostgreSQL** (не файл у репо). Патерн знімка той самий.

| | ProjectWeekend | LoomCRM |
| --- | --- | --- |
| Жива БД | `data/app.sqlite` (файл у проєкті) | Postgres за `DATABASE_URL` / volume `postgres_data` |
| Знімок у git | `data/app.snapshot.sqlite` | `data/app.snapshot.sql` |
| Жива → знімок | `.\scripts\db-snapshot.ps1` | те саме |
| Знімок → жива | `.\scripts\db-restore.ps1` | те саме |

Правила:

- **Жива база** — **НЕ** в git. `git pull` / `reset` / `checkout` її **не** чіпають.
- **Знімок** `data/app.snapshot.sql` — **у git**. Це копія стану, яку зберігаєте вручну, коли стан вартий переносу між ПК.
- **Міграції** (`pnpm migration:run`) змінюють **схему**, не підставляють демо-дані зі знімка.
- Без `db-restore.ps1` після clone/міграцій БД буде **порожньою** (або лише seed-адмін) — залогінитись акаунтами зі знімка буде неможливо.

Пов’язане: [деплой](deploy.md), [operations](operations.md), кореневий [README](../../README.md).

---

## Налаштування нового ПК (перший раз)

1. Встановіть **Node.js 22.x**, **Git**, **Docker** *або* локальний **PostgreSQL 16** (клієнтські `pg_dump`/`psql` у PATH).

2. Увімкніть pnpm через Corepack:

```powershell
corepack enable
corepack prepare pnpm@10.15.0 --activate
```

3. Клонуйте репозиторій:

```powershell
git clone https://github.com/Fours9/Loom-CRM.git
cd Loom-CRM
```

4. Env:

```powershell
copy .env.example .env
```

5. Підніміть Postgres і залежності, застосуйте схему:

```powershell
docker compose up -d postgres
pnpm install
pnpm migration:run
```

6. **Обов’язково** відновіть демо-стан зі знімка (інакше БД без акаунтів зі знімка — як у PW без `db-restore`):

```powershell
.\scripts\db-restore.ps1
```

7. Запуск:

```powershell
.\start.bat
```

- API: http://localhost:3000/api/v1/health/live  
- Web: http://localhost:4200  
- Логін: акаунти зі знімка (часто `hr@tier.ua`); без restore — seed `admin@loom.local` / `Admin123!`

`start.bat` після міграцій **не** викликає restore автоматично (жива БД не затирається). Після clone / порожньої БД зробіть крок 6 явно.

### ProjectWeekend (copy-source)

Папка `ProjectWeekend/` **не** входить у цей git-репозиторій. Read-only copy-source — див. [AGENTS.md](../../AGENTS.md).

---

## Щоденна робота (той самий ПК)

### Зберегти зміни коду

```powershell
git add .
git commit -m "Опис змін"
git push
```

Не комітьте `.env`, секрети, `node_modules/`, `data/app.live.bak-*.sql`, і зазвичай не комітьте локальні `cutover-report-*.json`.

### Зберегти ще й поточний стан бази

```powershell
.\scripts\db-snapshot.ps1        # оновлює data/app.snapshot.sql
git add data/app.snapshot.sql
git commit -m "Update DB snapshot"
git push
```

Знімок можна робити при запущеному API, але надійніше — коли ніхто активно не пише в БД. Потрібні або `docker compose` з сервісом `postgres`, або локальні `pg_dump` / `psql` у PATH.

### Підтягнути чужі/свої зміни з GitHub

```powershell
git pull
pnpm install
pnpm migration:run
```

Жива БД при `git pull` **не** змінюється. Якщо разом зі змінами приїхав новий знімок і ви хочете перейти на нього:

```powershell
# 1. Зупиніть API/web (закрийте start.bat / зупиніть процеси)
.\scripts\db-restore.ps1         # перезапише живу базу знімком (спочатку зробить .bak)
# 2. Запустіть знову: .\start.bat
```

`db-restore.ps1` перед перезаписом зберігає стару живу базу в `data\app.live.bak-<дата>.sql` (gitignore).

### Локальний запуск після pull

```powershell
docker compose up -d postgres   # якщо використовуєте Compose
.\start.bat
```

---

## Повністю скинути локальний код до GitHub

```powershell
git fetch origin
git reset --hard origin/master
git clean -fd
```

Жива Postgres і `data\app.live.bak-*` вціліють (не в git). Щоб підтягнути саме знімок з репо:

```powershell
.\scripts\db-restore.ps1
```

Щоб повністю знищити volume Compose:

```powershell
docker compose down -v
docker compose up -d postgres
pnpm migration:run
.\scripts\db-restore.ps1
```

---

## Типові проблеми

| Симптом | Причина та рішення |
| --- | --- |
| БД «пуста», немає логінів зі знімка | Зробили лише migrate / `start.bat` без явного restore — `.\scripts\db-restore.ps1`, перезапуск |
| Імена/відділи як `????????` | Старий баг restore через PowerShell pipe ламав UTF-8 — оновіть скрипти й знову `.\scripts\db-restore.ps1` (не комітьте зіпсований live bak як знімок) |
| Не можу залогінитись на новому ПК | Порожня/інша БД — `.\scripts\db-restore.ps1`, перезапуск API |
| Шукаю `data/app.sqlite` як у PW | У LoomCRM живої SQLite немає — жива БД у Postgres; знімок: `data/app.snapshot.sql` |
| Дані в базі «відкотилися» | Запустили `db-restore.ps1` поверх свіжішої живої — знайдіть `data\app.live.bak-<дата>.sql` і відновіть через `psql` |
| `pg_dump` / `psql` not found | Додайте PostgreSQL `\bin` у PATH або використовуйте Compose postgres |
| `DATABASE_URL is required` | Скопіюйте `.env.example` → `.env` |
| Порт 5432 зайнятий / `ECONNREFUSED` | Postgres не запущений — `docker compose up -d postgres` або сервіс PostgreSQL 16 |
| Після `git pull` API падає | Нові міграції — `pnpm migration:run` (після restore також перевірте `migration:show`) |
| Випадково змінили `ProjectWeekend/` | Відкотіть; `pnpm check:copy-source` |
