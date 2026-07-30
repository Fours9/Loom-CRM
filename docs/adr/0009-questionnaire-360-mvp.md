# ADR 0009: Questionnaire 360 MVP (JSON schema + immutable submissions)

## Status

Accepted.

## Implementation status

- Foundation (templates, assignments, draft revision, submissions, proposals): shipped
- Assignment UI (People «Анкети» panel + snapshot summary): shipped
- Fill wizard (PR-4 schema-driven `/questionnaires/:id`): shipped
- Schema UX (family / celebration_dates, visibleWhen, layout groups, from/to, multi-language): shipped
- `@loom/questionnaire-schema` pure helpers + submit visible-answer projection: shipped
- Application startup composition root (single `OnModuleInit`): shipped

## Versioning (pre-production)

`employee-360` **v1** may be refreshed in-place from checked-in seed **only while there are no real assignments that must be preserved** (pre-production). Use [`docs/dev/questionnaire-test-reset.md`](../dev/questionnaire-test-reset.md) before breaking schema changes.

After the first **production** assignment, published template versions are **immutable**. Schema drift in production fails startup; publish **version 2+** instead of overwriting v1.

Non-production seed may overwrite v1 `schema_json` only when assignment count for that version is **0**; if assignments > 0 and seed differs → throw (reset or v2).

## Context

`anketa_360.html` mixes permanent profile, voluntary snapshot answers, skills, grade/pay, goals, reviews, onboarding, documents, and consents. Dumping fields onto `employees` or a single mutable `submitted_snapshot_json` on the draft response breaks history when HR requests changes and resubmission occurs.

Phase 2 `/me` + generic approval is deferred. Fill wizard UI integrates submit after PR-5 APIs are stable.

## Decision

1. **Module:** `apps/api/src/modules/questionnaires/` (Variant A). Arrows: Questionnaires → Organization (+ Platform). Forbidden: Organization → Questionnaires; Platform → Questionnaires; `apps/web` → `apps/api` source.
2. **Two SoT layers:**
   - Product/policy: [`questionnaire-360-field-catalog.md`](../product/questionnaire-360-field-catalog.md) (keys, options values, privacy, MVP inclusion, proposals).
   - Runtime: `questionnaire_template_versions.schema_json` (published form).
   - Seed: checked-in typed seed (PR-2), manually synced from catalog — **not** Markdown/HTML parsers.
3. **JSON answers, not relational questions** for MVP. Defer `questionnaire_questions` / per-answer rows until a template builder.
4. **Immutable submissions table** (not overwrite on response):
   - `questionnaire_responses` — mutable `answers_json` + `revision`.
   - `questionnaire_submissions` — immutable `snapshot_json`, `submission_number`, `submitted_by_user_id`, review fields.
   - request-changes reopens draft; resubmit creates a **new** submission row.
5. **Profile proposals** reference `submission_id` (not only assignment). Apply via Organization **application facade** in the same Nest process (no HTTP loopback, no direct Org repository writes from Questionnaires).
6. **No auto-apply** of questionnaire answers to profile.
7. **Actor classes** in catalog: `employee_owner` | `manager_in_scope` | `admin`. No runtime `hr` role.
8. **Assignment ownership:** only active User linked to Employee may fill; Admin/Manager do not answer on behalf; no account → reject assign.
9. **PR split:** PR-1 = templates/assignments/draft PATCH only; PR-5 = submit / request-changes / resubmit / review. Fill UI (PR-4) drafts after PR-3 and submits via PR-5.
10. **Do not** add `employees.photo_consent_status`. Photo legal consent → future Consents; `photoUrl` remains admin-managed until Platform Files.
11. **FE entry:** `apps/web/.../questionnaires/public-api.ts` for People assign/summary panels + `buildQuestionnaireAssignmentLink`. Fill page / DraftStore / AutosaveCoordinator / field widgets stay feature-private.

## Consequences

- Resubmission history is first-class; proposals stay attributable to a snapshot.
- Catalog and seed can drift — PR-2/seed docs must call out manual sync.
- Managers never see as “HR role”; permissions + scope + capabilities cover HR-like actions via `admin` (and future permission grants).
- Living status: [hr-profile-roadmap.md](../product/hr-profile-roadmap.md).

## References

- [questionnaire-360-field-catalog.md](../product/questionnaire-360-field-catalog.md)
- [ADR 0007](./0007-employee-profile-boundaries.md)
- [architecture.md](../architecture.md)
- [employee-profile-core.md](../product/employee-profile-core.md) §13 / §44
