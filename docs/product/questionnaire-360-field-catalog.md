# Questionnaire 360° — field catalog (policy SoT)

**Status:** product/policy source of truth (PR-0).  
**Not runtime:** API/FE read published `questionnaire_template_versions.schema_json` only.  
**Not seed:** checked-in typed seed appears in PR-2 (manually synced from this catalog).  
**Reference HTML:** [references/anketa_360.html](./references/anketa_360.html) — human prototype only.  
**Vision mapping:** [employee-profile-core.md](./employee-profile-core.md) §44.  
**ADR:** [0009-questionnaire-360-mvp.md](../adr/0009-questionnaire-360-mvp.md).

---

## Pseudo-contract (documentation only)

Real TypeScript API types ship in `libs/contracts-questionnaires` (PR-1). This block is the documentation shape for catalog rows.

```ts
type QuestionnaireActorClass =
  | 'employee_owner'
  | 'manager_in_scope'
  | 'admin';

type Questionnaire360ValueType =
  | 'text'
  | 'textarea'
  | 'date'
  | 'number'
  | 'boolean'
  | 'single_choice'
  | 'multi_choice'
  | 'employee_reference'
  | 'catalog_reference'
  | 'repeating_group';

type Questionnaire360FieldDefinition = {
  key: string;
  sectionKey: string;
  sectionLabel: string;
  order: number;
  label: string;
  helpText?: string;
  valueType: Questionnaire360ValueType;
  options?: Array<{ value: string; label: string }>;
  validation?: Record<string, unknown>;
  children?: Questionnaire360FieldDefinition[]; // repeating_group columns
  requiredPolicy:
    | 'required_for_create'
    | 'required_before_activation'
    | 'recommended'
    | 'voluntary';
  filledBy: QuestionnaireActorClass[];
  visibility: QuestionnaireActorClass[];
  sensitivity: 'normal' | 'personal' | 'confidential' | 'restricted';
  destination:
    | 'employee_profile'
    | 'employment_assignment'
    | 'questionnaire_snapshot'
    | 'career_profile'
    | 'skills'
    | 'education'
    | 'goals'
    | 'reviews'
    | 'onboarding'
    | 'documents'
    | 'consents'
    | 'safety'
    | 'process';
  mvpStatus: 'in_mvp' | 'excluded' | 'later_module';
  createsProfileProposal?: boolean;
  proposalMapping?: { section: string; field: string };
  profileField?: string;
  notes?: string;
};
```

**Rules**

- Choice `options[].value` is stable English/snake; never store UA label as value.
- Runtime roles today: `employee` | `department_manager` | `admin`. Labels may say «HR / Admin»; catalog uses `admin` / actor classes only — no `hr` enum.
- Assignment fill: only active User linked to target Employee. Admin/Manager do not answer on behalf. No account → reject assign.
- Submissions store `submitted_by_user_id`. Proposals reference `submission_id`.

### Permission / scope / capability (domain actions)

| Layer | Meaning |
|-------|---------|
| permission | actor may use Questionnaires domain at all |
| employee scope | actor may see/act on this Employee |
| capability | action allowed on this profile/assignment |

Domain actions (permission strings in PR-1): view own assignment · fill own assignment · view employee questionnaires · assign questionnaire · review submission · request changes · review/apply profile proposal.

---

## Section matrix (19 HTML blocks)

| # | sectionKey | sectionLabel | destination (primary) | mvpStatus |
|---|------------|--------------|----------------------|-----------|
| 1 | `personal` | Особисті дані | employee_profile | in_mvp (mirror + proposals) |
| 1b | `contacts` | Контакти | employee_profile | in_mvp (split from personal; mirror + proposals) |
| 2 | `family` | Сімейний стан | questionnaire_snapshot | in_mvp (voluntary; stay in snapshot) |
| 2b | `celebration_dates` | Святкові дати | questionnaire_snapshot | in_mvp (split from family; gifts + ДН) |
| 3 | `emergency` | Контакт на екстрений випадок | employee_profile | excluded from fill MVP (already Profile Core) |
| 4 | `company_work` | Робота в компанії | questionnaire_snapshot | in_mvp (fill snapshot; Profile Core assignment remains SoT for org fields later) |
| 5 | `grade` | Грейд і рівень посади | later compensation | later_module |
| 6 | `experience` | Професійний досвід | questionnaire_snapshot | in_mvp |
| 7 | `skills` | Матриця навичок | skills | later_module |
| 8 | `education` | Освіта та навчання | questionnaire_snapshot | in_mvp |
| 9 | `strengths` | Сильні сторони та потенціал | questionnaire_snapshot | in_mvp |
| 10 | `hobbies` | Хобі, інтереси та корпоративне життя | questionnaire_snapshot | in_mvp |
| 11 | `work_style` | Стиль роботи та комунікація | questionnaire_snapshot | in_mvp |
| 12 | `safety` | Безпека праці | safety | later_module |
| 13 | `career_goals` | Кар'єрні цілі | goals | later_module |
| 14 | `probation_goals` | Цілі випробувального | goals | later_module |
| 15 | `manager_review` | Оцінка керівника | reviews | later_module |
| 16 | `onboarding` | Онбординг | onboarding | later_module |
| 17 | `hr_documents` | Кадрові документи | documents | later_module |
| 18 | `consents` | Згода та підписи | consents + questionnaire_snapshot | in_mvp (answers in snapshot; legal consents later module) |
| 19 | `crm_control` | Контроль внесення в CRM | process | excluded (computed/process) |

