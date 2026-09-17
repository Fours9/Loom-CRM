# ADR 0009: Questionnaire 360 MVP (JSON schema + immutable submissions)

## Status

Accepted.

## Implementation status

- Foundation (templates, assignments, draft revision, submissions, proposals): shipped
- Assignment UI (People «Анкети» panel + snapshot summary): shipped
- Fill wizard (PR-4 schema-driven `/questionnaires/:id`): shipped. First-fill auto-edit (`assigned`/`in_progress` + `canEditDraft` + 0 submissions) in `DraftStore.load` before step resolve; Review «Надіслати»; list `canStartFill` → «Почати»; revision chrome «Зберегти і закрити» hidden on Review.
- Schema UX (family / celebration_dates, visibleWhen, layout groups, from/to, multi-language): shipped
- `@loom/questionnaire-schema` pure helpers + submit visible-answer projection: shipped
- Application startup composition root (single `OnModuleInit`): shipped
- Owner self-reopen vs HR request-changes (parameterized reopen cause); revision UX; proposal `superseded` + atomic generate: shipped
- Assignment lifecycle (cancel / reactivate / hard delete + audit): shipped
- Directory «Анкети», submit→`closed` lock-in, revision/request-changes from closed+submission, `QuestionnairesCompleteAny`, Admin fill-on-behalf: shipped
- Contacts step: `contacts.bundle` (`contacts_bundle`), shared editor with People profile, draft SoT, `@loom/employee-contacts` + Organization `EmployeeContactsFacade`, proposal apply via work scalars + replace-sets: shipped

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
5. **Reopen / review causes (different side effects):**
   - `owner_reopen` / `admin_start_revision`: assignment → `changes_requested`; `assignment.reviewedAt = null`; latest submission **review metadata unchanged**; pending for that submission → `superseded`. Allowed only from post-submit statuses (`closed` + legacy `submitted`/`reviewed`) **with** a latest submission (`canStartRevisionFromState`).
   - **Reviewer write** (single API): `POST …/submissions/:submissionId/review` via `applyReviewTransition` — path id is optimistic identity; TX locks Assignment→Response→latest and requires `submissionId === latest.id` else **409**.
     - `approve`: latest must be `pending` → `approved`; assignment stays **`closed`**; `assignment.reviewedAt = now` (compatibility mirror of «latest is approved»).
     - `request_changes`: latest → `changes_requested` + required comment; **clears** `change_request_resolution` / resolved-by/at; assignment → `changes_requested`; `assignment.reviewedAt = null`; pending → `superseded`.
   - **Active reviewer request** (banner / resolve / amber list indicators): assignment + latest both `changes_requested`, non-empty comment, `reviewedByUserId` set, `change_request_resolution IS NULL`. Owner reopen without that → no fake «Потрібні зміни» banner.
   - **Resolve** `POST …/resolve-changes`: `completed` (CAS draft revision + `submitWithinTransaction` + resolution) or `declined` (assignment → **`closed`** + `reviewedAt=null` + resolution). Inbox unchanged. Detail living UX: [hr-profile-roadmap.md](../product/hr-profile-roadmap.md) § «Запит змін».
   - AuthZ on review: `QuestionnairesReview` + employee scope + **`requireActorAccessAssignmentTemplate`** + caps (`canReview` / `canRequestChanges`) before TX; `applyReviewTransition` is domain-only.
