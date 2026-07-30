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
- Owner self-reopen vs HR request-changes (parameterized reopen cause); revision UX; proposal `superseded` + atomic generate: shipped

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
   - request-changes / owner reopen → assignment `changes_requested`; resubmit creates a **new** submission row.
5. **Reopen causes (different side effects):**
   - `owner_reopen`: assignment → `changes_requested`; latest submission **review metadata unchanged**; pending proposals for that submission → `superseded`.
   - `reviewer_request_changes` (HR `request-changes` or review → changes_requested): assignment → `changes_requested`; latest (or reviewed) submission gets `reviewStatus=changes_requested`, reviewer actor, `reviewedAt`, comment; pending for that submission → `superseded`.
6. **Profile proposals** reference `submission_id` (+ DTO `assignmentId` via join). Apply via Organization **application facade** (no HTTP loopback). Statuses: `pending` | `accepted` | `rejected` | `superseded`. For `superseded`, `reviewedAt` is **system resolution time** (not human review); `reviewedByUserId` is null. At most one `pending` per employee + `target_section` + `proposed_changes.field` (partial unique index).
7. **Proposal lifecycle:** supersede pending on reopen / request-changes / review→changes_requested **before** further edits; on submit, create submission + generate proposals **in one transaction**. Accepted/rejected history is never rewritten. `GET .../proposals` is **read-only**: returns pending, suppresses profile-equal rows in memory (no UPDATE). Residual pending after direct People profile edits is OK until next questionnaire write-path.
8. **No auto-apply** of questionnaire answers to profile.
9. **Actor classes** in catalog: `employee_owner` | `manager_in_scope` | `admin`. No runtime `hr` role.
10. **Assignment ownership:** only active User linked to Employee may fill; Admin/Manager do not answer on behalf; no account → reject assign.
11. **PR split:** PR-1 = templates/assignments/draft PATCH only; PR-5 = submit / request-changes / resubmit / review. Fill UI (PR-4) drafts after PR-3 and submits via PR-5.
12. **Do not** add `employees.photo_consent_status`. Photo legal consent → future Consents; `photoUrl` remains admin-managed until Platform Files.
13. **FE entry:** `apps/web/.../questionnaires/public-api.ts` for People assign/summary panels + `buildQuestionnaireAssignmentLink`. Fill page / DraftStore / Autosave / RevisionCoordinator / field widgets stay feature-private.

## Consequences

- Resubmission history is first-class; proposals stay attributable to a snapshot.
- Owner self-reopen does not fabricate reviewer history on the latest submission.
- Catalog and seed can drift — PR-2/seed docs must call out manual sync.
- Managers never see as “HR role”; permissions + scope + capabilities cover HR-like actions via `admin` (and future permission grants).
- Living status: [hr-profile-roadmap.md](../product/hr-profile-roadmap.md).

## References

- [questionnaire-360-field-catalog.md](../product/questionnaire-360-field-catalog.md)
- [ADR 0007](./0007-employee-profile-boundaries.md)
- [architecture.md](../architecture.md)
- [employee-profile-core.md](../product/employee-profile-core.md) §13 / §44
