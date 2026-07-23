# ADR 0004: Permissions and domain scope

## Context

ProjectWeekend largely checks three roles (`admin`, `department_manager`, `employee`). CRM needs finer capabilities and data scoping.

## Decision

Separate:

1. **Permission** — what action is allowed (`employees.edit`, …), returned on login/session.
2. **Scope** — which rows (`self` | `managed_departments` | `all`), enforced by domain access services.

Roles map to permission sets via an adapter. Frontend uses permissions for UX only; backend remains authoritative.

## Consequences

- Stable permission strings become API contracts.
- Avoids exploding permission names with embedded scope.

## Rejected alternatives

- Role-only checks forever.
- Hundreds of permissions like `employees.edit.department`.
