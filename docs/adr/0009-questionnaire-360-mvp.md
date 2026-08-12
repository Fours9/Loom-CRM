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
14. **Assignment lifecycle (split permissions):**
    - `questionnaires.assign` — create + attach for status `new` (Admin + DepartmentManager in employee scope).
    - `questionnaires.manage_lifecycle` — cancel, close, reattach cancelled (Admin only in MVP).
    - `questionnaires.delete` — hard delete (Admin only).
    - **Cancel / detach** → `cancelled`; `employeeId = null`, `detachedFromEmployeeId = previous` (**authorization provenance** while detached, not only audit); keeps draft/submissions; supersedes pending proposals; audit `questionnaire.assignment.cancelled`.
    - **Attach** (replaces historical “reactivate”) → `POST .../attach` for `new` or detached `cancelled`; **any** attachable employee; clears `detachedFromEmployeeId`; status `assigned`; audit `questionnaire.assignment.attached` with `fromEmployeeId` / `toEmployeeId` / `attachKind` (`new` | `reattach`). Long-term from→to history lives in **audit_log**.
    - **Detached auth:** `new` (both employee ids null) = shared Assign pool (Admin + DM). `cancelled` scoped by `detachedFromEmployeeId` (DM sees only if previous employee in their scope — no blanket Assign on foreign cancelled).
    - **Close** → terminal `closed` (≠ `reviewed`); supersede all pending; no attach; no edit/submit/revision; hard delete still allowed; audit `questionnaire.assignment.closed`. Migration `down` fails if closed rows exist.
    - **Hard delete** → removes assignment aggregate via FK CASCADE; audit before delete; **does not** roll back profile fields already applied via accepted proposals. Hard delete **does not** rewind assignment code counters.
    - MVP **allows** multiple active assignments of the same template for one employee.
15. **Questionnaire identity + types:** template `code` is catalog identity. Types: `full` | `managing` | `docs` ([`QUESTIONNAIRE_TYPE_CATALOG`](../../libs/contracts/questionnaires/src/index.ts)). `employee-360` is type `full` («Повна»). Assignment codes `{PREFIX}-{NNN}`: `employee-360`→`360`, else `POV`/`MAN`/`DOC`. Service `comment` on create; readable with `questionnaires.read_assignment_comment` (Admin).
16. **Type ACL (single policy):** `canActorAccessAssignmentType` on **all** assignment read/write paths. Non-owner after scope → allow; elevated owner (Assign / ManageLifecycle / CompleteAny / Delete) → allow; plain owner → only `full`. Managing/Docs: Employee does not see/fill; DM may assign but **not** fill (no CompleteAny); Admin fills via CompleteAny. No separate `CompleteManaged` in MVP.
17. **Stubs (Variant A):** published minimal templates `employee-managing` / `employee-docs` — assignable and openable now; schemas intentionally sparse until product content lands. (`primary`/`general` collapsed into `full`; no `employee-general` stub.)
18. **Unattached create:** «майбутні співробітники» = create as `new` without employee until Employee + active User exist. Not a recruitment/candidate entity outside CRM.
19. **Fill-on-behalf:** `questionnaires.complete.any` (Admin) separate from Assign. Owner uses `complete.self`. Admin may edit/submit while `cancelled`; **`preserveCancelled`**: submit creates submission + proposals but **status stays `cancelled`** (attach is the only re-attach). `canReopenSelf` is owner-only; `canStartRevision` is CompleteAny on submitted/reviewed (shared revision → also opens owner).
20. **Directory:** `GET /questionnaires/directory` (not under `assignments/:id`); scope applied in SQL before pagination; `attachmentState` helper; aggregate `updatedAt` = `GREATEST(assignment.updated_at, response.updated_at)`. Create dialog lists templates via `GET /questionnaires/templates` (published template + published version SoT) with catalog label + description.

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
