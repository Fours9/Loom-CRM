# ADR 0010: Position Catalog, Settings ownership, questionnaire context

## Status

Accepted.

## Implementation status

- `@loom/position-skill-catalog` pure skill code registry: **shipped (PR1)**; identity syntax + `MAX_POSITION_SKILLS` + Position Catalog custom codes: **this increment**
- `QuestionnaireContextV1` + `parseQuestionnaireContext` in contracts: **shipped** (strict full-shape + unknown-key reject on `1708c21`)
- Track B published schemas `employee-managing` / `employee-docs` + `position_skills_matrix` fill/validation: **shipped (PR2)**
- `departments.direction_id`: **shipped**; hierarchy Direction ← Dept ← Position
- `positions.direction_id`: **restored** (`1730000023000-RestorePositionDirectionId`) — denormalized inherit from department when set, else optional manual (Decision #10). Earlier PR3 add + `1730000022000` drop are historical only.
- employment-assignment consistency (auto-fill dept/direction from catalog parents): **shipped**
- Settings «Керування посадами» (`/settings/positions`): **shipped (PR4)**; **superseded UI location:** sidebar **`/positions`** (suitcase icon; `/settings/positions` redirects); skills as full-width Groups+Skills block + position edit modal: **this increment**
- Organization `skill_groups` / `skills` / position requirements, duties, goal templates + Position Catalog UI: **shipped (PR5)**
- `PositionCatalogFacade`, assign/attach capture, `questionnaire_* .context_json`: **shipped (PR6)**; empty allowlist + fail-closed invalid context: **shipped (`1708c21`)**
- Native skill scale (`range`/`percent`) independent of questionnaire 0–5: **this increment**
- Optional skill group (`group_id` nullable) + HTTP `DELETE` = hard delete (skill/group): **this increment**
- PR7 closeout: living docs + catalog sync; optional fill suggestions from `goalTemplates` / `duties` **not** shipped (context fields available for future UI)

## Context

Skills matrices, goals, and duties should depend on the employee’s **position** (with department and direction). Position Catalog CRUD lives at **`/positions`** (sidebar «Керування посадами»; `/settings/positions` redirects). Absences admin keeps privacy only. Questionnaire submit validates against immutable `templateVersion.schemaJson` — dynamic schema field lists would break determinism and historical answers.

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
   `parseQuestionnaireContext` is **strict fail-closed**: exact `version = 1`, full `positionCatalog` shape (required arrays/fields), reject unknown keys. Envelope-only checks are insufficient.

6. **Capture:** write `QuestionnaireContextV1` in the **same TX** as attach / create-with-employee (after PR6). Unattached `new` → `context_json = null`.

7. **Legacy (`context_json = null`):** means **legacy_registry mode** forever — matrix rows and validation use `@loom/position-skill-catalog`; Review uses registry labels. **Do not** auto-`ensureContextCaptured` from live Position Catalog (would invalidate pre-PR6 ratings outside the new matrix). Non-null **invalid** context is a **server data-integrity** failure (HTTP 500), never silent legacy and never 400.

8. **Validation modes:**
   - Legacy null: `skillCode ∈ registry` (`allowedSkillCodes` omitted / `undefined`); UI = full registry
   - Context set (including `skills: []`): `skillCode ⊆ frozen context skill codes` (**not** ∩ registry). Empty array = allow none
   - PATCH = structural (`isSkillIdentityCode`); SUBMIT = semantic (same split as contacts)
   - `custom[]` remains extra-catalog (not identity, not in allowlist)

9. **Position resolve precedence** for Facade snapshot:
   1. `employee.currentAssignmentId` (belongs + active) → `positionId`
   2. else deterministic active employment assignment
   3. else legacy `employee.positionId`
   4. else position null / empty skills

10. **Hierarchy & EmploymentAssignment:** Direction ←(optional) Department ←(optional) Position. Position stores `directionId`: if `departmentId` is set, direction is **inherited** from the department (forced sync); if no department, direction may be chosen manually. Assignment must match `position.departmentId` / `position.directionId` when those are set (auto-fill).
    - Partial update semantics:
      - omitted `directionId` does **not** clear a manual direction when resulting `departmentId == null`
      - when resulting `departmentId != null`, persisted `directionId` is recalculated from the department
      - when `departmentId` transitions to `null` and `directionId` is omitted, the previously inherited direction becomes the new manual direction
      - old persisted direction must never override a newly selected department

11. **Reattach:**
    - SAME employee: keep context + draft/history
    - DIFFERENT + not empty → **409** (create new assignment)
    - DIFFERENT + empty → discard context; fresh capture
    - Empty = `submissions.length === 0` && (`response == null` || `Object.keys(answersJson).length === 0`)

12. **Historical Review** uses `submission.context_json` (or registry if null); never current `assignment.context_json`.

13. **Settings:** move departments/positions UI to `/settings/positions` («Керування посадами»); Absences admin keeps privacy only.
    **Superseded for UI location by later increment:** Position Catalog UI lives at `/positions`; Organization remains owner; legacy `/settings/positions` redirects.

14. **Sensitive fields:** `grade.net_salary` and `manager_review` deferred until field/step sensitivity + scoped manager completion ACL exist. Track B does not ship them.

15. **Skill codes:** `@loom/position-skill-catalog` holds legacy registry (`isSkillCode`) **and** identity syntax (`isSkillIdentityCode`). Registry is SoT **only for legacy null context**. Position Catalog UI may create custom skills (`code` omitted → generated `skill_<hex>`; `code` provided → registry identity + unique; **no live group match** — `skillDefinitionByCode().group` is seed/legacy metadata only). **`code` is identity** (not editable via PATCH). Snapshot capture includes all attached skills (no `isSkillCode` filter).

16. **Two independent scales (do not mix):**
    - `PositionSkillRequirement.targetLevel` = target in the skill’s **native** scale (`range` or `percent`, `scaleMin`..`scaleMax`)
    - `position_skills_matrix.ratings[].level` = questionnaire assessment **0..5** (published schema)
    - Forbidden: compare, subtract, `gap = targetLevel - rating.level`, display as one scale, or convert `80% → 4`. Future normalization is a separate ADR.
    - Frozen skill rows may include optional all-or-none `scaleKind`/`scaleMin`/`scaleMax` (absent = old V1 snapshots). Fill may show “Вимога посади: 80%” next to “Ваша оцінка: 0–5”.

17. **Skill lifecycle:** deactivate (`PATCH isActive:false` / `softDeleteSkill`) **409** while any `position_skill_requirement` exists. `DELETE /skills/:id` = **hard delete**: lock skill → bulk `DELETE` requirements `WHERE skillId` → remove skill (FK stays RESTRICT). Attach only requires an **active skill** (missing/inactive group does not block persist). Scale kind change with existing requirements → 409. Same-kind bound shrink allowed only if all existing `targetLevel` still fit. Skill row is the pessimistic lock root for scale update, deactivate, hard delete, and requirement attach/`skillId` change. Max **64** skills per position (`MAX_POSITION_SKILLS`).

18. **Skill group identity and lifecycle:** Public `POST /skill-groups` does **not** accept `code` (`name` + optional `sortOrder` only). Position Catalog custom groups get generated immutable `group_<12hex>` (unique-violation retry), same idea as custom skills. Seeded `TECH` / `BEAUTY` / `OFFICE` stay migration/seed. **Group is optional live classification / sorting** (`skills.group_id` nullable) — not registry identity. Create/move **into** a uuid group requires that group to be **active**. Ungrouped skills (`groupId = null`) skip group lock. Deactivate group (`PATCH isActive:false` / `softDeleteGroup`) is **409** while any **active** skill remains. `DELETE /skill-groups/:id` = ungroup skills (`SET group_id = null`) then remove the group (not 409 because skills exist). Attach = active skill only. Group `isActive` gates Position Catalog **picker** availability (`skill.isActive AND (ungrouped OR group.isActive)`), not the persist/attach invariant. Membership mutations that lock both Group and Skill always lock **Group then Skill** (move locks **target** group only). Re-enable with omitted `groupId`: pre-read membership without lock, then Group→Skill and revalidate (409 if membership changed). `lockGroup(null)` is forbidden. Hard delete of the live catalog does **not** mutate frozen questionnaire `context_json`; legacy `context_json = null` still uses the immutable registry. Pre-create position skill requirements are a **frontend draft queue only** (not persisted without `positionId`); see [position-catalog.md](../dev/position-catalog.md).

## Consequences

- Track B Managing/Docs and Position Catalog UI are both shipped; fill can use frozen context for skills matrix (including custom Position Catalog skill codes).
- Pre-PR6 answers remain valid after PR6 deploy (legacy_registry mode).
- Native skill scale and questionnaire 0–5 stay independent; no implicit conversion.
- Pre-PR6 answers remain valid after PR6 deploy (legacy_registry mode).
- Immutable submissions stay interpretable years later via `version` + frozen context.
- Cross-employee reattach after fill is rejected — safer than multi-subject history in one assignment.
- Optional wizard suggestions from `goalTemplates` / `duties` remain polish (context already captured).
