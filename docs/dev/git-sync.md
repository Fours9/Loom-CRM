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

Інструкція у стилі ProjectWeekend (`docs/dev/git-sync.md` у PW), але з **версіями LoomCRM**.

### Відмінність від ProjectWeekend

| | ProjectWeekend | LoomCRM |
| --- | --- | --- |
| Node.js | **20+** | **лише 22.x** (`engines`: `>=22 <23`) |
| Пакети | `npm` | **pnpm 10.15.0** (Corepack / user install) |
| БД | SQLite `data/app.sqlite` | PostgreSQL + знімок `data/app.snapshot.sql` |
| Локальний старт | `start-dev.bat` | `start.bat` |
| Демо-тунель | `start-tunnel.bat` (ngrok) | `start-tunnel.bat` (той самий reserved domain) |

Якщо на ПК уже стоїть Node 24/LTS з winget — `node --version` покаже `v24…`, а `start-tunnel.bat` / `engines` **впадуть**. Потрібен саме Node **22**.

### 1. Інструменти (один раз)

1. **Git** (якщо ще немає).
2. **Node.js 22.x** (рекомендовано 22.23.2 через winget):

```powershell
# якщо зараз Node 24 / інший major — зніміть і поставте 22:
winget uninstall --id OpenJS.NodeJS.22 -e
winget install --id OpenJS.NodeJS.22 --version 22.23.2 -e
```

Закрийте всі термінали, відкрийте новий:

```powershell
node --version   # очікується v22.x.x
```

3. **pnpm 10.15.0** — через Corepack (потрібні права на `Program Files\nodejs`) **або** у user-prefix (як `start.bat`):

```powershell
# варіант A (адмін / без EPERM):
corepack enable
corepack prepare pnpm@10.15.0 --activate

# варіант B (без адміна):
npm install -g pnpm@10.15.0 --prefix "$env:LOCALAPPDATA\pnpm-global"
# додайте в User PATH: %LOCALAPPDATA%\pnpm-global і %LOCALAPPDATA%\pnpm-global\bin
```

Перевірка: `pnpm --version` → `10.15.0`.

4. **PostgreSQL 16** *або* **Docker** (для `docker compose up -d postgres`). Для snapshot/restore — `pg_dump` / `psql` у PATH (часто `C:\Program Files\PostgreSQL\16\bin`).

5. **ngrok** (лише для публічного демо): акаунт на https://dashboard.ngrok.com — токен додасте на кроці тунелю нижче. За відсутності бінарника `start-tunnel.bat` спробує встановити через winget.

### 2. Клон і локальний запуск

```powershell
git clone https://github.com/Fours9/Loom-CRM.git
cd Loom-CRM
copy .env.example .env
```

У `.env` для **локального** `start.bat` можна лишити placeholder JWT. Для **`start-tunnel.bat`** обов’язково замініть:

```powershell
# приклад сильного секрету (≥32 символи; не комітити .env)
# openssl rand -base64 48
```

Поставте унікальний `JWT_SECRET=...` у `.env` (launcher тунелю відхилить `dev-only-change-me-loom-crm-jwt-secret`).

Далі схема + демо-дані:

```powershell
docker compose up -d postgres
pnpm install
pnpm migration:run
.\scripts\db-restore.ps1
.\start.bat
```

- API: http://localhost:3000/api/v1/health/live  
- Web: http://localhost:4200  
- Логін: акаунти зі знімка (часто `hr@tier.ua`); без restore — seed `admin@loom.local` / `Admin123!` (**лише localhost**, не для публічного URL)

`start.bat` після міграцій **не** викликає restore автоматично. Після clone / порожньої БД зробіть `db-restore.ps1` явно.

### 3. Демо через тунель (як у PW)

Один раз — authtoken:

```powershell
ngrok config add-authtoken <ВАШ_ТОКЕН з dashboard.ngrok.com>
```

Якщо `ngrok` не в PATH — запустіть `.\start-tunnel.bat` (встановить через winget), закрийте, у **новому** терміналі повторіть `add-authtoken`.

