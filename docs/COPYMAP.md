# COPYMAP — ProjectWeekend → LoomCRM

ProjectWeekend is **read-only**. Actions describe how code was / will be brought into LoomCRM.

| Source (ProjectWeekend) | Destination (LoomCRM) | Action | Status | Required changes | Tests |
|-------------------------|----------------------|--------|--------|------------------|-------|
| backend/src/auth/ | apps/api/src/platform/auth/ | copy-refactor | done | permissions in session, Postgres, UUID | login + /me |
| backend/src/users/ | apps/api/src/platform/identity/ | copy-refactor | done | role→permissions adapter | seed admin |
| backend/src/audit/ | apps/api/src/platform/audit/ | copy-refactor | done | neutral `record()` API | used by auth/absences |
| backend/src/notifications/ | apps/api/src/platform/notifications/ | copy-refactor | done | neutral payload API | list/read endpoints |
| backend/src/settings/ | apps/api/src/platform/settings/ | copy-refactor | done | `application_settings` baseline | ready checks |
| backend/src/employees/ | apps/api/src/organization/employees/ | copy-refactor | done | scope policies, no Absences relations | CRUD + schedule |
| backend/src/departments/ | apps/api/src/organization/departments/ | copy-refactor | done | Postgres UUID | CRUD |
| backend/src/positions/ | apps/api/src/organization/positions/ | copy-refactor | done | Postgres UUID | CRUD |
| backend/src/requests/ | apps/api/src/modules/absences/ | copy-rewrite | done | PW response shapes + permissions + pagination + attachments | pwPermissions.spec |
| backend/src/calendar/ | apps/api/src/modules/absences/calendar/ | copy-rewrite | done | `{ days/segments }` + day items | GET calendar |
| frontend/layouts/shell | apps/web/src/app/layouts/shell.component.ts | copy-refactor | done | PW topbar + flyout under CRM shell | build |
| frontend/features/employees | apps/web/.../absences/employees/ | copy-preserve | done | Loom employees API | build |
| frontend/features/admin | apps/web/.../absences/admin/ | copy-preserve | done | GET/PUT /settings/privacy → application_settings | build |
| frontend/features/dashboard | apps/web/.../absences/dashboard/ | copy-preserve | done | `/absences` home | build |
| frontend/features/requests | apps/web/.../absences/requests/ | copy-preserve | done | `/absences/requests` | build |
| frontend/features/calendar | apps/web/.../absences/calendar/ | copy-preserve | done | CRM shell + PW module nav | build |
| frontend shell/login | CRM shell + login | do-not-copy | done | one host; Absences under CRM chrome | guards |
| SQLite bootstrap | — | do-not-copy | — | Postgres-native | migrations |
| data/app.sqlite | scripts/cutover importer | reference-only | done | dry-run + apply path | `pnpm cutover:dry-run` |

Actions: `copy` | `copy-preserve` | `copy-refactor` | `rewrite` | `reference-only` | `do-not-copy` | `deferred`.

Parity trackers: [docs/absences-api-parity.md](absences-api-parity.md), [docs/absences-ui-parity.md](absences-ui-parity.md).
