# ADR 0015: Questionnaire PDF export

## Status

Accepted

## Context

Fill / People / Directory had disabled «Роздрукувати» stubs. Living roadmap required blank and filled questionnaires to share one layout. Employee profile PDF already existed via Platform `PdfRenderer` (pdfkit), but `PdfRenderer` imported Organization `EmployeeProfilePrintModel` (forbidden Platform → Organization), and there was no Nest `PdfModule`.

People `snapshot-summary` is a partial excerpt and must not feed PDF. After submit, revision / `changes_requested` / cancel can diverge draft from the latest submission; printing “always latest snapshot” would mismatch the Fill screen. Submission freezes `contextJson` at submit time — historical org/skill labels must use that pair, not live assignment context.

## Decision

1. **Server PDF (pdfkit)** via Platform `PdfModule` / `PdfRenderer.renderQuestionnaire`. Deterministic **content/layout** given the print model (not byte-equality).
2. **Single export entry** in Questionnaires: `QuestionnairePdfExportService`.
3. **Print models in contracts:** `QuestionnairePrintModel` (`@loom/contracts-questionnaires`), `EmployeeProfilePrintModel` (`@loom/contracts-employees`). Platform imports contracts only.
4. **Two paper-form formats:** `mode: blank` (fully clean template) and `mode: filled` (same silhouette, partial/full answers). Not a review-summary PDF. Layout version `QUESTIONNAIRE_PRINT_LAYOUT_VERSION` (`2.4`).
5. **Atomic reusable controls** (`QuestionnairePrintControl`) for top-level fields, repeating-table cells, and contacts slots. Nested choice/checkbox/textarea stay paper controls — never flattened to display strings.
6. **skills_matrix:** per-row rating (`choice_scale` / `number` / `freehand`). Blank Managing = generic freehand rows (no registry). Filled + frozen context = context skills/scales. Filled + `contextJson = null` = legacy `SKILL_DEFINITIONS` registry (FE parity). Blank registry ban ≠ legacy filled fallback.
7. **State-aware source** (`resolveQuestionnairePrintSource`): `closed` → submission snapshot+context when present; `cancelled` and other open states → draft + assignment context. Button label remains «Роздрукувати».
8. **Draft** may use canonical `profileMirror` (same builder as getDetail). **Submitted** never injects live Employee profile.
9. Shared **resolve** helpers in `@loom/questionnaire-schema`; FE Review keeps `formatQuestionnaireFieldDisplay` / sourceLabel / inactive — PDF does not use review summaries.
10. Fill: flush autosave then `expectedDraftRevision` query; mismatch → 409.
11. AuthZ: outer `questionnaires.view`; assignment view gate shared with getDetail; blank + `GET /templates/printable` = View + published + template grant (Assign-only `GET /templates` unchanged).
12. Blank is a **visibility-superset** of filled (`visibleWhen` ignored on blank).

## Consequences

- PdfModule is safe to share across Organization and Questionnaires without Platform → domain app imports.
- Revision / cancel print matches on-screen draft; closed historical print stays frozen.
- Directory blank picker works for View holders without Assign.
- Layout 2.4 paper grammar (label-above write zones; horizontal choice only for nested table options and company_work status/schedule/contract_type; step page breaks without blank pages; checkboxes; ruled boxes; weighted table columns; measure-before-draw) replaces Label:value review-like rows. Emergency contact **notes** omitted from PDF; one emergency contact slot on the blank form.
- PDF sections are schema-step projections with a documented goals coalesce: Managing `career_goals` + `probation_goals` (and legacy single `goals`) → one print section «Цілі»; fill rail nests those steps under progress parent «Цілі». Answer field keys stay stable.
- Download filenames include employee identity when the assignment is attached; FE honors `Content-Disposition`.
