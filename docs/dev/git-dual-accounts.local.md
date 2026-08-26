# Git: два дзеркала Loom-CRM (шпаргалка)

Шпаргалка для машини з двома remote (`origin` = Fours9, `hr586` = дзеркало).  
На **hr586** цей файл може навмисно відсутній, якщо пушите лише в `origin`.

## Два акаунти = два remote

| Remote   | GitHub акаунт | Репозиторій |
|----------|---------------|-------------|
| `origin` | **Fours9**    | https://github.com/Fours9/Loom-CRM |
| `hr586`  | **hr586**     | https://github.com/hr586/Loom-CRM |

Це **два окремі однакові репо**, не два колабори на одному.

URL мають містити username (щоб Credential Manager не плутав акаунти):

```text
origin  https://Fours9@github.com/Fours9/Loom-CRM.git
hr586   https://hr586@github.com/hr586/Loom-CRM.git
```

Перевірка:

```powershell
cd C:\Loom-CRM-Core
git remote -v
git credential-manager github list
```

Очікувано в списку логінів: і `Fours9`, і `hr586`.

## Щоденні операції

Upstream гілки `master` тримайте на **origin** (основне дзеркало):

```powershell
git branch -u origin/master master
```

### Після коміту — пуш в ОБИДВА

```powershell
git pushboth
```

Alias (локальний `git config`, не в репо):

```text
pushboth = !git push origin HEAD && git push hr586 HEAD
```

Якщо alias зник:

```powershell
git config alias.pushboth "!git push origin HEAD && git push hr586 HEAD"
```

Або вручну:

```powershell
git push origin HEAD
git push hr586 HEAD
```

### Не робіть так без потреби

- `git push -u hr586 master` — перемикає tracking на `hr586`; потім знову:  
  `git branch -u origin/master master`
- Пуш лише в один remote — друге дзеркало відстане
- `git init` / новий README на порожньому GitHub — **не** для цього клону; репо вже існує локально

### Fetch / pull

```powershell
git fetch origin
git fetch hr586
# або
git pull origin master
```

Зазвичай працюєте з `origin`; `hr586` — дзеркало після push.

## Логін / «Repository not found»

Git використовує **Git Credential Manager**. Для private-репо чужий акаунт часто дає саме `Repository not found`, не «access denied».

### Хто зараз залогінений

```powershell
git credential-manager github list
```

### Увійти другим акаунтом

```powershell
git credential-manager github login --username Fours9
# або
git credential-manager github login --username hr586
```

Відкриється браузер — увійдіть **під потрібним** акаунтом.

### Скинути застарілий credential (якщо плутає акаунти)

```powershell
@"
protocol=https
host=github.com

"@ | git credential-manager erase
```

Або: Панель керування → Credential Manager → Windows Credentials → `git:https://github.com` → Remove.

Потім знову `github login` для **обох** username і перевірте `git fetch origin` + `git fetch hr586`.

### PAT (рідко потрібно)

Токен створюється на **github.com** (Settings → Developer settings → PAT), не в Windows.  
Classic: scope `repo`. Fine-grained: Contents **Read and write** на потрібне репо.  
**Не вставляйте PAT у чат з AI.** Краще браузерний логін через GCM.

## Перше налаштування на новій машині

1. Клон з основного (Fours9) або будь-якого дзеркала.
2. Додати другий remote:

```powershell
git remote add hr586 https://hr586@github.com/hr586/Loom-CRM.git
git remote set-url origin https://Fours9@github.com/Fours9/Loom-CRM.git
```

3. Логін обох акаунтів (`github login --username …`).
4. Alias `pushboth`.
5. `git branch -u origin/master master`.
6. Скопіювати цей файл знову (він не в git) або відновити з бекапу.

## Швидкий чеклист перед push

- [ ] `git status` / коміт готовий
- [ ] `git pushboth` (або origin **і** hr586)
- [ ] Немає токенів у файлах репо / чаті
- [ ] Tracking: `master` → `origin/master`
