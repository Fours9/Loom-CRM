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
| `absences.admin` | ні | ні | ні | так |
| `nav.statistics` | seed | seed | seed | так |
| `nav.settings` | ні | ні | ні | так |
| `route.positions` | ні | ні | так | так |
| `people.tab.data` | так | так | так | так |
| `people.tab.work` | так | так | так | так |
| `people.tab.documents` | seed | seed | seed | так |
| `people.tab.questionnaires` | seed | seed | seed | так |
| `people.tab.about` | так | ні | ні | так |
| `people.tab.metrics` | ні | так | так | так |
| `people.tab.administration` | ні | ні | ні | так |
| `people.tab.later` | reserved | reserved | reserved | reserved |
| `settings.access_roles` | ні | ні | ні | так |

## Permission-backed surfaces

| surface id | required permission |
|------------|---------------------|
| `people.tab.documents` | `documents.view` |
| `people.tab.questionnaires` | `questionnaires.view` |
| `nav.questionnaires` | `questionnaires.view` |
| `absences.admin` | `absences.admin` |
| `settings.access_roles` | (API: adminEquivalent; surface = UI only) |

**AbsencesAdmin atomic pair:** Settings checkbox «Адміністрування робочого календаря» grants/revokes **both** `Permission.AbsencesAdmin` and surface `absences.admin` in one AccountRoles TX. Backend fail-closed `ABSENCES_ADMIN_PAIR_MISMATCH` on create / update / `PUT …/surfaces` if they diverge. Generic surfaces checklist entry is derived/disabled. `surfaces: []` on `/auth/me` is a valid modern role (zero surfaces) — **not** pre-rollout; FE `surfacesReady` = `surfaces !== undefined`, route guard fail-closed.

**Absences approve:** Settings checkbox «Затверджувати заявки» → extra `absences.approve` (DM+admin presets already include it). Row caps via AuthZ + managed submission dept (null snapshot → current EA dept). Create-for-other: `metadata.capabilities.canCreateForOther` (`AbsencesCreate` ∧ managed scope \| adminEq) — FE must not proxy via Approve.

**Privacy admin page:** gated by `absences.admin` surface∧permission; fake privacy persistence removed (unavailable UI until real API).

**Employee profile Class C (Settings):** `employees.read_team_comment` (view team comment; **no** target-scope) and `employees.export_profile` (PDF ∧ `canViewEmployeeProfile`). Seeded as extras on non-adminEq `department_manager`-preset roles (director/DM). Never remap to ManageProfiles alone.

**Destructive account ops** (reset password, deactivate/delete account, delete employee, edit login email) = **adminEq only** («Повний доступ») — ADR 0011 §4; no separate Settings toggles. AuthZ SoT = `AuthorizationContext`, never `users.role`.

**Field toggles** (`read/write.personal`, emergency, `change_assignment`, `change_status`, `view_history`): Settings checkboxes; write/assignment/status require ManageProfiles at runtime (and Settings UX disables dependents until ManageProfiles). History keeps OR-branch: `ViewHistory ∨ (canView ∧ ManageProfiles)`.

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
| `employees.create_account_at_create` | **Global** (with Create) | Allows `createAccount=true` on `POST /employees` only (workflow-gate). **≠** attach. Admin preset; Settings toggle. OFF does not ban later attach (`employees.create` ∧ managed-dept \| adminEq). |
| `employees.manage_profiles` | Managed-dept | Canonical basic/contacts/schedule (+ specialized pairings). Not in DM base preset (extra). Required for write.personal / write.emergency / change_assignment / change_status. |
| `employees.assign_account_role` | Managed-dept | Assign AccountRole; `GET …/account-roles/assignable` → `AssignableAccountRoleOption` (`id`, `code`, `name`, `isAdminEquivalent`). Admin-equivalent ceiling (not full permission-subset). Independent of create-account-at-create. |
| `employees.read_team_comment` | Global (no target-scope) | View team profile comment. Class C; seeded on DM-preset. |
| `employees.export_profile` | + canView target | Profile PDF export. Class C; seeded on DM-preset. |
| `employees.read.personal` / `write.personal` | Read global / write+ManageProfiles+managed | Personal contacts. |
| `employees.read.emergency_contact` / `write.emergency_contact` | Read global / write+ManageProfiles+managed (owner write preserved) | Emergency contact. |
| `employees.change_assignment` / `change_status` | ManageProfiles+managed | Org assignment / employment status. |
| `employees.view_history` | OR ManageProfiles∧canView | Profile history. |
| `employees.edit` | — | Deprecated; cannot be newly granted. |

Settings role dialog: effective / `grants*Explicitly` / `canEdit*Grant` triad (confidential pattern). Single entry for capability math: Organization `employee-profile-authz` pure helpers.

## Questionnaire template grants + Assign / Manage

| Gate | Meaning |
|------|---------|
| `account_role_questionnaire_templates` | Opaque template codes per AccountRole. AdminEq bypasses (no rows required). |
| `questionnaires.assign` | Create / attach new / templates picker (within granted codes). **Not** in DM base preset (Variant A) — seeded as extra for DM-preset roles. |
| Manage bundle | `questionnaires.manage_lifecycle` ∧ `questionnaires.delete` ∧ `questionnaires.apply_profile_changes` together. Settings one checkbox; API rejects incomplete triple (`QUESTIONNAIRE_MANAGE_BUNDLE_PARTIAL`). |
| Capability SoT | `AuthorizationContext` only — not `users.role` / `PermissionService.has(role)`. |

Unattached `new` READ: Assign ∨ Lifecycle ∨ Delete ∧ template grant (never View alone). Proposal LIST: View∨owner + template grant. Proposal REJECT: Manage bundle ∧ scope ∧ template grant. Proposal ACCEPT: same as REJECT **plus** exhaustive fail-closed target-profile write policy (`classifyProposalProfileWrite` → Organization `canManageProfilesOnTarget` / `canWritePersonalOnTarget` / `canEditEmergencyOnTarget`; unknown `section.field` DENY). Notifications with assignment metadata require recipient template grant.

Migration seed: built-in literals (`employee-starter`/`360`/`managing`/`docs`) by elevatedBefore parity; upgrade adds published `type=full` (plain) or all published (elevated). `employee-named` grant migration copies to roles that already hold `employee-starter` or `employee-360`. See [ADR 0009 §16](../adr/0009-questionnaire-360-mvp.md).

## Assign flow

People RoleAccess → `PATCH …/access-settings` `{ accountRoleId?, overrides? }` → Assign+scope+ceiling for role; visibility overrides **adminEquivalent only** (delegated body with overrides → 403). `{ requestedAccountRole, effectiveAccountRole }` (equal — no leadership rewrite). Org leadership remains separate scope.

## Positions

- `GET /positions` — catalog (без manage scope).
- `GET /positions/manage` + mutations — `positions.manage` + `PositionManagementScopePolicy`.
