# Access surfaces (living)

Каталог UI surface ids і матриця system account roles. Статус реалізації має збігатися з кодом.

Див. також [ADR 0011](../adr/0011-org-leadership-vs-account-role.md).

## Шари

| Layer | Питання |
|-------|---------|
| Permission | Чи можу виконати операцію? (backend) |
| Surface | Чи показувати цю частину UI? |
| Scope | Над якими сутностями? (Access / Positions manage) |

Permission-backed surface: `visible = hasSurface AND hasPermission`. `isAdminEquivalent` bypass обох.

## System account roles

| code | preset | isAdminEquivalent | UA |
|------|--------|-------------------|-----|
| `employee` | employee | false | Працівник |
| `department_manager` | department_manager | false | Менеджер |
| `director` | department_manager + `positions.manage` | false | Директор |
| `admin` | admin | true | Адміністратор |

## Surface matrix (seed)

| surface id | employee | department_manager | director | admin |
|------------|----------|--------------------|----------|-------|
| `nav.home` | так | так | так | так |
| `nav.people` | так | так | так | так |
| `nav.positions` | ні | ні | так | так |
| `nav.questionnaires` | seed | seed | seed | так |
| `nav.absences` | так | так | так | так |
| `nav.statistics` | seed | seed | seed | так |
| `nav.settings` | ні | ні | ні | так |
| `route.positions` | ні | ні | так | так |
| `people.tab.data` | так | так | так | так |
| `people.tab.work` | так | так | так | так |
| `people.tab.documents` | seed | seed | seed | так |
| `people.tab.questionnaires` | seed | seed | seed | так |
| `people.tab.metrics` | ні | так | так | так |
| `people.tab.administration` | ні | ні | ні | так |
| `people.tab.later` | так | так | так | так |
| `settings.access_roles` | ні | ні | ні | так |

## Permission-backed surfaces

| surface id | required permission |
|------------|---------------------|
| `people.tab.documents` | `documents.view` |
| `people.tab.questionnaires` | `questionnaires.view` |
| `nav.questionnaires` | `questionnaires.view` |
| `settings.access_roles` | (API: adminEquivalent; surface = UI only) |

## Classification (ADR 0012)

| Permission | Meaning |
|------------|---------|
| `confidential.view` | Cross-domain: view/mark confidential resources; ≠ `documents.view` / `documents.manage` |

- Grant/revoke via Settings role extras — **pre-mutation adminEquivalent** only.
- Documents: `employee_documents.is_confidential` + type policy (managed-scope manager semantics). See [ADR 0012](../adr/0012-confidential-classification.md).

## Employee profile permission toggles

| Permission | Scope | Meaning |
|------------|-------|---------|
| `employees.create` | **Global** | `POST /employees`; FE CTA with `employees.view`. Does not constrain by managed departments. |
| `employees.manage_profiles` | Managed-dept | Canonical basic/contacts/schedule (+ specialized pairings). Not in DM base preset (extra). |
| `employees.assign_account_role` | Managed-dept | Assign AccountRole; `GET …/account-roles/assignable` → `AssignableAccountRoleOption` (`id`, `code`, `name`, `isAdminEquivalent`). Admin-equivalent ceiling (not full permission-subset). |
| `employees.edit` | — | Deprecated; cannot be newly granted. |

Settings role dialog: effective / `grants*Explicitly` / `canEdit*Grant` triad (confidential pattern).

## Assign flow

People RoleAccess → `PATCH …/access-settings` `{ accountRoleId?, overrides? }` → Assign+scope+ceiling for role; visibility overrides **adminEquivalent only** (delegated body with overrides → 403). `{ requestedAccountRole, effectiveAccountRole }` (equal — no leadership rewrite). Org leadership remains separate scope.

## Positions

- `GET /positions` — catalog (без manage scope).
- `GET /positions/manage` + mutations — `positions.manage` + `PositionManagementScopePolicy`.
