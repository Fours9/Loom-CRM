# Questionnaire PDF print

Living product note for server-generated A4 questionnaire PDFs (paper-form layout **2.4**).

## Two formats (product SoT)

1. **Повністю чиста анкета (`mode: blank`)** — empty paper controls only (☐ unchecked, underlines/boxes empty). Directory «Роздрукувати заготовку» → `GET …/templates/:code/blank.pdf`.
2. **Частково / повністю заповнена (`mode: filled`)** — **same** form silhouette with answers (and draft `profileMirror` where applicable) written into controls. Partial fill is valid. Fill / People «Роздрукувати» → `GET …/assignments/:id/export.pdf`.

There is **no** third “review summary” PDF. FE Review keeps `formatQuestionnaireFieldDisplay`; PDF does not use those strings.

## Layout contract (v2)

- **One** schema walker (`buildQuestionnairePrintModel`) + **one** `PdfRenderer.renderQuestionnaire` grammar for all seed templates.
- Atomic `QuestionnairePrintControl` (`text_line` / `text_box` / `choice_list` / `checkbox_item`) reused **top-level and inside** `repeating_table` cells — never cell `display` strings.
- Composites: `contacts_form` (work / personal / emergency as controls; emergency = fullName, relationship, primaryPhone, secondaryPhone — **notes omitted from PDF**), `skills_matrix` (per-row rating).
- Blank ignores `visibleWhen`; filled applies it → blank is a **visibility-superset**.
- Layout SoT constants in `@loom/contracts-questionnaires`: `QUESTIONNAIRE_PRINT_LAYOUT_VERSION = '2.4'`, `PAPER_FORM_MIN_ROWS`, `TEXTAREA_PAPER_LINES` (3), `REPEATING_TEXTAREA_LINES`, contacts/skills blank row counts (`BLANK_CONTACTS_EMERGENCY_ROWS = 1`).
- Field chrome: muted label **above** a bordered write zone; `choice_list` is vertical by default; horizontal (caption above ☐) only for nested table choices (e.g. language level) and opt-in keys `company_work.status` / `schedule` / `contract_type`; PDF omits `company_work.mentor` and `company_work.hr_responsible`; major **print** sections start on a new page (no trailing blank pages). Managing `career_goals` + `probation_goals` schema steps coalesce to one print section «Цілі» (`coalesceGoalsPrintSteps`); field labels stay nested paper controls. Fill rail keeps them as substeps under parent «Цілі».

### Boolean mapping

- `boolean` + `uiControl === 'checkbox'` → `checkbox_item`
- otherwise → exclusive Так/Ні `choice_list`

### skills_matrix policies

| Mode / context | Rows |
| --- | --- |
| Blank Managing | Generic `identity: blank` × `BLANK_SKILLS_MATRIX_ROWS`; rating **`freehand`**; **no** live registry |
| Filled + frozen context | Context skills + per-skill `resolveMatrixRatingPolicy` → `choice_scale` / `number`; merge `ratings[]`; append `custom[]` |
| Filled + `contextJson = null` | Legacy `SKILL_DEFINITIONS` + default policy; merge ratings/custom (matches FE registry fallback) |

### Renderer

- Measure control / table row height before paint; never split one logical table row across pages.
- Column widths from control weights (checkbox/date compact, `text_box` wider) — not equal-width, not per-template layouts.

## Print source

| Assignment status | Answers | Context | profileMirror |
| --- | --- | --- | --- |
| `closed` (+ legacy submitted/reviewed) with latest submission | `snapshotJson` | `submission.contextJson` | **no** (immutable) |
| `closed` without submission | draft answers | `assignment.contextJson` | yes (detail policy) |
| `assigned` / `in_progress` / `changes_requested` / `cancelled` / `new` | draft answers | `assignment.contextJson` | yes |

Pure helper: `resolveQuestionnairePrintSource` (`@loom/questionnaire-schema`).

## Fill fidelity

1. `await autosave.flush()` before export.
2. Pass `?expectedDraftRevision=` after flush; backend **409** on mismatch when `sourceKind === draft`.
3. People / Directory omit the query.

## Endpoints (all `questionnaires.view`)

- `GET /api/v1/questionnaires/assignments/:id/export.pdf`
- `GET /api/v1/questionnaires/templates/:code/blank.pdf`
- `GET /api/v1/questionnaires/templates/printable` — published + template-code grant (do **not** use Assign-only `GET /templates`)

## Download filenames

Server SoT: `buildQuestionnairePdfFilenames` → `Content-Disposition` (`filename` ASCII + `filename*` UTF-8). CORS exposes `Content-Disposition`; FE downloads that name (no client-only `anketa-{code}.pdf`).

| Mode | Pattern (UTF-8) |
| --- | --- |
| Filled + attached employee | `Анкета_{title}_{таб№}_{Прізвище}_{Імʼя}_{assignmentCode}.pdf` |
| Filled + unattached | `Анкета_{title}_{assignmentCode}_{yyyyMMdd}.pdf` |
| Blank template | `Анкета_заготовка_{title}_{yyyyMMdd}.pdf` |

PDF body meta shows `employeeDisplayName` when attached (subject) and `generatedByLabel` as **Прізвище Імʼя** of the actor’s linked employee (email only if name unavailable).

## Architecture

- Single entry: `QuestionnairePdfExportService`.
- Platform `PdfModule` renders contracts DTOs only (`EmployeeProfilePrintModel` / `QuestionnairePrintModel`).
- Projector in `@loom/questionnaire-schema`; renderer draws controls only (domain-agnostic).

See [ADR 0015](../adr/0015-questionnaire-pdf.md).
