# Position Catalog (dev)

Living companion to [ADR 0010](../adr/0010-position-catalog-and-questionnaire-context.md).

## Packages

| Package | Role |
| --- | --- |
| `@loom/position-skill-catalog` | Pure registry (`isSkillCode`) + identity (`isSkillIdentityCode`) + `MAX_POSITION_SKILLS` — Position Catalog custom codes + legacy matrix |
| `@loom/contracts-questionnaires` | `QuestionnaireContextV1`, `QUESTIONNAIRE_VALUE_TYPES`, `position_skills_matrix` |

## Position Catalog UI

Product path: **`/positions`** (sidebar «Керування посадами»; `/settings/positions` redirects here) — three catalog rail columns (directions, departments, positions) plus a full-width **Groups + Skills** block below the rail (not a 4th rail column). Frontend feature: `apps/web/src/app/features/positions/` (lazy route); `/settings/positions` remains a compatibility redirect. Position edit modal attaches requirements; details panel skills are read-only. Absences admin keeps privacy only (no position CRUD there).

## Build

```bash
pnpm --filter @loom/position-skill-catalog build
pnpm --filter @loom/position-skill-catalog test
```

API `dev`/`build`/`typecheck` already build this package before Nest compile.

## Rollout modes (matrix)

| Assignment | Rows | Validation | Review labels |
| --- | --- | --- | --- |
| `context_json == null` (**legacy_registry**) | full `@loom/position-skill-catalog` | `skillCode ∈ registry` | registry |
| `context_json.version === 1` (**context**) | frozen `positionCatalog.skills` (incl. custom codes; `[]` = no ratings) | ⊆ frozen codes (**not** ∩ registry) | frozen context (not live catalog) |

`ratings[].level` is always questionnaire **0–5**. `targetLevel` on the requirement/frozen row is the skill’s **native** scale (`range` / `percent`) — do not convert or gap-compare.

`custom[]` stays extra-catalog (not identity).

Never auto-upgrade legacy null to a live Position Catalog snapshot (`ensureContextCaptured` from live catalog is forbidden — would invalidate pre-PR6 ratings).

Historical Review uses `submission.context_json` (or registry if null), never current `assignment.context_json`.

## Frozen context fields (future UI)

`assignment.context.positionCatalog` (and submission copy) already includes:

| Field | Use today | Optional polish |
| --- | --- | --- |
| `skills` | `position_skills_matrix` rows + validation | — |
| `goalTemplates` | captured; **not** shown in fill wizard yet | non-blocking suggestions on `career_goals` / `probation_goals` |
| `duties` | captured; **not** shown in fill wizard yet | optional duties panel |

## Migrations

| Migration class / file | PR | What |
| --- | --- | --- |
| `PositionsDirectionId1730000019000` | PR3 | briefly added `positions.direction_id` |
| `DepartmentBelongsToDirection1730000022000` | follow-up | `departments.direction_id`; temporarily dropped `positions.direction_id` |
| `RestorePositionDirectionId1730000023000` | follow-up | **restores** denormalized `positions.direction_id` (inherit from dept when set; else optional manual) |
| `PositionSkillCatalog1730000020000` | PR5 | `skill_groups` / `skills` (seed from registry) + `position_skill_requirements` / `position_duties` / `position_goal_templates` |
| `QuestionnaireContextJson1730000021000` | PR6 | `questionnaire_assignments.context_json` / `questionnaire_submissions.context_json` |
| `QuestionnaireAssignmentTitle1730000024000` | follow-up | optional assignment `title` |
| `SkillNativeScale1730000025000` | this increment | `skills.scale_kind` / `scale_min`; DROP DEFAULT on `position_skill_requirements.target_level` |
| `SkillGroupOptional1730000026000` | this increment | `skills.group_id` nullable (optional live classification) |

