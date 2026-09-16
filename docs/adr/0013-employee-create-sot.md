# ADR 0013: Employee create SoT (People UI + POST /employees)

## Context

Absences мав повну сторінку створення працівника; People — мінімальну inline-форму. Create був admin-gated у service (`access.isAdmin`) навіть при HTTP `EmployeesCreate`, allocation номера робився поза TX через admin-only preview, контакти писались лише в legacy columns без `employee_contacts`, а visibility overrides приймались на create і обходили `updateAccessSettings`.

## Decision

1. **UI SoT:** `/people/new` only. Absences `/absences/employees/new` → redirect `/people/new`; CTA «Додати працівника» → `/people/new`.
2. **UI entry predicate (Model A):** один `canOpenEmployeeCreate = EmployeesCreate ∧ EmployeesView` для People CTA, Absences CTA, route guard. API `POST /employees` лишається **EmployeesCreate-only** (Create∧¬View → `201 { openDetail:false }`).
3. **API SoT:** `POST /api/v1/employees` → `EmployeesService.create`. HTTP `@RequirePermissions(EmployeesCreate)` + service `AuthorizationContext` + `hasPermission(EmployeesCreate)` (defense-in-depth). Не `access.isAdmin`.
4. **Field-level:** personal* → `EmployeesWritePersonal` (або adminEquivalent); `createAccount=true` → `employees.create_account_at_create` (або adminEquivalent) — **workflow-gate лише для атомарного User на `POST /employees`**, не attach; non-empty `employeeNumber` → adminEquivalent (**403** if supplied without). Explicit `accountRoleId` → `employees.assign_account_role` + admin-equivalent ceiling (**403** if supplied without Assign — fail-closed). Omitted `accountRoleId` → leadership seed when creating account (from **locked Position** EA membership). Visibility overrides **видалені** з create DTO — inherit only; writer = `PATCH …/access-settings`.
5. **Contract:** `CreateEmployeeRequest` = повний HTTP body; exact key AssertNever DTO↔Request (і nested ScheduleDay). **Немає authoritative `managementKind` на create wire** — EA membership = Position `managementKindTemplate` only (assignment write DTOs лишають `managementKind`). Response `CreateEmployeeResponse = { id, openDetail }` зі статусом **201**.
6. **Atomic TX:** resolve+lock org hierarchy → ManagerMembershipState з locked Position (**без client override**) → prefix → advisory allocate → Employee + EA + managed + `EmployeeContactsFacade.initializeForCreate` + optional User + schedule + audit. Before User INSERT: fresh `authorization.resolve(actor.id, manager)` + `canCreateAccountAtEmployeeCreate`.
7. **Contacts:** create не пише contacts лише в Employee columns; canonical rows/mirrors через `initializeForCreate` (create-specific audit, не `contacts_updated`).
8. **openDetail:** pure `EmployeesView ∧ (scope=all ∨ dept ∈ managed)` з pre-resolved authz/actor context; без post-commit visibility DB read / `findOne`. **Create is global** — `EmployeeScope` does not constrain `POST /employees`; `openDetail` may be false.
9. **Password:** never default `TempPass123!`; FE generate via `crypto.getRandomValues`. Draft `createAccount` defaults **false**; checkbox visible only with `create_account_at_create` (або adminEq).
10. **Direction + AccountRole at create (extension):** `directionId?` seeds org resolver / EA. `accountRoleId?` requires Assign (+ ceiling); without Assign, **supplied** id → 403. With Assign, without `createAccount` it is numbering + audit intent only. With `createAccount` + omitted role → `defaultSystemAccountRoleCodeFromLeadership` from Position-derived membership. Shared SoT: `@loom/contracts-access-control`.
10a. **Employee number prefix (single entry):** `employeeNumberPrefixForCreate` — AccountRole intent (A/M/E) else EA `managementKind` (M/E). UI «Роль» visible when `assign_account_role` ∨ adminEquivalent (assignable catalog) — **незалежно** від AtCreate checkbox.
11. **Create TX AccountRole protocol:** when creating account — `AccountRole` `pessimistic_read` → User INSERT (`userRoleMirrorFor`) → `Employee.userId` SAVE → `IdentityRoleProjection.apply(..., { bumpTokenVersion: false })` → audit. Serializes with `AccountRolesService.update` writers.
12. **Audit AccountRole-at-create (security mutation):** same TX as create; metadata includes `createAccount`, `accountCreationAuthorization` (`admin_equivalent` | `employees.create_account_at_create` | null), `requestedAccountRoleId`, `effectiveAccountRoleId`, `bridgeApplied` (false for explicit), `accountRoleSource`, `canAssignAccountRole`.
13. **Roles HTTP gate:** FE loads `GET /settings/account-roles/assignable` **only if** Assign ∨ adminEquivalent via single client entry `AccountRolesApiService.getAssignableRoles()`. Wire SoT = `AssignableAccountRoleOption` in `@loom/contracts-access-control` (`id`, `code`, `name`, `isAdminEquivalent` — **no** `isSystem` / surfaces / extras). Full Settings `list()` remains adminEq-only (`AccountRoleView` includes `isSystem`). Omitted role UI: leadership seed hint.
14. **Invariant:** `create_account_at_create=false` ≠ «не може створювати акаунти взагалі» — лише заборона атомарного User на create. Attach лишається `adminEq` OR (`employees.create` ∧ managed-dept).

### Rollout notes (breaking for delegated creators)

Нова пермісія **не** auto-seed на існуючі ролі з `employees.create`. Перед релізом:

```sql
SELECT
  ar.id,
  ar.name,
  ar.code
FROM account_roles ar
JOIN account_role_permissions create_perm
  ON create_perm.account_role_id = ar.id
 AND create_perm.permission = 'employees.create'
LEFT JOIN account_role_permissions at_create_perm
  ON at_create_perm.account_role_id = ar.id
 AND at_create_perm.permission = 'employees.create_account_at_create'
WHERE ar.is_admin_equivalent = FALSE
  AND at_create_perm.id IS NULL
ORDER BY ar.name;
```

## Consequences

- Delegated `EmployeesCreate` creators можуть створювати працівників з auto-number без admin.
- `createAccount=true` потребує окремого Settings-тогла (або adminEq).
- People profile / completeness одразу бачать contacts після create.
- Prefix E/M узгоджений з EA membership з одного Position snapshot (без client forge).
- Absences create page removed; shared schedule editor under `apps/web/src/app/shared/schedule`.
- Admin who creates a second admin-equivalent account is auditable via `employee.created` role metadata.
- FE/BE share `@loom/contracts-access-control` for AccountRole numbering + omitted-role leadership **default** (not rewrite).

## Non-goals (v1)

- Photo, emergency, skills, planned EA, comments, overrides UI, completeness UI on create.
- Changing catalog endpoint authZ to Create-only (UI requires View).

## Status

Accepted.
