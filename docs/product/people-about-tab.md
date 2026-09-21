# People «Про себе» (living)

Вкладка профілю для **мʼякого / добровільного** контексту про працівника (хобі, сімʼя, стиль роботи).  
**Не** кадрова SoT «Дані працівника» і **не** операційна «Робота».

## SoT

| Шар | Роль |
|-----|------|
| `employee_about` (Organization) | **Current Profile Core** truth (`answers` jsonb) |
| Questionnaire `snapshot_json` | Immutable history / audit only |
| `@loom/employee-about-catalog` | Neutral field registry (labels, options, `visibleWhen`, validation) |

HTTP: `GET/PATCH /api/v1/employees/:id/about` — DTOs у `@loom/contracts-employees`.

Visibility: surface `people.tab.about` (Settings «Доступи»). Seed: `employee` + adminEq; DM/director — opt-in.  
Read = `EmployeesView` ∧ surface. Write = pure `canEditEmployeeAbout` (owner+surface **або** ManageProfiles+managed+surface).

## Sync (questionnaire submit)

Present-only: keys **PRESENT** in snapshot overwrite About. Absent ≠ clear.  
Conditional invalidation via `canonicalizeAboutMutation` (e.g. `has_children=no` → clear `family.children`).  
Clear also via PATCH `null`. Provenance (`last_source_submission_id`, `last_synced_at`) updates only on questionnaire sync.

Atomic write: `EmployeeAboutFacade.mergeAnswers({ set, clearKeys, source })`.

## Hard-delete

`employee_about.employee_id` → `ON DELETE RESTRICT`. Erasure: `OrganizationEmployeeErasureFacade` deletes the row before employee DELETE. No CASCADE.

## Код

- catalog: [`libs/employee-about-catalog`](../../libs/employee-about-catalog)
- entity/facade/service: `apps/api/src/organization/employees/employee-about.*`
- ADR: [0014-employee-about](../adr/0014-employee-about.md)
- FE adapter: [`people-about-subtabs.ts`](../../apps/web/src/app/features/people/people-about-subtabs.ts) → `ABOUT_SUBTAB_DEFS`
- panel: [`employee-about-panel.component.ts`](../../apps/web/src/app/features/people/employee-about-panel.component.ts)

## Підвкладки

| id | Label | Keys (catalog) |
|----|-------|----------------|
| `family_home` | Сімʼя і дім | `family.*` |
| `celebrations` | Свята і подарунки | celebration + gift keys |
| `hobbies` | Хобі та інтереси | hobbies (без gift) |
| `strengths` | Сильні сторони | strengths (без in_* years) |
| `work_style` | Стиль роботи | `work_style.*` |
| `life_goals` | Цілі | `strengths.in_*` + `career_goals.plan` |

**Свідомо поза «Про себе»:** personal/contacts mirrors, experience/education, probation_goals, skills matrix, consents/docs.

Backfill: lazy — лише нові submits + ручний PATCH (історичні snapshots не копіюються міграцією).