**MVP wizard steps (seed):**  
1 profile_mirror · 2 contacts · 3 family · 4 celebration_dates · 5 experience · 6 company_work · 7 education · 8 strengths · 9 hobbies · 10 work_style · 11 consents_review.

---

## Fields — block 1 `personal` (mirror / proposals)

| key | order | label | valueType | requiredPolicy | filledBy | visibility | sensitivity | destination | mvpStatus | createsProfileProposal | proposalMapping / profileField | notes |
|-----|-------|-------|-----------|----------------|----------|------------|-------------|-------------|-----------|------------------------|--------------------------------|-------|
| personal.last_name | 10 | Прізвище | text | recommended | employee_owner | employee_owner, manager_in_scope, admin | personal | employee_profile | in_mvp | true | overview.lastName | read-only mirror in wizard |
| personal.first_name | 20 | Ім'я | text | recommended | employee_owner | employee_owner, manager_in_scope, admin | personal | employee_profile | in_mvp | true | overview.firstName | |
| personal.middle_name | 30 | По батькові | text | voluntary | employee_owner | employee_owner, manager_in_scope, admin | personal | employee_profile | in_mvp | true | overview.middleName | |
| personal.preferred_name | 35 | Ім'я для звернення | text | voluntary | employee_owner | employee_owner, manager_in_scope, admin | normal | employee_profile | in_mvp | true | header.preferredName | under ПІБ row (`uiGroup` identity_preferred) |
| personal.birth_date | 40 | Дата народження | date | recommended | employee_owner | employee_owner, admin | personal | employee_profile | in_mvp | true | personal.birthDate | |
| personal.city | 50 | Місто проживання | text | recommended | employee_owner | employee_owner, manager_in_scope, admin | personal | employee_profile | in_mvp | true | personal.city | |
| personal.photo_status | 60 | Фото для профілю | single_choice | voluntary | employee_owner | employee_owner, admin | personal | consents | later_module | false | — | options: added, later, declined — legal consent → Consents; not employees.photo_consent_status |
| personal.preferred_language | 110 | Бажана мова | multi_choice | voluntary | employee_owner | employee_owner, manager_in_scope, admin | normal | employee_profile | in_mvp | true | personal.preferredLanguage | options: uk, en, other; profile canonical `uk,en,other:Текст` |
| personal.preferred_language_other | 111 | Інша мова | text | voluntary | employee_owner | employee_owner, admin | normal | employee_profile | in_mvp | false | — | visibleWhen includes `other`; no separate proposal |

`preferred_language` options: `{uk,en,other}` / labels Українська, Англійська, Інша.

---

## Fields — block 1b `contacts` (mirror / proposals; step `contacts`)

| key | order | label | valueType | requiredPolicy | filledBy | visibility | sensitivity | destination | mvpStatus | createsProfileProposal | proposalMapping / profileField | notes |
|-----|-------|-------|-----------|----------------|----------|------------|-------------|-------------|-----------|------------------------|--------------------------------|-------|
| contacts.bundle | 10 | Контакти | contacts_bundle | voluntary | employee_owner | employee_owner, admin (+ questionnaire ACL for submitted snapshot) | personal | employee_profile | in_mvp | true | work scalars + personal_replace + emergency_replace | Draft SoT; shared editor; mirror `contactsBundle` owner/admin only; `@loom/employee-contacts` + Organization facade |

---

## Fields — block 2 `family` (voluntary snapshot)

