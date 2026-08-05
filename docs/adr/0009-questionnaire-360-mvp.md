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
- Assignment lifecycle (cancel / reactivate / hard delete + audit): shipped
- Directory «Анкети», terminal `closed`, `QuestionnairesCompleteAny`, Admin fill-on-behalf / preserveCancelled submit: shipped

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
   - `reviewer_request_changes` (HR `request-changes` or review → changes_requested): assignment → `changes_requested`; latest submission gets `reviewStatus=changes_requested`, reviewer actor, `reviewedAt`, **required** comment; clears `change_request_resolution` / resolved-by/at (re-request after declined); pending for that submission → `superseded`. Review→changes_requested **only on latest** submission (else 409).
   - **Active reviewer request** (banner / resolve / amber list indicators): assignment + latest both `changes_requested`, non-empty comment, `reviewedByUserId` set, `change_request_resolution IS NULL`. Owner reopen without that → no fake «Потрібні зміни» banner.
   - **Resolve** `POST …/resolve-changes`: `completed` (CAS draft revision + `submitWithinTransaction` + resolution) or `declined` (assignment → `submitted` + resolution). Inbox: `questionnaire.changes_requested` → assignedBy (+ admins if author cannot edit after transition); resolve → `reviewedByUserId`. Detail living UX: [hr-profile-roadmap.md](../product/hr-profile-roadmap.md) § «Запит змін».
6. **Profile proposals** reference `submission_id` (+ DTO `assignmentId` via join). Apply via Organization **application facade** (no HTTP loopback). Statuses: `pending` | `accepted` | `rejected` | `superseded`. For `superseded`, `reviewedAt` is **system resolution time** (not human review); `reviewedByUserId` is null. At most one `pending` per employee + `target_section` + `proposed_changes.field` (partial unique index).
7. **Proposal lifecycle:** supersede pending on reopen / request-changes / review→changes_requested **before** further edits; on submit, create submission + generate proposals **in one transaction**. Accepted/rejected history is never rewritten. `GET .../proposals` is **read-only**: returns pending, suppresses profile-equal rows in memory (no UPDATE). Residual pending after direct People profile edits is OK until next questionnaire write-path.
8. **No auto-apply** of questionnaire answers to profile.
9. **Actor classes** in catalog: `employee_owner` | `manager_in_scope` | `admin`. No runtime `hr` role.
10. **Assignment ownership:** only active User linked to Employee may fill; Admin/Manager do not answer on behalf; no account → reject assign.
11. **PR split:** PR-1 = templates/assignments/draft PATCH only; PR-5 = submit / request-changes / resubmit / review. Fill UI (PR-4) drafts after PR-3 and submits via PR-5.
12. **Do not** add `employees.photo_consent_status`. Photo legal consent → future Consents; `photoUrl` remains admin-managed until Platform Files.
13. **FE entry:** `apps/web/.../questionnaires/public-api.ts` for People assign/summary panels + `buildQuestionnaireAssignmentLink`. Fill page / DraftStore / Autosave / RevisionCoordinator / field widgets stay feature-private.
14. **Assignment lifecycle (admin `questionnaires.assign`):**
    - **Cancel** → `cancelled`; keeps draft/submissions; supersedes **all** pending proposals for the assignment (any revision); audit `questionnaire.assignment.cancelled`.
    - **Reactivate** → same row back to `assigned` on the same employee; clears assignment `reviewedAt` (current-cycle marker); does **not** restore superseded proposals; audit `questionnaire.assignment.reactivated`. Submit also sets `assignment.reviewedAt = null`.
    - **Close** → terminal `closed` (≠ `reviewed`); supersede all pending; no reactivate; no edit/submit/revision; hard delete still allowed; audit `questionnaire.assignment.closed`. Migration `down` fails if closed rows exist.
    - **Hard delete** → removes assignment aggregate via FK CASCADE; audit before delete; **does not** roll back profile fields already applied via accepted proposals.
    - MVP **allows** multiple active assignments of the same template for one employee; reactivate does not check for another active row.
15. **Printable questionnaire identity:** `questionnaire_templates.code` (e.g. `employee-360`) — stable across assignments; **no** per-assignment serial codes.
16. **Fill-on-behalf:** `questionnaires.complete.any` (Admin) separate from Assign. Owner uses `complete.self`. Admin may edit/submit while `cancelled`; **`preserveCancelled`**: submit creates submission + proposals but **status stays `cancelled`** (reactivate is the only re-attach). `canReopenSelf` is owner-only; `canStartRevision` is CompleteAny on submitted/reviewed (shared revision → also opens owner).
17. **Directory:** `GET /questionnaires/directory` (not under `assignments/:id`); scope applied in SQL before pagination; `attachmentState` helper; aggregate `updatedAt` = `GREATEST(assignment.updated_at, response.updated_at)`.

## Consequences

- Resubmission history is first-class; proposals stay attributable to a snapshot.
- Owner self-reopen does not fabricate reviewer history on the latest submission.
- Cancel preserves the questionnaire aggregate; delete destroys immutable submissions as part of removing the aggregate.
- Applied profile changes from accepted proposals survive assignment delete — confirm UI and ops must say so.
- Multiple concurrent active 360 assignments per employee are possible until a uniqueness rule is added.
- Lifecycle actions leave an audit trail even when the assignment row is gone (delete).
- Admin detached submit does **not** implicitly reactivate — owner stays blocked until explicit reactivate.
- Granting Assign alone does **not** grant answer access; CompleteAny does.
- Catalog and seed can drift — PR-2/seed docs must call out manual sync.
- Managers never see as “HR role”; permissions + scope + capabilities cover HR-like actions via `admin` (and future permission grants).
- Living status: [hr-profile-roadmap.md](../product/hr-profile-roadmap.md).

## References

- [questionnaire-360-field-catalog.md](../product/questionnaire-360-field-catalog.md)
- [ADR 0007](./0007-employee-profile-boundaries.md)
- [architecture.md](../architecture.md)
- [employee-profile-core.md](../product/employee-profile-core.md) §13 / §44
