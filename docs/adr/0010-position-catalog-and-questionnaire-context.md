# ADR 0010: Position Catalog, Settings ownership, questionnaire context

## Status

Accepted.

## Implementation status

- `@loom/position-skill-catalog` pure skill code registry: **shipped (PR1)**; identity syntax + `MAX_POSITION_SKILLS` + Position Catalog custom codes: **this increment**
- `QuestionnaireContextV1` / **`QuestionnaireContextV2`** + `parseQuestionnaireContext` in contracts: **shipped** (V2 requires `skill.source`; V1 historical keep no-source shape; unknown-key reject)
- Track B published schemas `employee-managing` / `employee-docs` + `position_skills_matrix` fill/validation: **shipped (PR2)**; Managing/Docs UX parity (org refs, personal slice, skills sync): **shipped**
- `departments.direction_id`: **shipped**; hierarchy Direction ← Dept ← Position
- `positions.direction_id`: **restored** (`1730000023000-RestorePositionDirectionId`) — denormalized inherit from department when set, else optional manual (Decision #10). Earlier PR3 add + `1730000022000` drop are historical only.
- employment-assignment consistency (auto-fill dept/direction from catalog parents): **shipped**
- Settings «Керування посадами» (`/settings/positions`): **shipped (PR4)**; **superseded UI location:** sidebar **`/positions`** (suitcase icon; `/settings/positions` redirects); skills as full-width Groups+Skills block + position edit modal: **this increment**
- Organization `skill_groups` / `skills` / position requirements, duties, goal templates + Position Catalog UI: **shipped (PR5)**
- `PositionCatalogFacade` (`buildSnapshotForEmployee` + **`buildSnapshotForPosition`**), assign/attach capture, `questionnaire_* .context_json`: **shipped (PR6)**; new captures write **V2**; empty allowlist + fail-closed invalid context: **shipped**
- `QuestionnairePositionContextSyncService` (`POST …/sync-position-context`): **shipped** — set-algebra extras, prune stale ratings, always bump revision
- Native skill scale (`range`/`percent`): V1 matrix 0–5 / V2 native; `skillId` on V2; Managing `desiredExtraSkillCodes` sync; `employee_skill_assessments` + profile/Managing two-block matrix + close-submit + Managing add_skill proposals: **this increment**; pre-skillId V2 freezes get one-time `skillId` backfill by code on load/submit: **this increment**
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
   QuestionnaireContextV1 = { version: 1; positionCatalog: PositionCatalogContextV1 } // historical
   QuestionnaireContextV2 = { version: 2; positionCatalog: PositionCatalogContextV1 } // new captures; skills require source
   ```
   `parseQuestionnaireContext` is **strict fail-closed**: `version ∈ {1,2}`, full `positionCatalog` shape, reject unknown keys. V2 skills require `source: position_requirement | questionnaire_extra`. V1 skills must omit `source`.

6. **Capture:** write context in the **same TX** as attach / create-with-employee (after PR6). Unattached `new` → `context_json = null`. **New captures use V2** (`buildSnapshotForEmployee` / `buildSnapshotForPosition`). Historical V1 rows remain valid.

6b. **Immutability vs replaceability:**
   - **Submission** `context_json` is immutable forever (historical Review uses it).
   - **Assignment** `context_json` may be replaced: Managing `sync-position-context` may overwrite assignment V1/V2 with a fresh V2 (does not mutate past submissions).

7. **Legacy (`context_json = null`):** means **legacy_registry mode** forever — matrix rows and validation use `@loom/position-skill-catalog`; Review uses registry labels. **Do not** auto-`ensureContextCaptured` from live Position Catalog (would invalidate pre-PR6 ratings outside the new matrix). Non-null **invalid** context is a **server data-integrity** failure (HTTP 500), never silent legacy and never 400.

8. **Validation modes:**
   - Legacy null: `skillCode ∈ registry` (`allowedSkillCodes` omitted / `undefined`); UI = full registry
   - Context set (including `skills: []`): `skillCode ⊆ frozen context skill codes` (**not** ∩ registry). Empty array = allow none
   - V2 submit: every `questionnaire_extra` in context must appear in `skills.matrix` ratings (unused extras → 400)
   - Managing submit with context + answered `company_work.position_id`: answer position **must equal** `context.positionCatalog.positionId`
   - PATCH = structural (`isSkillIdentityCode`); SUBMIT = semantic (same split as contacts)
   - `custom[]` remains extra-catalog (not identity, not in allowlist)

9. **Position resolve precedence** for Facade `buildSnapshotForEmployee`:
   1. `employee.currentAssignmentId` (belongs + active) → `positionId`
   2. else deterministic active employment assignment
   3. else legacy `employee.positionId`
   4. else position null / empty skills

9b. **`buildSnapshotForPosition(employeeId, positionId, manager)`:** explicit position choice (Managing sync / draft position). Org parents from the Position row; **`employmentAssignmentId` is always `null`**. Skills from live requirements get `source: position_requirement`.

9c. **`sync-position-context` (Managing):** set-algebra over draft rating codes vs old/new requirement/extra sets (`computePositionContextSyncSets`) — carry extras, promote new extras from active Skill rows, **prune** stale old-requirement ratings from draft matrix; write V2 context; **always** bump response `revision` (CAS on `expectedDraftRevision`).

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

15. **Skill identity:** `@loom/position-skill-catalog` holds legacy registry (`isSkillCode`) **and** identity syntax (`isSkillIdentityCode`). Registry is SoT **only for legacy null context**. Position Catalog UI may create custom skills (`code` omitted → generated `skill_<hex>`; `code` provided → registry identity + unique). **`code` is the immutable questionnaire/domain answer key** (not editable via PATCH). **Context V2 additionally freezes `skillId`** (exact `skills.id` catalog-row identity) for cross-store writes such as profile assessment proposals — lookup by frozen `skillId`, never “same code → new row”. Snapshot capture includes all attached skills (no `isSkillCode` filter).

16. **Versioned matrix rating semantics:**
    - `context == null` / **Context V1:** questionnaire ratings stay **0..5**; frozen `scaleKind`/`min`/`max` are **requirement hints only** (rating `4` ≠ `4%`).
    - **Context V2:** ratings use frozen native skill scale (`scaleKind`/`scaleMin`/`scaleMax` **required** on each skill row, plus `skillId`). Percent → 0..100 (or skill bounds); range → `scaleMin`..`scaleMax`. Helper: `resolveMatrixRatingPolicy(contextVersion, skill)`.
    - Forbidden: silent conversion between percent and range; `gap = targetLevel - rating.level` across mismatched meanings.
    - Managing sync uses explicit `desiredExtraSkillCodes` (not null-rating transport). Matrix answers persist **rated** levels only. Profile bridge: `employee_skill_assessments` + Managing `add_skill` proposals (`insertConfirmedIfAbsent`) for **extras** and **rated position requirements**.
    - **People / Managing two blocks:** profile membership = **all** `position_skill_requirements` for the current employment assignment position (`required` is metadata only). Extras = confirmed assessments (People) or `questionnaire_extra` + pending desired codes (Managing) whose skill is **not** in that requirement set. No current position → People `profileItems=[]`, all confirmed → extras. Projection DTO: `{ profileItems, extraItems, capabilities.canEdit }` with `assessment: null` for unrated requirements (no fake assessment ids). People writes: `POST` extras only; `PATCH` existing level (profile or extra); `DELETE` extras only (requirement → 409). Managing UI: frozen `position_requirement` always profile (wins over `desiredExtraCodes`); legacy `context=null` labels are «Навички» / «Додаткові (legacy custom)» — not «з посади».
    - **Close dual policy:** draft → close **submits then closes** (`submittedViaClose`): lock → supersede **old** pending → `syncLocked` (Managing extras from persisted Context V2) or explicit `revision++` → `submitWithinTransaction` → `status=closed` — **never** supersede after new proposals. `submitted`/`reviewed` → close still supersedes pending. Close seals draft revision so concurrent `patchDraft` 409s. Public sync and close share `syncLocked` (no nested TX / no Assignment↔Sync DI cycle). `add_skill.sourceAtSubmission` drives UX «Підтвердити оцінку» vs «Додати навичку».

17. **Skill lifecycle:** deactivate (`PATCH isActive:false` / `softDeleteSkill`) **409** while any `position_skill_requirement` exists. Hard delete / scale mutation also **409** while any `employee_skill_assessment` exists (profile SoT). `DELETE /skills/:id` = **hard delete**: lock skill → assessments check → bulk `DELETE` requirements `WHERE skillId` → remove skill (FK stays RESTRICT). Attach only requires an **active skill**. Scale kind change with existing requirements → 409. Same-kind bound shrink allowed only if all existing `targetLevel` still fit. Skill row is the pessimistic lock root for scale update, deactivate, hard delete, requirement attach/`skillId` change, and assessment insert on proposal Accept. Max **64** skills per position (`MAX_POSITION_SKILLS`); same ceiling for `|requirements ∪ extras|` on Managing sync.

18. **Skill group identity and lifecycle:** Public `POST /skill-groups` does **not** accept `code` (`name` + optional `sortOrder` only). Position Catalog custom groups get generated immutable `group_<12hex>` (unique-violation retry), same idea as custom skills. Seeded `TECH` / `BEAUTY` / `OFFICE` stay migration/seed. **Group is optional live classification / sorting** (`skills.group_id` nullable) — not registry identity. Create/move **into** a uuid group requires that group to be **active**. Ungrouped skills (`groupId = null`) skip group lock. Deactivate group (`PATCH isActive:false` / `softDeleteGroup`) is **409** while any **active** skill remains. `DELETE /skill-groups/:id` = ungroup skills (`SET group_id = null`) then remove the group (not 409 because skills exist). Attach = active skill only. Group `isActive` gates Position Catalog **picker** availability (`skill.isActive AND (ungrouped OR group.isActive)`), not the persist/attach invariant. Membership mutations that lock both Group and Skill always lock **Group then Skill** (move locks **target** group only). Re-enable with omitted `groupId`: pre-read membership without lock, then Group→Skill and revalidate (409 if membership changed). `lockGroup(null)` is forbidden. Hard delete of the live catalog does **not** mutate frozen questionnaire `context_json`; legacy `context_json = null` still uses the immutable registry. Pre-create position skill requirements are a **frontend draft queue only** (not persisted without `positionId`); see [position-catalog.md](../dev/position-catalog.md).

## Consequences

- Track B Managing/Docs and Position Catalog UI are both shipped; fill can use frozen context for skills matrix (including custom Position Catalog skill codes and V2 `questionnaire_extra`).
- Pre-PR6 answers remain valid after PR6 deploy (legacy_registry mode).
- Historical V1 submission contexts stay immutable; assignment context may be upgraded to V2 via sync.
- Native skill scale: V1 questionnaire ratings stay 0–5; V2 ratings follow frozen native scale. Profile assessments are a separate Organization store bridged by proposals.
- Immutable submissions stay interpretable years later via `version` + frozen context.
- Cross-employee reattach after fill is rejected — safer than multi-subject history in one assignment.
- Optional wizard suggestions from `goalTemplates` / `duties` remain polish (context already captured).