| key | order | label | valueType | requiredPolicy | sensitivity | destination | mvpStatus | notes |
|-----|-------|-------|-----------|----------------|-------------|-------------|-----------|-------|
| family.marital_status | 10 | Сімейний стан | single_choice | voluntary | personal | questionnaire_snapshot | in_mvp | options: prefer_not_say, single, married, other |
| family.has_children | 20 | Чи є діти | single_choice | voluntary | personal | questionnaire_snapshot | in_mvp | yes, no, prefer_not_say |
| family.children | 30 | Діти | repeating_group | voluntary | personal | questionnaire_snapshot | in_mvp | visibleWhen equals yes; children: name, birth_date, note |
| family.pets | 40 | Домашні тварини | text | voluntary | personal | questionnaire_snapshot | in_mvp | |

`filledBy`/`visibility` for family: employee_owner fill; visibility employee_owner + admin (manager optional later — default admin + owner for MVP).

---

## Fields — block 2b `celebration_dates` (voluntary snapshot)

| key | order | label | valueType | requiredPolicy | destination | mvpStatus | notes |
|-----|-------|-------|-----------|----------------|-------------|-----------|-------|
| celebration.birth_date | 10 | День народження | date | voluntary | questionnaire_snapshot | in_mvp | `defaultFromAnswerKey: personal.birth_date` (display) |
| hobbies.birthday_greeting | 20 | Вітати з Днем народження | single_choice | voluntary | questionnaire_snapshot | in_mvp | public, hr_only, none (under ДН date) |
| family.gifts_permission | 30 | Дозвіл для подарунків | single_choice | voluntary | questionnaire_snapshot | in_mvp | yes, no (moved from family) |
| hobbies.gift_format | 40 | Формат подарунка | multi_choice | voluntary | questionnaire_snapshot | in_mvp | merch, certificate, experience, useful_item (moved from hobbies) |
| family.other_dates | 50 | Інші важливі дати | repeating_group | voluntary | questionnaire_snapshot | in_mvp | children: title (Назва), from (З), to (По; empty OK; to >= from); maxItems 20; snapshot-only (не employee_important_dates) |

---

## Fields — block 3 `emergency` (Profile Core; not fill MVP)

Documented for completeness; `mvpStatus: excluded`. Existing `employee_emergency_contacts` + `priority`. HTML «Набирати першим» → `priority`, no extra text column.

---

## Fields — block 4 `company_work` (in_mvp snapshot)

Fill step «Робота в компанії». Snapshot-only for MVP (org assignment SoT remains Profile Core; may mirror later).

| key | order | label | valueType | notes |
|-----|-------|-------|-----------|-------|
| company_work.company_direction | 10 | Компанія / напрямок | text | |
| company_work.department | 20 | Підрозділ | text | |
| company_work.position | 30 | Посада | text | |
| company_work.functional_role | 40 | Функціональна роль | text | |
| company_work.manager | 50 | Безпосередній керівник | text | |
| company_work.mentor | 60 | Наставник | text | |
| company_work.hr_responsible | 70 | HR-відповідальний | text | |
| company_work.start_date | 80 | Дата виходу на роботу | date | |
| company_work.probation_end | 90 | Кінець випроб. терміну | date | |
| company_work.status | 100 | Статус | multi_choice | internship, probation, active, leave |
| company_work.work_format | 110 | Формат роботи | multi_choice | office, production, hybrid, remote |
| company_work.schedule | 120 | Графік | multi_choice | nine_to_six, shifts, flexible, other |
| company_work.schedule_other | 121 | Інший графік | text | visibleWhen includes `other` |
| company_work.employment_type | 130 | Тип зайнятості | multi_choice | full_time, part_time, project, hourly |
| company_work.contract_type | 140 | Тип оформлення | multi_choice | staff, fop, gph |
| company_work.location | 150 | Локація роботи | text | |

All: voluntary, questionnaire_snapshot, in_mvp, filledBy employee_owner.

---

## Fields — block 5 `grade` (`later_module`)

| key | label | valueType | notes |
|-----|-------|-----------|-------|
| grade.current | Поточний грейд | single_choice | g0…g5 |
| grade.assigned_at | Дата присвоєння | date | |
| grade.assigned_by | Хто присвоїв | text | |
| grade.next | Наступний грейд | single_choice | |
| grade.criteria | Критерії переходу | textarea | |
| grade.review_at | Дата перегляду | date | |
| grade.net_salary | ЗП на руки | number | restricted; compensation module |

---

## Fields — block 6 `experience` (in_mvp)