Перед тунелем: не-placeholder `JWT_SECRET` у `.env` + бажано вже виконаний `.\scripts\db-restore.ps1`.

```powershell
.\start-tunnel.bat
```

Постійне публічне посилання: **https://sureness-strewn-booting.ngrok-free.dev**  
(не запускайте одночасно тунель PW і Loom — спільний domain і порти 3000/4200.)

Детальніше: § [Демо через тунель](#демо-через-тунель-керівництво--зовнішній-https) нижче.

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

## Демо через тунель (керівництво / зовнішній HTTPS)

Тимчасове **публічне** демо з вашої машини (не production Compose). Локальний шлях: `start.bat`. Production/VPS: [deploy.md](deploy.md).

**Не запускайте** одночасно тунель ProjectWeekend і LoomCRM — спільний reserved domain і порти `3000`/`4200`.

### One-time

1. Node **22.x**, pnpm **10.15.0**, Postgres (як для локального старту).
2. ngrok: акаунт + reserved domain (той самий, що в PW):

```powershell
ngrok config add-authtoken <TOKEN з dashboard.ngrok.com>
```

3. У `.env` встановіть **не** placeholder JWT:

```text
JWT_SECRET=<випадковий рядок ≥32 символів>
```

Приклад: `openssl rand -base64 48`. Значення `dev-only-change-me-loom-crm-jwt-secret` launcher **відхилить**.

4. Дані для публічного демо:

- **або** `.\scripts\db-restore.ps1` (акаунти зі знімка; не світити seed `admin@loom.local` / `Admin123!` на публічному URL);
- **або** змінений пароль seed-адміна після порожньої міграції.

`start-tunnel.bat` **не** робить auto-restore.

### Запуск

```powershell
.\start-tunnel.bat
```

Launcher: перевіряє версії Node/pnpm, вільні порти 3000/4200, відсутність локального ngrok, безпечний JWT, `ngrok config check`, `pnpm migration:run`, піднімає API → чекає `/api/v1/health/live` → web → чекає `:4200` → ngrok з reserved domain і **перевіряє**, що піднято саме його (без fallback на випадковий URL).

| | URL |
| --- | --- |
| Local API | http://localhost:3000/api/v1 |
| Local Web | http://localhost:4200 |
| **Public (стабільний)** | https://sureness-strewn-booting.ngrok-free.dev |

Публічний URL **не є секретом**. Не лишайте тунель без нагляду; після демо закрийте три вікна (API / Web / Tunnel).

### Troubleshooting (тунель)

| Симптом | Рішення |
| --- | --- |
| Port 3000/4200 busy | Зупиніть локальний `start.bat` / PW / інші процеси; launcher **не** звільняє порти сам |
| Local ngrok already running | Закрийте інший тунель (зокрема PW) |
| JWT placeholder / short secret | Змініть `JWT_SECRET` у `.env` (≥32, не з `.env.example`) |
| `migration:run` failed | Postgres / `DATABASE_URL`; жодне вікно не стартує, доки міграції не пройдуть |
| ngrok config check fail | `ngrok config add-authtoken …` |
| ngrok exits / domain not verified | Нечинний токен, інший акаунт, зайнятий domain — див. лог вікна Tunnel; випадковий URL заборонений |
| Немає логінів на публічному URL | `.\scripts\db-restore.ps1`, перезапуск тунелю; не використовуйте відомий seed-пароль публічно |

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
| `Node.js major version must be 22` / engines | На PATH Node 24/20 — поставте **22.x**: `winget install --id OpenJS.NodeJS.22 --version 22.23.2 -e`, новий термінал; див. § «Налаштування нового ПК» |
| `pnpm` not found / EPERM Corepack | `npm install -g pnpm@10.15.0 --prefix "$env:LOCALAPPDATA\pnpm-global"` + User PATH |
| Після `git pull` API падає | Нові міграції — `pnpm migration:run` (після restore також перевірте `migration:show`) |
| Випадково змінили `ProjectWeekend/` | Відкотіть; `pnpm check:copy-source` |
| Потрібен публічний HTTPS для демо | `.\start-tunnel.bat` — § «Демо через тунель» вище (не Compose) |
