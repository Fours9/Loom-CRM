# People «Про себе» (living)

Вкладка профілю для **мʼякого / добровільного** контексту про працівника (хобі, сімʼя, стиль роботи).  
**Не** кадрова SoT «Дані працівника» і **не** операційна «Робота».

Visibility: surface `people.tab.about` (Settings «Доступи»). Seed: `employee` + adminEq; DM/director — opt-in.  
`people.tab.later` лишається reserved (без UI).

Код:
- вкладка: [`people-profile-tabs.ts`](../../apps/web/src/app/features/people/people-profile-tabs.ts)
- оболонка: [`employee-about-panel.component.ts`](../../apps/web/src/app/features/people/employee-about-panel.component.ts)
- реєстр підвкладок (SoT плану): [`people-about-subtabs.ts`](../../apps/web/src/app/features/people/people-about-subtabs.ts)

## Плановані підвкладки (UI ще не shipped)

Єдина точка входу — `PLANNED_ABOUT_SUBTABS` / `visiblePeopleAboutSubtabs()` (зараз повертає `[]`).

| id | Label | Questionnaire sections (field catalog) | Примітка |
|----|-------|----------------------------------------|----------|
| `family_home` | Сімʼя і дім | `family` | marital, діти, pets |
| `celebrations` | Свята і подарунки | `celebration_dates` | ДН-вітання, gifts, інші дати |
| `hobbies` | Хобі та інтереси | `hobbies` | інтереси, мерч-розміри, їжа, корпоративи |
| `strengths` | Сильні сторони | `strengths` | енергія / блокери / «ким бачу себе» |
| `work_style` | Стиль роботи | `work_style` | комунікація, фідбек, мотиватори |
| `life_goals` | Цілі | `career_goals` (+ narrative з `strengths.in_*`) | життєві/карʼєрні орієнтири; Profile SoT пізніше |

**Свідомо поза «Про себе»** (залишаються в інших вкладках / модулях):

| Контент анкети | Куди |
|----------------|------|
| `personal` / `contacts` mirrors + proposals | Дані працівника |
| `company_work`, grade, skills matrix, probation_goals process | Робота / Показники / Managing |
| onboarding, hr_documents, consents | Документи / Анкети / окремі модулі |
| experience, education | CV-контекст — не в першому slice About (можна додати пізніше окремим ADR) |

Джерело полів: [questionnaire-360-field-catalog.md](./questionnaire-360-field-catalog.md). Persistence Profile Core для About — окреме рішення (поки snapshot анкети).