6. **Profile proposals** reference `submission_id` (+ DTO `assignmentId` via join). Apply via Organization **application facade** (no HTTP loopback). Statuses: `pending` | `accepted` | `rejected` | `superseded`. For `superseded`, `reviewedAt` is **system resolution time** (not human review); `reviewedByUserId` is null. At most one `pending` per employee + `target_section` + `proposed_changes.field` (partial unique index).
7. **Proposal lifecycle:** supersede pending on reopen / request-changes / review→changes_requested **before** further edits; on submit, create submission + generate proposals **in one transaction**. Accepted/rejected history is never rewritten. `GET .../proposals` is **read-only**: returns pending, suppresses profile-equal rows in memory (no UPDATE). Residual pending after direct People profile edits is OK until next questionnaire write-path.
8. **No auto-apply** of questionnaire answers to profile.
9. **Actor classes** in catalog: `employee_owner` | `manager_in_scope` | `admin`. No runtime `hr` role.
10. **Assignment ownership / fill:** assign/attach requires a viewable Employee only (no User account required). Self-fill (`complete.self`) needs an active User linked to that Employee; without an account the owner path is unavailable until account exists. Admin fill-on-behalf uses `complete.any` (§19).
11. **PR split:** PR-1 = templates/assignments/draft PATCH only; PR-5 = submit / request-changes / resubmit / review. Fill UI (PR-4) drafts after PR-3 and submits via PR-5.
12. **Do not** add `employees.photo_consent_status`. Photo legal consent → future Consents; `photoUrl` remains admin-managed until Platform Files.
13. **FE entry:** `apps/web/.../questionnaires/public-api.ts` for People assign/summary panels + `buildQuestionnaireAssignmentLink`. Fill page / DraftStore / Autosave / RevisionCoordinator / field widgets stay feature-private.
14. **Assignment lifecycle (split permissions):**
    - `questionnaires.assign` — create + attach for status `new` (Admin preset; DM via **extra**, not base preset — Variant A).
    - `questionnaires.manage_lifecycle` — cancel, close, reattach cancelled (Admin; Settings Manage bundle with delete).
    - `questionnaires.delete` — hard delete (Admin; Manage bundle).
    - Template visibility — AccountRole `questionnaireTemplateCodes` (not type ACL).
    - **Cancel / detach** → `cancelled`; `employeeId = null`, `detachedFromEmployeeId = previous` (**authorization provenance** while detached, not only audit); keeps draft/submissions; supersedes pending proposals; audit `questionnaire.assignment.cancelled`. Allowed from post-submit **`closed`** (same as legacy `submitted`) as well as assigned / in_progress / changes_requested / legacy submitted|reviewed.
    - **Attach** (replaces historical “reactivate”) → `POST .../attach` for `new` or detached `cancelled`; **any** attachable employee; clears `detachedFromEmployeeId`; status `assigned`; audit `questionnaire.assignment.attached` with `fromEmployeeId` / `toEmployeeId` / `attachKind` (`new` | `reattach`). Long-term from→to history lives in **audit_log**.
    - **Detached auth:** `new` (both employee ids null) = shared Assign pool (Admin + DM). `cancelled` scoped by `detachedFromEmployeeId` (DM sees only if previous employee in their scope — no blanket Assign on foreign cancelled).
    - **Submit** → assignment **`closed`** (canonical post-submit lock-in) + new submission `reviewStatus=pending` + `assignment.reviewedAt=null`. Legacy enum values `submitted`/`reviewed` remain in contracts but write-path no longer sets them; migration collapses existing rows to `closed`.
    - **Close** → `closed`. May submit draft first (`submittedViaClose`). Manual close **without** a submission is terminal: no revision/review/request-changes (`canStartRevisionFromState` fail-closed). Hard delete still allowed; audit `questionnaire.assignment.closed`.
    - **Hard delete** → removes assignment aggregate via FK CASCADE; audit before delete; **does not** roll back profile fields already applied via accepted proposals. Hard delete **does not** rewind assignment code counters.
    - MVP **allows** multiple active assignments of the same template for one employee.
