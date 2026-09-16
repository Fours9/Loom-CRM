# ADR 0011: Org leadership vs account role

## Context

Visibility (кого бачиш) і account access (permissions + UI surfaces) довго змішувались через `User.role` і прапорці менеджера на Employee/User. Variant 2 Access уже переніс manager membership на active EA, але ще не розділив організаційне керівництво і роль акаунту, не ввів surfaces і не зробив Platform AccessControl канонічним authZ SoT.

## Decision

1. **Посада ≠ роль акаунту.** Org leadership = `managementKind` на Position template / active EA (`none` | `departments` | `direction`). Account access = `account_roles` + `users.account_role_id` + surfaces. Assignment create/update HTTP body accepts `managementKind` (+ optional `managedDepartmentIds`); wire DTO SoT = `CreateEmploymentAssignmentRequest` / `UpdateEmploymentAssignmentRequest` (`employment-assignment.write.dto.ts`, AssertNever).
2. **Platform AccessControl** володіє `account_roles`, `app_surfaces`, joins і `AuthorizationContextService`. Organization читає `isAdminEquivalent` / permissions через context; Platform ↛ Organization.
3. **`AuthorizationContextService.resolve`** — єдиний authZ SoT для Jwt/`/me`, PermissionsGuard, PermissionService, Access, Positions manage, Settings roles API. `users.role` — compatibility mirror only.
4. **Немає окремого `adminAccess` toggle.** Full admin = system role `admin` або custom з `is_admin_equivalent=true`.
5. **Три шари:** Permission (API authority), Surface (UI exposure), Scope (entities). Для permission-backed UI: `hasSurface AND hasPermission`. Surface ніколи не дозволяє backend mutation.
6. **AccountRole ≠ org leadership.** `managementKind` on Position/EA is scope only. AccountRole (permissions / surfaces / confidential) is chosen independently. Explicit AccountRole is **never** rewritten from leadership. When AccountRole is **omitted** at create/attach, system may **seed** default `employee` or `department_manager` from leadership as an initial choice only (`defaultSystemAccountRoleCodeFromLeadership`). Director / admin / custom are never auto-seeded from leadership. Assign + audit keep `requested` / `effective` / `bridgeApplied` (identity: `bridgeApplied` always false when role was explicit).
7. **Every User INSERT** вимагає `accountRoleId`. Migration: NULL → backfill → assert → NOT NULL.
8. **Account-role definition CRUD** — лише `isAdminEquivalent` actor. **LAST_ADMIN:** ніколи 0 active adminEquivalent Users.
9. **Positions:** `GET /positions` = catalog; `GET /positions/manage` + mutations = scoped management.
10. **Employee profile gates (extras):** `employees.create` (global create), `employees.create_account_at_create` (workflow-gate: `createAccount=true` on `POST /employees` only — **≠** attach; admin preset only), `employees.manage_profiles` (canonical profile edits + managed-dept scope; **not** in DM base preset — extra-controlled), `employees.assign_account_role` (assign + admin-equivalent ceiling: no self, no touch/create adminEq targets). Assignable picker wire = `AssignableAccountRoleOption` (`@loom/contracts-access-control`); Settings definition view keeps `isSystem`. Settings toggles use effective/explicit like `confidential.view`. `employees.edit` deprecated — migration collapses to manage_profiles; Settings rejects new edit grants. Legacy `PATCH /employees/:id` = adminEquivalent-only compatibility. Owner emergency self-edit preserved without ManageProfiles. **Create EA leadership** comes from locked Position template only — `CreateEmployeeRequest` does not accept authoritative `managementKind` (avoids forging DM AccountRole via leadership seed without Assign). Assignment write bodies still accept `managementKind`.

### UX labels

| Шар | Значення | UA |
|-----|----------|-----|
| Leadership | `none` / `departments` / `direction` | Не керує / Керує відділами / Керує напрямком |
| Account role | `employee` / `department_manager` / `director` / `admin` | Працівник / Менеджер / Директор / Адміністратор |

## Consequences

- Settings «Доступи» — management UI Platform capability.
- Role definition change bump `token_version` для всіх Users ролі.
- System role preset + `isAdminEquivalent` immutable; extras/surfaces editable.

## Non-goals

- Physical DROP `users.role` / legacy manager columns.
- `users.admin_access_override`.
- Delegated `access_roles.manage` + grant-ceiling.
- `ProjectWeekend/**` edits.

## Rejected alternatives

- Auto-assign director from `managementKind=direction`.
- `settings.manage` alone for role-definition CRUD (privilege escalation).
- Scoped filter on catalog `GET /positions`.
