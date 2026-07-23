# Full PW in CRM — UI parity checklist

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
