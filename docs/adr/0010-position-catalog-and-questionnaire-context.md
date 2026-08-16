# ADR 0010: Position Catalog, Settings ownership, questionnaire context

## Status

Accepted.

## Implementation status

- `@loom/position-skill-catalog` pure skill code registry: **shipped (PR1)**
- `QuestionnaireContextV1` + `parseQuestionnaireContext` in contracts: **shipped (PR1)**
- Track B published schemas `employee-managing` / `employee-docs` + `position_skills_matrix` fill/validation: **shipped (PR2)**
- `positions.direction_id` (PR3) → superseded by **Department → Direction**; position inherits direction via department
- `departments.direction_id` + drop `positions.direction_id`: **shipped**
- employment-assignment consistency (auto-fill dept/direction from catalog parents): **shipped**
- Settings «Керування посадами» (`/settings/positions`): **shipped (PR4)**
- Organization `skill_groups` / `skills` / position requirements, duties, goal templates + Settings catalog tabs: **shipped (PR5)**
- `PositionCatalogFacade`, assign/attach capture, `questionnaire_* .context_json`: **shipped (PR6)**
- PR7 closeout: living docs + catalog sync; optional fill suggestions from `goalTemplates` / `duties` **not** shipped (context fields available for future UI)

## Context

Skills matrices, goals, and duties should depend on the employee’s **position** (with department and direction). Position Catalog CRUD lives under Settings (`/settings/positions`); Absences admin keeps privacy only. Questionnaire submit validates against immutable `templateVersion.schemaJson` — dynamic schema field lists would break determinism and historical answers.

## Decision

1. **Ownership:** Position Catalog (positions, directions CRUD, skill catalog, position requirements/duties/goal templates) lives in **Organization**. Questionnaires → Organization via `PositionCatalogFacade` only. Future Skills/Goals modules may extract catalogs without reversing arrows.

2. **Architectural formula (immutable):**
   - Published schema = stable answer shape (`keys` + `valueTypes`)
   - Position Catalog = context / allowed rows / requirements
   - Draft = entered values
   - `assignment.context_json` = frozen catalog snapshot for this assignment
   - Submission = immutable answers + immutable `context_json` copy

3. **Forbidden:** merging catalog into an “effective schema field list” on GET/loadDraft; live catalog read on every GET.

4. **Allowed:** `skills.matrix` with `valueType = position_skills_matrix`; rows come from registry (legacy) or frozen `context.positionCatalog.skills` (post-PR6 new assignments).

5. **Context envelope:**
   ```ts
   QuestionnaireContextV1 = { version: 1; positionCatalog: PositionCatalogContextV1 }
   ```
   `parseQuestionnaireContext` is fail-closed on unknown `version`.

6. **Capture:** write `QuestionnaireContextV1` in the **same TX** as attach / create-with-employee (after PR6). Unattached `new` → `context_json = null`.

7. **Legacy (`context_json = null`):** means **legacy_registry mode** forever — matrix rows and validation use `@loom/position-skill-catalog`; Review uses registry labels. **Do not** auto-`ensureContextCaptured` from live Position Catalog (would invalidate pre-PR6 ratings outside the new matrix).

8. **Validation modes:**
   - Legacy null: `skillCode ∈ registry`
   - Context set: `∈ registry` **and** `⊆ frozen context skill codes`
   - PATCH = structural; SUBMIT = semantic (same split as contacts)

9. **Position resolve precedence** for Facade snapshot:
   1. `employee.currentAssignmentId` (belongs + active) → `positionId`
   2. else deterministic active employment assignment
   3. else legacy `employee.positionId`
   4. else position null / empty skills

10. **Hierarchy & EmploymentAssignment:** Direction ←(optional) Department ←(optional) Position. Position stores `directionId`: if `departmentId` is set, direction is **inherited** from the department (forced sync); if no department, direction may be chosen manually. Assignment must match `position.departmentId` / `position.directionId` when those are set (auto-fill).

11. **Reattach:**
    - SAME employee: keep context + draft/history
    - DIFFERENT + not empty → **409** (create new assignment)
    - DIFFERENT + empty → discard context; fresh capture
    - Empty = `submissions.length === 0` && (`response == null` || `Object.keys(answersJson).length === 0`)

12. **Historical Review** uses `submission.context_json` (or registry if null); never current `assignment.context_json`.

13. **Settings:** move departments/positions UI to `/settings/positions` («Керування посадами»); Absences admin keeps privacy only.

14. **Sensitive fields:** `grade.net_salary` and `manager_review` deferred until field/step sensitivity + scoped manager completion ACL exist. Track B does not ship them.

15. **Skill codes:** single SoT `@loom/position-skill-catalog` — Questionnaires seed and Organization skills seed both import it (never Questionnaires `seed/shared` imported by Organization).

## Consequences

- Track B Managing/Docs and Position Catalog Settings UI are both shipped; fill can use frozen context for skills matrix.
- Pre-PR6 answers remain valid after PR6 deploy (legacy_registry mode).
- Immutable submissions stay interpretable years later via `version` + frozen context.
- Cross-employee reattach after fill is rejected — safer than multi-subject history in one assignment.
- Optional wizard suggestions from `goalTemplates` / `duties` remain polish (context already captured).