| key | order | label | valueType | requiredPolicy | destination | mvpStatus |
|-----|-------|-------|-----------|----------------|-------------|-----------|
| experience.total_tenure | 10 | Загальний стаж | text | voluntary | questionnaire_snapshot | in_mvp |
| experience.managed_people | 20 | Керували людьми? | single_choice | voluntary | questionnaire_snapshot | in_mvp |
| experience.managed_count | 21 | Кількість підлеглих | number | voluntary | questionnaire_snapshot | in_mvp |
| experience.prior_jobs | 30 | Попередні місця роботи | repeating_group | voluntary | questionnaire_snapshot | in_mvp |
| experience.achievements | 40 | Досягнення якими пишаюся | textarea | voluntary | questionnaire_snapshot | in_mvp |
| experience.want_to_learn | 50 | Чого хочу навчитись | textarea | voluntary | questionnaire_snapshot | in_mvp |

`managed_people` options: `yes`, `no`. `managed_count` visibleWhen equals `yes`.  
`prior_jobs` children: `company`, `position`, `from` (date), `to` (date; empty OK; `to >= from` if both set), `results`.

---

## Fields — block 7 `skills` (`later_module`)

Single catalog entry representing matrix (not 26 hardcoded employee columns):

| key | valueType | notes |
|-----|-----------|-------|
| skills.self_assessment | repeating_group | skill_code + rating 0–5; position requirements drive list later |
| skills.custom | repeating_group | name + rating |
| skills.manager_assessment | repeating_group | separate from self; Reviews/Skills module |

---

## Fields — block 8 `education` (in_mvp)

| key | order | label | valueType | destination | mvpStatus |
|-----|-------|-------|-----------|-------------|-----------|
| education.level | 10 | Рівень освіти | single_choice | questionnaire_snapshot | in_mvp |
| education.institutions | 20 | Навчальні заклади | repeating_group | questionnaire_snapshot | in_mvp |
| education.languages | 30 | Мови | repeating_group | questionnaire_snapshot | in_mvp |
| education.certificates | 40 | Сертифікати / курси | textarea | questionnaire_snapshot | in_mvp |
| education.desired_courses | 50 | Які курси хочу пройти | textarea | questionnaire_snapshot | in_mvp |
| education.driver_license | 60 | Водійське посвідчення | multi_choice | questionnaire_snapshot | in_mvp |

`education.level` options: `secondary`, `vocational`, `incomplete_higher`, `bachelor`, `master`, `phd`.  
`institutions` children: `name`, `specialty`, `from` (date), `to` (date; empty OK; `to >= from` if both set), `degree`.  
`languages` children: `language`, `level` (`native`|`conversational`|`intermediate`|`advanced`).  
`driver_license` options: `none`, `A`, `B`, `C`, `D`.

---

## Fields — block 9 `strengths` (in_mvp)

| key | order | label | valueType |
|-----|-------|-------|-----------|
| strengths.top_three | 10 | Три сильні сторони | textarea |
| strengths.best_tasks | 20 | Задачі виходять найкраще | textarea |
| strengths.energizers | 30 | Що дає енергію | textarea |
| strengths.dislike | 40 | Що не подобається | textarea |
| strengths.blockers | 50 | Що заважає | textarea |
| strengths.in_one_year | 60 | Ким ви бачите себе через 1 рік | textarea |
| strengths.in_two_to_three_years | 70 | Ким ви бачите себе через 2–3 роки | textarea |
| strengths.ready_responsibility | 80 | Яку відповідальність готові взяти | textarea |

All: voluntary, personal/normal, questionnaire_snapshot, in_mvp, filledBy employee_owner.  
Removed: `strengths.ask_me_about`, `strengths.in_two_years` (replaced by 1 рік / 2–3 роки + відповідальність).

---

## Fields — block 10 `hobbies` (in_mvp)

| key | order | label | valueType | options (value) |
|-----|-------|-------|-----------|-----------------|
| hobbies.interests | 10 | Хобі та інтереси | multi_choice | sport, running, cycling, swimming, cooking, travel, reading, music, crafts, gardening, photography, games, volunteering, movies, dance, yoga |
| hobbies.other | 20 | Інші інтереси | text | |
| hobbies.shirt_size | 30 | Розмір футболки | single_choice | xs,s,m,l,xl,xxl |
| hobbies.outerwear_size | 40 | Розмір верхнього одягу | text | |
| hobbies.food | 50 | Харчові особливості | single_choice | none, has_notes, prefer_not_say |
| hobbies.food_notes | 51 | Опис харчових особливостей | text | visibleWhen equals has_notes |
| hobbies.corporate_events | 60 | Готовий/а до корпоративів | single_choice | active, sometimes, not_really |

