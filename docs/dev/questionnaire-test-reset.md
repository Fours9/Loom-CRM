# Reset questionnaire test data (pre-production)

**Fail-safe.** Не викликається зі startup/deploy.

## Команди

```bash
# Dry-run: host/name + counts
pnpm questionnaires:reset

# Execute (non-production only)
ALLOW_QUESTIONNAIRE_TEST_RESET=YES pnpm questionnaires:reset -- --execute
```

PowerShell:

```powershell
.\scripts\reset-questionnaire-test-data.ps1
$env:ALLOW_QUESTIONNAIRE_TEST_RESET = 'YES'
.\scripts\reset-questionnaire-test-data.ps1 -Execute
```

## Guards

| Умова | Результат |
|-------|-----------|
| `NODE_ENV=production` | завжди відмова |
| `--execute` без `ALLOW_QUESTIONNAIRE_TEST_RESET=YES` | відмова |
| без `--execute` | лише dry-run |

## Що видаляється (одна транзакція)

1. `questionnaire_profile_proposals`
2. `questionnaire_submissions`
3. `questionnaire_responses`
4. `questionnaire_assignments`

**Не** використовується `TRUNCATE … CASCADE`. Templates/versions лишаються; API startup оновить `schema_json` v1 якщо assignments = 0.

## Snapshot DoD (обовʼязково після UX schema pass)

Live reset без оновлення tracked snapshot → наступний `db-restore.ps1` поверне старі drafts / старий schema.

Після reset + API restart (seed refresh) + smoke:

```powershell
.\scripts\db-snapshot.ps1
```

Закомітити оновлений `data/app.snapshot.sql`, якщо snapshot раніше містив questionnaire rows або застарілий `schema_json`. Інакше runbook перевіряє відсутність assignment/response/submission/proposal rows у snapshot і все одно фіксує актуальну v1 schema одним snapshot pass після seed (template/version rows з’являться після `migration:run` + API startup).

**Перевірка snapshot (без rows):** у `data/app.snapshot.sql` не повинно бути `COPY`/`INSERT` для `questionnaire_assignments` / `questionnaire_responses` / `questionnaire_submissions` / `questionnaire_profile_proposals` зі старими drafts. Після seed — `questionnaire_template_versions.schema_json` має містити steps `family` + `celebration_dates`.

## Коли потрібен reset

Перед in-place refresh `employee-360` v1 (breaking answer shapes). Після першого **production** assignment — не мутувати published v1; публікувати version 2.
