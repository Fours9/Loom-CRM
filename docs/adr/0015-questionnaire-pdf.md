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
4. **State-aware source** (`resolveQuestionnairePrintSource`): `closed` → submission snapshot+context when present; `cancelled` and other open states → draft + assignment context. Button label remains «Роздрукувати».
5. **Draft** may use canonical `profileMirror` (same builder as getDetail). **Submitted** never injects live Employee profile.
6. Shared **resolve** + **format** helpers in `@loom/questionnaire-schema`; FE Review keeps sourceLabel / inactive.
7. Fill: flush autosave then `expectedDraftRevision` query; mismatch → 409.
8. AuthZ: outer `questionnaires.view`; assignment view gate shared with getDetail; blank + `GET /templates/printable` = View + published + template grant (Assign-only `GET /templates` unchanged).
9. Blank is a **visibility-superset** of filled (`visibleWhen` ignored on blank).

## Consequences

- PdfModule is safe to share across Organization and Questionnaires without Platform → domain app imports.
- Revision / cancel print matches on-screen draft; closed historical print stays frozen.
- Directory blank picker works for View holders without Assign.
