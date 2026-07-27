# HR / Employee profile roadmap

Source: [employee-profile-core.md](./employee-profile-core.md) §41–§49. Reference questionnaire: [references/anketa_360.html](./references/anketa_360.html).

| Phase | Scope | Status |
| --- | --- | --- |
| **1. Employee Profile Core** | Header, overview, employment history, contacts, personal, emergency, important dates, section edit, capabilities, audit/history, completeness, `/people/:id` | **In progress** |
| 2. Self-service + approval | `/me/profile`, change requests, HR queue | Planned |
| 3. Questionnaires MVP | Seeded 360 template, assign, autosave, submit, HR review, profile proposals | Planned |
| 4. Onboarding | Templates, tasks, progress widget | Planned |
| 5. Goals + probation reviews | Goals, manager review cycles | Planned |
| 6. Skills + development | Catalogs, position requirements, assessments | Planned |
| 7. Documents + consents | File metadata, verification, consent versions | **Partially implemented** (MVP: People Documents tab, `employee_documents` upload/list/download/soft-delete, Absences attachment aggregate; no Platform Files / verification / consents) |
| 8. Compensation + grades + analytics | Separate sensitive APIs | Planned |
| 9. Recruitment + offboarding | Later | Planned |

Phase 1 acceptance and boundaries: [ADR 0007](../adr/0007-employee-profile-boundaries.md).
