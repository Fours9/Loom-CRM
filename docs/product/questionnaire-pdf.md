# Questionnaire PDF print

Living product note for server-generated A4 questionnaire PDFs.

## Layout contract

- **One** schema walker + **one** `PdfRenderer.renderQuestionnaire` grammar for all seed templates (`employee-360`, `employee-starter`, `employee-managing`, `employee-docs`).
- Blank and filled share schema order and visual grammar; **blank ignores `visibleWhen`**, filled applies it → blank is a **visibility-superset** (field counts need not match).
- Structured `repeating_group` rows in the print model; renderer draws underlines / values.
- Layout version: `QUESTIONNAIRE_PRINT_LAYOUT_VERSION` in `@loom/contracts-questionnaires`.

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

## Architecture

- Single entry: `QuestionnairePdfExportService`.
- Platform `PdfModule` renders contracts DTOs only (`EmployeeProfilePrintModel` / `QuestionnairePrintModel`).
- Shared value resolve + field format in `@loom/questionnaire-schema`.

See [ADR 0015](../adr/0015-questionnaire-pdf.md).