15. **Questionnaire identity + types:** template `code` is catalog identity. Types: `full` | `managing` | `docs` ([`QUESTIONNAIRE_TYPE_CATALOG`](../../libs/contracts/questionnaires/src/index.ts)). `employee-360` is type `full` («Повна»). Assignment codes `{PREFIX}-{NNN}`: `employee-360`→`360`, else `POV`/`MAN`/`DOC`. Service `comment` on create; readable with `questionnaires.read_assignment_comment` (Admin).
16. **Template-code ACL (single policy):** `canActorAccessAssignmentTemplate` / `hasQuestionnaireTemplate` on **every** assignment-touching path (detail, draft/submit/review, cancel/close/attach/delete, proposals list/accept/reject, latestSnapshotSummary, assignment notifications). Access = Employee/detached scope ∧ (**adminEq** ∨ `code ∈ AuthorizationContext.questionnaireTemplateCodes`). Capability SoT is `AuthorizationContext` + `hasPermission(authz, …)` — not deprecated `PermissionService.has(actor.role, …)`. Settings «Доступи»: checklist of template codes + Assign toggle + Manage bundle (`manage_lifecycle` ∧ `delete`; XOR rejected). **Variant A:** Assign is **not** in DM base preset (seeded as extra for DM-preset roles). Unattached `new` READ requires Assign∨Lifecycle∨Delete ∧ grant — never View alone. Plain-owner type ACL (`EMPLOYEE_OWNER_VISIBLE_QUESTIONNAIRE_TYPES`) removed from runtime. **Rollout:** non-owner “managed scope sees all types” is a conscious security break (fail-closed by grants).
17. **Content schemas (Track B):** published `employee-managing` / `employee-docs` with HTML-derived content (no `net_salary` / `manager_review` until sensitive ACL). Skills use `position_skills_matrix` + `@loom/position-skill-catalog` ([ADR 0010](0010-position-catalog-and-questionnaire-context.md)).
18. **Unattached create:** «майбутні співробітники» = create as `new` without employee until an Employee exists to attach. Not a recruitment/candidate entity outside CRM. Attach does **not** wait for a User account.
19. **Fill-on-behalf:** `questionnaires.complete.any` (Admin) separate from Assign. Owner uses `complete.self`. Admin may edit/submit while assignment is in owner-editable statuses when caps allow. `canReopenSelf` is owner-only; `canStartRevision` is CompleteAny — both require `canStartRevisionFromState` (post-submit **with** latest submission).
20. **Directory:** `GET /questionnaires/directory` (not under `assignments/:id`); scope applied in SQL before pagination; `attachmentState` helper; aggregate `updatedAt` = `GREATEST(assignment.updated_at, response.updated_at)`. Create dialog lists templates via `GET /questionnaires/templates` (published template + published version SoT) with catalog label + description.
21. **Assignment vs Submission:** Assignment = workflow/editability; Submission = immutable version + review authority (`reviewStatus`). `assignment.reviewedAt` is a compatibility projection of «latest submission is currently approved» (null on submit / request-changes / decline; set on approve).

## Consequences

- Resubmission history is first-class; proposals stay attributable to a snapshot.
- Owner self-reopen does not fabricate reviewer history on the latest submission.
- Cancel preserves the questionnaire aggregate; delete destroys immutable submissions as part of removing the aggregate.
- Applied profile changes from accepted proposals survive assignment delete — confirm UI and ops must say so.
- Multiple concurrent active 360 assignments per employee are possible until a uniqueness rule is added.
- Lifecycle actions leave an audit trail even when the assignment row is gone (delete).
- Admin detached submit does **not** implicitly reattach — owner stays blocked until explicit attach.
- Granting Assign alone does **not** grant answer access; CompleteAny does.
- Catalog and seed can drift — PR-2/seed docs must call out manual sync.
- Managers never see as “HR role”; permissions + scope + capabilities cover HR-like actions via `admin` (and future permission grants).
- Living status: [hr-profile-roadmap.md](../product/hr-profile-roadmap.md).

## References

- [questionnaire-360-field-catalog.md](../product/questionnaire-360-field-catalog.md)
- [ADR 0007](./0007-employee-profile-boundaries.md)
- [architecture.md](../architecture.md)
- [employee-profile-core.md](../product/employee-profile-core.md) §13 / §44
