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

**Не** використовується `TRUNCATE … CASCADE`. Templates/versions лишаються; API startup оновить schema через `QuestionnaireSeedService.ensureEmployee360V1()` (усі три шаблони).

### Seed / latest-version (living)

- Порівняння й запис schema йдуть через `schemaForPublishedVersion(seed, version)` — вирівнює checked-in `version` із номером рядка `questionnaire_template_versions`.
- Non-prod: якщо latest schema ≠ seed і **0** assignments на latest → **in-place refresh** того ж version; якщо є assignments → **publish next version** (не мутувати зайнятий published row).
- Prod: drift seed ↔ published → fail (immutable); потрібна нова версія вручну.
- Після reset (assignments = 0) + restart API seed знову може refresh latest `schema_json`.

## Snapshot DoD (обовʼязково після UX schema pass)

Live reset без оновлення tracked snapshot → наступний `db-restore.ps1` поверне старі drafts / старий schema.

Після reset + API restart (seed refresh) + smoke:

```powershell
.\scripts\db-snapshot.ps1
```

Закомітити оновлений `data/app.snapshot.sql`, якщо snapshot раніше містив questionnaire rows або застарілий `schema_json`. Інакше runbook перевіряє відсутність assignment/response/submission/proposal rows у snapshot і все одно фіксує актуальну v1 schema одним snapshot pass після seed (template/version rows з’являться після `migration:run` + API startup).

**Перевірка snapshot (без rows):** у `data/app.snapshot.sql` не повинно бути `COPY`/`INSERT` для `questionnaire_assignments` / `questionnaire_responses` / `questionnaire_submissions` / `questionnaire_profile_proposals` зі старими drafts. Після seed — `questionnaire_template_versions.schema_json` має містити steps `family` + `celebration_dates` і поле `family.other_dates` (`repeating_group`, не text `other_dates_note`).

Breaking answer shapes (наприклад `family.other_dates_note` text → `family.other_dates` list) вимагають reset + API restart перед smoke.

## Track B / Managing·Docs

Після зміни published schema `employee-managing` або `employee-docs` (Track B / UX parity): якщо локально вже є MAN/DOC assignments (або застарілий `schema_json`), виконати reset перед smoke:

```bash
ALLOW_QUESTIONNAIRE_TEST_RESET=YES pnpm questionnaires:reset -- --execute
```

Потім restart API (seed refresh latest via `schemaForPublishedVersion`). Деталі Position Catalog / matrix / Context V2: [position-catalog.md](./position-catalog.md).

## Коли потрібен reset

Перед in-place refresh latest published version `employee-360` / `employee-managing` / `employee-docs` (breaking answer shapes). Після першого **production** assignment — не мутувати зайнятий published version; публікувати наступну (seed non-prod уже робить auto-publish next при drift + assignments > 0).
