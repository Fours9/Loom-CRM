# ADR 0007: Employee Profile Core boundaries

## Context

The HTML prototype `docs/product/references/anketa_360.html` mixes permanent HR card data, voluntary fields, questionnaires, onboarding, reviews, goals, skills, documents, and consents in one form. Dumping that into `employees` (or a single JSON column) would break access control, history, and modularity.

## Decision

1. **Profile ≠ questionnaire.** Confirmed current state lives in Organization (Employee Profile Core). Time-bound answers live in future Questionnaires / Reviews / Goals modules.
2. **Separate tables** for contacts, emergency contacts, important dates (`employee_important_dates`), and employment assignments (with history). Do not grow `employees` into a mega-entity.
3. **Section-level APIs** and permission-aware projections; frontend hide is not security.
4. **Absences stay independent** of personal/emergency/compensation data; vacation is not an employment status.
5. **Absences employee UI** (`/absences/employees/*`) is left as-is for PW parity; CRM profile lives under `/people/:id`.

## Consequences

- Phase 1 Profile Core is **shipped** (see [hr-profile-roadmap.md](../product/hr-profile-roadmap.md)); remaining Phase 1 items are deferred polish (history actor UI, capability-gated tabs, list completeness filter), not a reopen of Core scope.
- Anti-patterns rejected: `employees.profile_json`, 100-field `UpdateEmployeeDto`, shared self+manager skill rating, absence-as-status.
- People `/people/:id` shows a **Документи** tab that composes `modules/documents` + Absences document-items APIs on the frontend. Document rows live in `employee_documents`, not on `employees`. Access is permission-aware with a type matrix (manager cannot see questionnaire/identity/medical/consent for others); Admin holds `documents.manage`. Frontend hide is not security.
- Living module arrows (including Documents → Platform / Organization): [architecture.md](../architecture.md).
