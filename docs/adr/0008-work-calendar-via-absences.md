# ADR 0008: Work calendar via Absences (expand-in-place)

## Status

Accepted (MVP implemented). Full Nest/URL/table rename remains deferred (phase 8).

## Context

Product needs overtime, business trips, and off-schedule full work days (e.g. a shoot on a weekend), not only absences. Today Absences is a full request + calendar + approval module under `/absences/*` with four types. A new Nest module or immediate URL rename would break PW-parity routes, permissions, docs, and the Angular client for little gain.

## Decision

1. **Expand Absences in place** for MVP. Keep `/absences/*`, `absence_requests`, and `Absences*` permissions as **compatibility identifiers**.
2. Introduce neutral domain language in **new code**: `TimeEvent`, `TimeEventRequest`, `TimeEventType`, category `absence | work`.
3. Entity may map to table `absence_requests`; storage columns `absence_start_time` / `absence_end_time` remain; domain names are `startTime` / `endTime`.
4. **Single source of type rules** lives only in API domain catalog (`apps/api/src/modules/absences/domain/`). `libs/contracts/absences` exposes **metadata DTO shapes** only; Angular consumes `GET /absences/metadata` — no mirrored rule catalog in contracts.
5. Split **TypeCatalog** (date/time shape, fields, schedule policy, visualKind) from **WorkflowPolicy** (roles, backdating, create-for-other, approval, post-approve adjust).
6. **business_trip** MVP: `date_range` + `timeMode: none` (no per-day or trip-boundary times yet).
7. **extra_work_day** MVP: allowed only when Organization schedule marks the date as a day off (strict backend check). Does **not** mutate weekly schedule.
8. **overtime** MVP: single day, required times, no midnight wrap; `durationMinutes` computed in **response mapping**, not persisted.
9. **isUnpaid** on `day_off` / `vacation` remains a **legacy** flag, not a full HR leave taxonomy; no `unpaid_leave` type in MVP.
10. Overlap: block on `pending` and `approved`; structured `TIME_EVENT_OVERLAP` errors; always `excludeRequestId` on update/adjust; re-check **inside** a DB transaction. No absolute DB exclusion constraint in MVP.
11. Time interpretation MVP: **Europe/Kyiv**; future Organization timezone setting.
12. Documents: atomic remap to neutral `time_event` / `eventType` for in-repo FE (API + web ship together). Do not emit dual `source` values in one field.
13. Calendar: employee `calendarColor` = identity; event semantics via `visualKind` + legend.
14. Full module/URL/table rename (`WorkCalendar`, `/work-calendar`) is **deferred** to a future ADR after MVP stabilizes. Temporary dual routes may appear then.

## Consequences

- Faster delivery of work events without breaking existing absences.
- Temporary linguistic mismatch (`AbsenceRequest` table vs TimeEvent code) — acceptable and documented.
- FE must stop hardcoding type lists once metadata is rich enough.
- High-concurrency double-create race remains theoretically possible without exclusion constraints — documented; sequential conflict covered by tests.

## References

- Living roadmap: [work-calendar-roadmap.md](../product/work-calendar-roadmap.md)
- Architecture arrows: [architecture.md](../architecture.md)
- Module boundaries: [ADR 0007](./0007-employee-profile-boundaries.md)
