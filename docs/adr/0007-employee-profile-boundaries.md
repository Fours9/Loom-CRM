# ADR 0007: Employee Profile Core boundaries

## Context

The HTML prototype `docs/product/references/anketa_360.html` mixes permanent HR card data, voluntary fields, questionnaires, onboarding, reviews, goals, skills, documents, and consents in one form. Dumping that into `employees` (or a single JSON column) would break access control, history, and modularity.

## Decision

1. **Profile ≠ questionnaire.** Confirmed current state lives in Organization (Employee Profile Core). Time-bound answers live in future Questionnaires / Reviews / Goals modules.
2. **Separate tables** for contacts, emergency contacts, and employment assignments (with history). Do not grow `employees` into a mega-entity.
3. **Section-level APIs** and permission-aware projections; frontend hide is not security.
4. **Absences stay independent** of personal/emergency/compensation data; vacation is not an employment status.
5. **Absences employee UI** (`/absences/employees/*`) is left as-is for PW parity; CRM profile lives under `/people/:id`.

## Consequences

- Phase 1 implements Profile Core only (see `docs/product/hr-profile-roadmap.md`).
- Anti-patterns rejected: `employees.profile_json`, 100-field `UpdateEmployeeDto`, shared self+manager skill rating, absence-as-status.
