# Work calendar roadmap (living)

**Status:** MVP implemented (phases 0–7). Phase 8 rename deferred.

Продуктова назва UI: **«Робочий календар»**. Технічний compatibility namespace: Absences (`/absences/*`, таблиця `absence_requests`, permissions `Absences*`).

## Тригер

Користувачі хочуть фіксувати не лише відсутності, а й **робочі** події: понаднормові, відрядження, повноцінний робочий день поза графіком (напр. зйомка у вихідний 1 серпня).

## Стратегія

| Тема | Рішення |
|------|---------|
| URL / Nest / DB / permissions | Compatibility Absences — без масового rename в MVP |
| Доменна мова (новий код) | **TimeEvent** / `TimeEventRequest` / `TimeEventType` |
| Категорії | `absence` \| `work` (не `presence`) |
| Lifecycle | Існуючий pending → approve/reject (+ adjust / deletion / attachments) |
| Organization schedule | **Не** змінюється work-подіями автоматично |
| Повний rename модуля | Окремий ADR пізніше (етап 8) |

Деталі рішень: [ADR 0008](../adr/0008-work-calendar-via-absences.md).

## Типи (MVP)

| Type | Category | dateMode | timeMode | schedulePolicy | notes |
|------|----------|----------|----------|----------------|-------|
| `day_off` | absence | date_range | none | any | `isUnpaid` = **legacy** flag |
| `vacation` | absence | date_range | none | any | `isUnpaid` = **legacy** flag |
| `sick_leave` | absence | date_range | none | any | unpaid N/A |
| `part_time` | absence | single_day | required | scheduled_work_day | |
| `overtime` | work | single_day | required | any | `durationMinutes` у response DTO |
| `business_trip` | work | date_range | **none** | any | час виїзду/повернення — пізніше |
| `extra_work_day` | work | single_day | optional | **scheduled_day_off** (strict) | сценарій «зйомка у вихідний» |

Без восьмого типу `unpaid_leave` у MVP. `isUnpaid` не є повною кадровою класифікацією виду відпустки.

## Архітектура правил

- **TypeCatalog** (API domain only): структура дат/часу, category, поля, schedule policy, visualKind.
- **WorkflowPolicy** (окремо): ролі, backdating, create-for-other, approval, adjust-after-approve.
- **Contracts**: лише shapes metadata; FE будує форму з `GET /absences/metadata`.
- Overlap: blocking `pending`+`approved`; `excludeRequestId` на update/adjust; check **всередині** transaction.
- Timezone MVP: Europe/Kyiv (надалі — Organization settings).

## Фази

| Phase | Scope | Status |
|-------|--------|--------|
| 0. Docs + ADR | Intent | **Done** |
| 1. Domain core | Catalog, validator, schedule/overlap/workflow | **Done** |
| 2. Contracts + metadata | Rich metadata from catalog | **Done** |
| 3. Backend use cases | Shared validation in create/update/adjust | **Done** |
| 4. Calendar | visualKind, legend | **Done** |
| 5. Angular UI | Rename, groups, metadata-driven form | **Done** |
| 6. Documents / audit / notify | Atomic neutral projection | **Done** |
| 7. Tests | Unit + integration + acceptance | **Done** (unit; sequential overlap via overlap policy) |
| 8. Technical rename | Separate ADR | Deferred |

## Non-goals (MVP)

- Payroll / auto-mutate weekly schedule / `unpaid_leave` type.
- Trip departure/return times; midnight-spanning overtime.
- DB exclusion constraints; dual `source` in one Documents field.
- Nest module / URL rename; edits to `ProjectWeekend/**`.
