# ADR 0009: Questionnaire 360 MVP (JSON schema + immutable submissions)

## Status

Accepted (foundation planned; implementation follows PR-0…PR-7 roadmap).

## Context

`anketa_360.html` mixes permanent profile, voluntary snapshot answers, skills, grade/pay, goals, reviews, onboarding, documents, and consents. Dumping fields onto `employees` or a single mutable `submitted_snapshot_json` on the draft response breaks history when HR requests changes and resubmission occurs.

Phase 2 `/me` + generic approval is deferred. Fill wizard UI is owned outside the shared foundation PRs; API contracts must be stable before submit integration.

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
9. **PR split:** PR-1 = templates/assignments/draft PATCH only; PR-5 = submit / request-changes / resubmit / review. Fill UI (PR-4) may draft after PR-3; integrate submit only after PR-5.
10. **Do not** add `employees.photo_consent_status`. Photo legal consent → future Consents; `photoUrl` remains admin-managed until Platform Files.
11. **FE entry:** `apps/web/.../questionnaires/public-api.ts` for People assign/summary panels.

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
