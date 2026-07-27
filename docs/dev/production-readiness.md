# Production readiness checklist

Окремий етап після Profile Core / Documents MVP. Поточні runbook: [deploy.md](./deploy.md), [operations.md](./operations.md).

## Обов’язково перед зовнішнім prod

| Пункт | Статус у поставці | Дія |
| --- | --- | --- |
| TLS termination | Не в Compose | Reverse proxy / load balancer перед api+web |
| Secrets | Частина env ще inline у Compose examples | Лише secrets / `.env.production` (не в git); ротація JWT |
| Seed admin password | Дефолт у bootstrap | Змінити вручну одразу після першого старту |
| Backup | Ручний (`db-snapshot` / ops scripts) | Розклад + зберігання поза сервером |
| Restore drill | Не автоматизовано | Регулярна перевірка `db-restore` на staging |
| Error monitoring | Немає | Sentry / аналог (API + web) |
| Documents storage | Interim `content_base64` у Postgres | Platform Files + antivirus scanning |
| Antivirus upload | Немає | На рівні Files / gateway |

## Не блокує локальний / small-team deploy

- Health `live` / `ready` уже є.
- Migrations-only schema (без `synchronize`).
- Ops checklist у [operations.md](./operations.md).

## Definition of Done цього етапу

- TLS перед публічним URL.
- Немає дефолтних паролів/JWT у prod.
- Backup + успішний restore drill задокументовано з датою.
- Monitoring алерт на 5xx.
- План міграції Documents з base64 на Files узгоджений.
