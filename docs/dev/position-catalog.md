# Position Catalog (dev)

Living companion to [ADR 0010](../adr/0010-position-catalog-and-questionnaire-context.md).

## Packages

| Package | Role |
| --- | --- |
| `@loom/position-skill-catalog` | Pure `SKILL_DEFINITIONS` / `isSkillCode` — shared by questionnaire Track B and Organization skills seed |
| `@loom/contracts-questionnaires` | `QuestionnaireContextV1`, `QUESTIONNAIRE_VALUE_TYPES`, `position_skills_matrix` |

## Settings UI

Product path: **`/settings/positions`** («Керування посадами») — directions, departments, positions, per-position skill requirements / duties / goal templates. Absences admin keeps privacy only (no position CRUD there).

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
| `context_json.version === 1` (**context** / post-PR6 attach) | frozen `positionCatalog.skills` | ∈ registry **and** ⊆ context codes | frozen context (not live catalog) |

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

**Hierarchy:** Direction ←(optional) Department ←(optional) Position. Position stores `directionId` (Decision #10 / ADR 0010): department set → inherit; no department → optional manual.

**Context modes:** `context_json == null` → legacy_registry; valid v1 (including `skills: []`) → frozen allowlist; non-null invalid → data-integrity error (not legacy).

Schema via TypeORM migrations only — never `synchronize: true`.

## Local schema refresh (Track B)

After pulling Track B / Managing·Docs schema changes, if local DB already has `employee-managing` / `employee-docs` assignments (or stale `schema_json`), run:

```bash
ALLOW_QUESTIONNAIRE_TEST_RESET=YES pnpm questionnaires:reset -- --execute
```

Then restart API so seed refreshes published v1. See [questionnaire-test-reset.md](./questionnaire-test-reset.md). Do **not** mutate published v1 after the first production assignment — publish version 2 instead.
