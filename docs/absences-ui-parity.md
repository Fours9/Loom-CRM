# Full PW in CRM — UI parity checklist

> Product UI label: **«Робочий календар»** (compat routes remain `/absences/*`). See [work-calendar-roadmap](product/work-calendar-roadmap.md) and [ADR 0008](adr/0008-work-calendar-via-absences.md).

Side-by-side vs ProjectWeekend. Values: **pass** | **fail** only.

| Screen | PW | Loom | visual | behavior | API data | responsive | role matrix |
|--------|----|------|--------|----------|----------|------------|-------------|
| App chrome (nav/inbox/theme) | app shell | CRM `ShellComponent` (PW topbar + flyout) | fail | fail | pass | fail | fail |
| Module home | `/` | `/absences` | fail | fail | pass | fail | fail |
| Employees list | `/employees` | `/absences/employees` | fail | fail | partial | fail | fail |
| Employee detail | `/employees/:id` | `/absences/employees/:id` | fail | fail | partial | fail | fail |
| Requests | `/requests` | `/absences/requests` | fail | fail | pass | fail | fail |
| Create | `/requests/new` | `/absences/requests/new` | fail | fail | pass | fail | fail |
| Detail | `/requests/:id` | `/absences/requests/:id` | fail | fail | pass | fail | fail |
| Calendar | `/calendar` | `/absences/calendar` | fail | fail | pass | fail | fail |
| Admin | `/admin` | `/absences/admin` | fail | fail | partial | fail | fail |
| CRM Home entry | — | `/` CTA → `/absences` | pass | pass | — | pass | — |

Engineering wiring done: full PW Absences UI under CRM shell (one host); Postgres via Loom API. Visual/behavior cells stay **fail** until human side-by-side pass.

**Loom chrome (living):** calendar + employees/requests directories use shared `pw-stage` / `pw-filters` / `pw-menu` overlays. Calendar dept/type/status are inclusive multi (`[]` = all) via `buildCalendarQueryFilters`; employee filter is single select. Requests status/type are inclusive multi via API `statusGroups`/`types` (`[]` = all; `buildRequestsListQuery`). Hero/nav compact actions use global `.pw-link-action` (not full `pw-btn--ghost`). Embedded calendar (People tab) uses **local** filter/board stacking (same gate as documents panel).

**AuthZ (living, ADR 0011):** approve/admin are AccountRole permissions (`absences.approve` / atomic `absences.admin`↔surface), not `users.role`. Row caps via `AuthorizationContext` + managed submission dept; create-for-other from `metadata.capabilities.canCreateForOther`. Admin page: surface guard + real `GET/PUT /settings/privacy` (`application_settings` `privacy.*`). Profile comment/PDF/field caps live under Settings «Доступи» (`employees.read_team_comment` / `export_profile` / field toggles); absences FE `isAdmin()` wraps `isAdminEquivalent`.

## Create request navigation contract

- Єдина FE-точка формування переходу: `apps/web/src/app/features/absences/requests/create-request-navigation.ts`.
- Create screen підтримує:
  - `startDate=YYYY-MM-DD`;
  - `employeeId=<id>` для Admin/Manager.
- Невалідні query params ігноруються.
- CTA day drawer передає дату відкритого дня.
- У персональному або звуженому календарі drawer також передає `employeeId`.
- Route definition у `absences.routes.ts` лишає literal `requests/new` (виняток для route config).