**Hierarchy:** Direction ←(optional) Department ←(optional) Position. Position stores `directionId` (Decision #10 / ADR 0010): department set → inherit; no department → optional manual.

## Position direction semantics

`positions.direction_id` is a **persisted field**, but it is not always independently editable.

| `departmentId` | `directionId` | Semantics |
| --- | --- | --- |
| `null` | `null` | Global position without direction |
| `null` | `value` | Global position with manual direction |
| `value` | `value/null from department` | Persisted derived copy from Department |
| `value` | arbitrary other value | Invalid state |

Transition rules:

- `create/update Position` use `resolvePositionDirectionId()` as the canonical policy.
- `departmentId != null` means `directionId` is recalculated from the department and cannot be edited independently.
- Partial PATCH with omitted `directionId` must **not** clear manual direction when resulting `departmentId == null`.
- Transition `department -> null` with omitted `directionId` preserves the previously inherited direction as the new manual direction.
- `DepartmentsService` separately keeps child `positions.direction_id` in sync via transactional cascade when a parent department changes its direction.

**Context modes:** `context_json == null` → legacy_registry; valid v1 (including `skills: []`) → frozen allowlist; non-null invalid → data-integrity error (not legacy).

Schema via TypeORM migrations only — never `synchronize: true`.

## Pre-create skill requirements (frontend draft queue)

Persisted `position_skill_requirements` still require a `positionId`. The Position dialog lets the user queue requirements **before** create, as a frontend-only command list (`PositionDraftSkillQueue`). This is **not** a second domain model.

Boundaries:

| Layer | Role |
| --- | --- |
| `PositionEditDialog` | Multi-select + chips (same widget as Absences filters). Maps `{ id, name }` → widget labels. Does not know queue vs HTTP. |
| `PositionManagementFacade` | Orchestration + `PositionDialogMode` lifecycle. Picker membership → queue; persist via `persistDraftRequirements`. |
| `persistDraftRequirements` | Single persist entry. `lockUi: true` (create / Retry) uses `applying-drafts`. `lockUi: false` (edit picker) does not, so the dropdown stays open. Save/Close wait on in-flight picker persist. |
| `PositionDraftSkillQueue` | Transient pending/failed/conflict commands. Monotonic `sequence` is **session-level apply order only**. Attach defaults: `required = true`, `targetLevel = skill.scaleMin` (native scale). The modal does not edit scale/`обовʼязкова`. Max **64** skills is enforced in the queue, not shown as a counter. |
| `SettingsOrgApiService` | Legacy-named shared Organization HTTP client (relocation/rename deferred): positions, requirements, skill groups/skills. |
| Backend | Persistence, validation, group/skill lifecycle. |

Picker list order: `compareByUkNameThenId` (uk locale, then `id`). Chip order is **selection order** in the session; server membership is merged without reordering. After a full browser reload, chips follow the first catalog load (`createdAt ASC, id ASC`).

`PositionDialogMode`: `create` → `creating-position` → (`unresolved-create` **or** `applying-drafts` → `edit` / `edit-with-failed-drafts`). Edit-picker persist does **not** enter `applying-drafts`.

Create outcome classification (fail-closed):

- HTTP `400` / `409` received → known rejection; draft queue kept; retry allowed
- transport/timeout/`5xx` (no structured rollback contract) → `unresolved-create`; Save disabled; no blind retry; Close needs acknowledgement, then reload positions. Do **not** look up the position by name.

Requirement mutations use `RequirementRowVm.kind` (`draft` → queue, `persisted` → HTTP), not `editingId()`. This keeps mixed persisted + failed draft rows working after partial apply.

After apply, reload and reconcile by `skillId` **and** `targetLevel`/`required`. Same skill with different values is `conflict`, not silent success.

Canonical **persisted** list order: `createdAt ASC, id ASC`.

Close policy: non-empty create drafts → confirm discard; `creating-position` / `applying-drafts` / picker persist in flight → close disabled; `unresolved-create` → acknowledgement; `edit-with-failed-drafts` → warn before discarding failed intents.

## Skill groups in Position Catalog

The Groups + Skills block is two columns in one card: groups (CRUD) and skills for the selected filter. Pinned rows above the name-sorted groups (not in the sort): **Усі навички** (`selected = null`) and **Без групи** (`__ungrouped__`, `groupId == null`). In all-skills mode, ungrouped skills show a «Без групи» badge. Public `POST /skill-groups` accepts `{ name, sortOrder? }` only — **no `code`**. Backend `createCustomGroup()` generates immutable `group_<12hex>` with unique-violation retry. Seeded `TECH` / `BEAUTY` / `OFFICE` remain migration-only. Live group membership is **not** bound to registry `skillDefinitionByCode().group`.

Skill/group commands (backend; do not conflate):

| HTTP | Effect |
| --- | --- |
| `PATCH isActive` | Toggle (deactivate skill 409 while requirements exist; deactivate group 409 while **active** skills remain) |
| `DELETE /skills/:id` | Hard delete: bulk-delete that skill’s requirements, then remove the skill |
| `DELETE /skill-groups/:id` | Hard delete: ungroup remaining skills (`group_id = null`), then remove the group |

- create/move **into** a uuid group → target group must be active
- ungrouped create / `PATCH groupId: null` → no group lock
- re-enable grouped skill without `groupId` in PATCH → lock Group then Skill; 409 if membership changed mid-TX
- attach requirement → skill active only (inactive/missing group does not block persist)
- picker (UI, stricter) → `skill.isActive AND (groupId == null OR group.isActive)`

Group `isActive` controls availability in the Position Catalog UI picker, but is **not** a persistence/attach invariant for Skill.

Hard delete affects the **live** Position Catalog and **future** context captures only. Existing frozen questionnaire contexts remain unchanged; legacy `context_json=null` continues to use the immutable legacy registry.

Management UI loads groups with `all=true`. Frontend does not re-implement these rules; it shows API errors.

## Local schema refresh (Track B)

After pulling Track B / Managing·Docs schema changes, if local DB already has `employee-managing` / `employee-docs` assignments (or stale `schema_json`), run:

```bash
ALLOW_QUESTIONNAIRE_TEST_RESET=YES pnpm questionnaires:reset -- --execute
```

Then restart API so seed refreshes published v1. See [questionnaire-test-reset.md](./questionnaire-test-reset.md). Do **not** mutate published v1 after the first production assignment — publish version 2 instead.
