# Синхронізація проєкту через Git

Проєкт синхронізується між комп’ютерами через GitHub: https://github.com/Fours9/Loom-CRM

Ключовий принцип роботи з базою даних (як у ProjectWeekend):

- **Жива база** PostgreSQL — **НЕ** в git. Це Docker volume `postgres_data` або локальний інстанс за `DATABASE_URL`. Жодні `git pull` / `reset` її самі не чіпають.
- **Знімок бази** `data/app.snapshot.sql` — **відстежується git**. Це копія стану БД, яку ви зберігаєте вручну, коли стан вартий збереження.
- Перенесення стану між ПК — лише через знімок: `db-snapshot.ps1` (жива → знімок) і `db-restore.ps1` (знімок → жива).
- **Схема** додатково еволюціонує міграціями TypeORM (`pnpm migration:run`) після pull, якщо з’явились нові файли міграцій.

Пов’язане: [деплой](deploy.md), [operations](operations.md), кореневий [README](../../README.md).

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

5. Підніміть Postgres і залежності:

```powershell
docker compose up -d postgres
pnpm install
pnpm migration:run
```

6. Відновіть демо-стан зі знімка (інакше лише seed-адмін / порожні дані):

```powershell
.\scripts\db-restore.ps1
```

7. Запуск:

```powershell
.\start.bat
```

- API: http://localhost:3000/api/v1/health/live  
- Web: http://localhost:4200  
- Адмін (після seed або зі знімка): зазвичай `admin@loom.local` / `Admin123!`

### ProjectWeekend (copy-source)

Папка `ProjectWeekend/` **не** входить у цей git-репозиторій. Read-only copy-source — див. [AGENTS.md](../../AGENTS.md).

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
| Не можу залогінитись на новому ПК | Порожня/інша БД — `.\scripts\db-restore.ps1`, перезапуск API |
| Дані в базі «відкотилися» | Запустили `db-restore.ps1` поверх свіжішої живої — знайдіть `data\app.live.bak-<дата>.sql` і відновіть через `psql` |
| `pg_dump` / `psql` not found | Додайте PostgreSQL `\bin` у PATH або використовуйте Compose postgres |
| `DATABASE_URL is required` | Скопіюйте `.env.example` → `.env` |
| Порт 5432 зайнятий | Інший Postgres — змініть mapping / `DATABASE_URL` |
| Після `git pull` API падає | Нові міграції — `pnpm migration:run` (після restore також перевірте `migration:show`) |
| Випадково змінили `ProjectWeekend/` | Відкотіть; `pnpm check:copy-source` |
