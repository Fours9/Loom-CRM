# ADR 0014: Employee About Profile Core

## Context

People «Про себе» needs a current soft-profile SoT independent of questionnaire template grants on every read. Questionnaire snapshots are immutable history; using them as live Profile truth mixed domains and ACL.

## Decision

1. **Organization owns** table `employee_about` (one row / employee, flat `answers` jsonb keyed by About field keys).
2. **FK** `employee_id REFERENCES employees(id) ON DELETE RESTRICT`. Hard-delete erases via `OrganizationEmployeeErasureFacade` before employee row delete. CASCADE is forbidden (would hide forgotten erase).
3. **`last_source_submission_id`** is an opaque UUID with **no FK** and **no TypeORM relation** to Questionnaires (avoids reverse domain dependency in schema).
4. **Shared vocabulary** lives in pure lib `@loom/employee-about-catalog` (`ABOUT_SUBTAB_DEFS`, `ABOUT_FIELD_DEFS`, `canonicalizeAboutMutation`, validation, projector). Organization and Questionnaire seeds must not create Organization → Questionnaires imports for labels/options.
5. **HTTP contracts** for `/employees/:id/about` live in `@loom/contracts-employees`.
6. **Write path (single entry):** `EmployeeAboutFacade.mergeAnswers({ set, clearKeys, source })` with atomic JSONB `(answers || set) - clearKeys`. Empty set+clearKeys → no-op.
7. **Sync:** on questionnaire `submitWithinTransaction`, present About keys from snapshot + conditional `clearKeys`; `source.kind = 'questionnaire'`. Manual PATCH uses `source.kind = 'manual'` and must not wipe provenance. About GET projects catalog `children` for repeating_group so FE editors stay catalog-driven (no hard-coded goal schemas in Angular).
8. **Semantics:** absent snapshot key never clears; controller PRESENT that hides a dependent → clear dependent (same policy for sync and PATCH).
9. **AuthZ:** read = view ∧ `people.tab.about`; write = `canEditEmployeeAbout` pure helper.

## Consequences

- Snapshot remains audit; About is current truth.
- Concurrent PATCH/sync of different keys do not lose each other.
- Forgotten About erase fails closed on employee DELETE (RESTRICT).
- Soft tenure (`experience.total_tenure`) may live in About subtab «Досвід»; full career history (`prior_jobs`, managed_*) stays questionnaire snapshot only.
- Catalog is the only vocabulary gate: a questionnaire key reaches About iff it is in `ABOUT_FIELD_DEFS` (extracted on submit, validated on PATCH).
