# ADR 0013: Employee create SoT (People UI + POST /employees)

## Context

Absences мав повну сторінку створення працівника; People — мінімальну inline-форму. Create був admin-gated у service (`access.isAdmin`) навіть при HTTP `EmployeesCreate`, allocation номера робився поза TX через admin-only preview, контакти писались лише в legacy columns без `employee_contacts`, а visibility overrides приймались на create і обходили `updateAccessSettings`.

## Decision

1. **UI SoT:** `/people/new` only. Absences `/absences/employees/new` → redirect `/people/new`; CTA «Додати працівника» → `/people/new`.
2. **UI entry predicate (Model A):** один `canOpenEmployeeCreate = EmployeesCreate ∧ EmployeesView` для People CTA, Absences CTA, route guard. API `POST /employees` лишається **EmployeesCreate-only** (Create∧¬View → `201 { openDetail:false }`).
3. **API SoT:** `POST /api/v1/employees` → `EmployeesService.create`. HTTP `@RequirePermissions(EmployeesCreate)` + service `AuthorizationContext` + `hasPermission(EmployeesCreate)` (defense-in-depth). Не `access.isAdmin`.
4. **Field-level:** personal* → `EmployeesWritePersonal` (або adminEquivalent); `createAccount` / non-empty `employeeNumber` → adminEquivalent. Visibility overrides **видалені** з create DTO — inherit only; writer = `PATCH …/access-settings`.
5. **Contract:** `CreateEmployeeRequest` = повний HTTP body; exact key AssertNever DTO↔Request (і nested ScheduleDay). Response `CreateEmployeeResponse = { id, openDetail }` зі статусом **201**.
6. **Atomic TX:** resolve+lock org hierarchy → ManagerMembershipState з locked Position → prefix → advisory allocate → Employee + EA + managed + `EmployeeContactsFacade.initializeForCreate` + optional User + schedule + audit.
7. **Contacts:** create не пише contacts лише в Employee columns; canonical rows/mirrors через `initializeForCreate` (create-specific audit, не `contacts_updated`).
8. **openDetail:** pure `EmployeesView ∧ (scope=all ∨ dept ∈ managed)` з pre-resolved authz/actor context; без post-commit visibility DB read / `findOne`.
9. **Password:** never default `TempPass123!`; FE generate via `crypto.getRandomValues`. Draft `createAccount` capability-aware.
10. **Direction + AccountRole at create (extension):** `directionId?` seeds org resolver / EA. `accountRoleId?` allowed for **adminEquivalent** with or without `createAccount`: without account it is **numbering + audit intent only** (no User, no `users.account_role_id` — AccountRole SoT remains Platform/User per ADR 0011). With `createAccount` it assigns User as before. Direction does **not** assign AccountRole; AccountRole does **not** write `managementKind`/EA. **No leadership rewrite** of explicit AccountRole. Shared SoT: `@loom/contracts-access-control` (`resolveAccountRoleBridge` identity, `defaultSystemAccountRoleCodeFromLeadership` when role omitted, `resolveEmployeeNumberPrefixFromAccountRole`). Catalog wire: `Position.managementKindTemplate`; FE seeds silent `managementKind` from Position (EA), editable only via position cascade.
10a. **Employee number prefix (single entry):** `employeeNumberPrefixForCreate` — AccountRole intent (A/M/E) else EA `managementKind` (M/E). UI «Роль» = AccountRole catalog (Працівник / Менеджер / Директор / Адміністратор / custom), visible whenever `canCreateAccount`, independent of create-account checkbox.
11. **Create TX AccountRole protocol:** when creating account — `AccountRole` `pessimistic_read` → User INSERT (`userRoleMirrorFor`) → `Employee.userId` SAVE → `IdentityRoleProjection.apply(..., { bumpTokenVersion: false })` → audit. Serializes with `AccountRolesService.update` writers.
12. **Audit AccountRole-at-create (security mutation):** same TX as create; metadata always includes `createAccount`, `requestedAccountRoleId`, `effectiveAccountRoleId` (= assigned AccountRole when account created, else `null`), `bridgeApplied` (always `false` for explicit role — no leadership rewrite). Rollback create = rollback audit.
13. **Roles HTTP gate:** FE loads `GET /settings/account-roles` **only if** `canCreateAccount` (adminEquivalent); otherwise no request. Omitted role UI label: «Автоматично за посадою → Працівник|Менеджер».

## Consequences

- Delegated `EmployeesCreate` creators можуть створювати працівників з auto-number без admin.
- People profile / completeness одразу бачать contacts після create.
- Prefix E/M узгоджений з EA membership з одного Position snapshot.
- Absences create page removed; shared schedule editor under `apps/web/src/app/shared/schedule`.
- Admin who creates a second admin-equivalent account is auditable via `employee.created` role metadata.
- FE/BE share `@loom/contracts-access-control` for AccountRole numbering + omitted-role leadership **default** (not rewrite).

## Non-goals (v1)

- Photo, emergency, skills, planned EA, comments, overrides UI, completeness UI on create.
- Changing catalog endpoint authZ to Create-only (UI requires View).

## Status

Accepted.