Gifts / ДН greeting live under `celebration_dates` (not hobbies). All voluntary → questionnaire_snapshot.

---

## Fields — block 11 `work_style` (in_mvp)

| key | order | label | valueType | options |
|-----|-------|-------|-----------|---------|
| work_style.task_delivery | 10 | Зручно отримувати задачі | multi_choice | verbal, messenger, system |
| work_style.feedback_frequency | 20 | Потреба у зворотному зв'язку | single_choice | daily, weekly, as_needed, rarely |
| work_style.criticism | 30 | Критику краще давати | multi_choice | one_on_one, written, direct, soft_with_examples |
| work_style.productivity_time | 40 | Продуктивніший/а | single_choice | morning, day, evening, same |
| work_style.solo_or_team | 50 | Краще працюю | single_choice | solo, team, mixed |
| work_style.motivators | 60 | Основні мотиватори | textarea | |
| work_style.demotivators | 70 | Основні демотиватори | textarea | |
| work_style.notes_for_manager | 80 | Що важливо знати керівнику | textarea | |

---

## Fields — blocks 12–17, 19 (later / excluded)

Documented at section matrix only. Do not seed into employee-360 v1 schema. Safety: no diagnoses. Documents: Documents module only. Onboarding/goals/reviews: own modules.

---

## Fields — block 18 `consents` (in_mvp snapshot attestations)

Legal versioned consents → future Consents module. MVP stores attestation booleans in **questionnaire snapshot** only (not `employees.*`).

| key | order | label | valueType | requiredPolicy | destination | mvpStatus |
|-----|-------|-------|-----------|----------------|-------------|-----------|
| consents.info_accurate | 10 | Підтверджую актуальність інформації | boolean | recommended | questionnaire_snapshot | in_mvp |
| consents.hr_processing | 20 | Згода на обробку для HR-процесів | boolean | recommended | consents | in_mvp |
| consents.photo_internal | 30 | Згода на фото у внутрішньому профілі | boolean | voluntary | consents | in_mvp |
| consents.hr_notifications | 40 | Згода на HR-повідомлення | boolean | voluntary | consents | in_mvp |

`consents.birthday_greeting` removed (greeting preference is `hobbies.birthday_greeting` on celebration step). Signatures are process metadata — optional later; not employee columns.

---

## Client integration notes (fill wizard)

1. GET assignment returns runtime `schema` + draft `answers`/`revision` + `profileMirror` for display defaults (draft keys win via `hasOwnProperty`; mirror is not written into draft without user edit). `defaultFromAnswerKey` is display-only (Review labels by source).
2. PATCH draft uses optimistic `revision`. Autosave **serializes** PATCHes (one in-flight; pending accumulates; never cancel an accepted in-flight PATCH / no `switchMap` last-wins). Hidden answers may remain in draft.
3. **409 conflict:** stop autosave; keep local answers; fetch server draft; show conflict banner + «Завантажити серверну версію» (explicit discard). No silent overwrite; no invented field-level merge.
4. **Submit:** client validation → `flush()` → POST submit. Backend snapshot = `projectVisibleQuestionnaireAnswers(schema, draft)` (not raw draft). Inactive own answers: Review warning «не буде надіслано».
5. **Step gating:** linear Intro → schema steps → Review. `visibleWhen` (strict equals|includes union). Navigation = visible required valid; completion % = answered visible / visible (`@loom/questionnaire-schema`).
6. **Preferred language:** multi_choice in answers; profile/proposal canonical `uk,en,other:Текст` (`other:` last segment).
7. FE: People via `questionnaires/public-api.ts`; fill private. Domain pure helpers in `@loom/questionnaire-schema` (not contracts).
8. **Pre-prod schema refresh:** [`docs/dev/questionnaire-test-reset.md`](../dev/questionnaire-test-reset.md) + snapshot DoD before/after breaking v1 changes.

---

## Sync checklist

| Artifact | Role |
|----------|------|
| This catalog | policy SoT |
| `employee-360-v1` seed | code seed synced manually from catalog `in_mvp` rows (`satisfies QuestionnaireSchemaJson`) |
| `schema_json` in DB | runtime SoT after publish |
| `@loom/questionnaire-schema` | pure helpers (not contracts); API uses built `dist/` |
| HTML reference | human UX reference only |
