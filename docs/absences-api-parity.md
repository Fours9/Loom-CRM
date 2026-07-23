# Absences API parity matrix (PW frontend → Loom)

Source of truth: ProjectWeekend `ApiService` + models. Status: `ready` | `partial` | `missing`.

| PW UI | Method | Expected response | Loom endpoint | Status |
|-------|--------|-------------------|---------------|--------|
| Dashboard | getEmployee | EmployeeProfile | GET /employees/:id | partial |
| Dashboard | getSchedule | ScheduleDay[] | GET /employees/:id/schedule | partial |
| Dashboard | getEmployeeRequests | { items } | GET /absences/employees/:id/requests | ready |
| Dashboard | downloadEmployeePdf | Blob | GET /employees/:id/export.pdf | missing/partial |
| Requests list | getRequests | { items, page, pageSize, total } | GET /absences/requests | ready |
| Detail | getRequest | permissions + history + attachments | GET /absences/requests/:id | ready |
| Create | createRequest | detail | POST /absences/requests | ready |
| Update | updateRequest | detail | PATCH /absences/requests/:id | ready |
| Lifecycle | approve/reject/adjust/deletion | permissions-aware | POST … | ready |
| Cancel/delete | deleteRequest | { ok } | DELETE /absences/requests/:id | ready |
| Attachments | upload/download/delete | multipart + blob | …/attachments | ready |
| Calendar | getCalendarRange | { days: [{ date, segments, overflowCount }] } | GET /absences/calendar | ready |
| Day drawer | getCalendarDay | { date, items } | GET /absences/calendar/days/:date | ready |
| Filters | departments/positions | arrays | GET /departments, /positions | ready |

Notes: privacy hatch / peer redaction and full calendar visibility policy remain simplified vs PW backend; expand when Admin privacy lands.
