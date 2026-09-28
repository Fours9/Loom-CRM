# Reference: anketa_360.html

Статичний HTML-прототип «Анкета співробітника 360° · People Core CRM».

- **Не** є UI Loom-CRM і **не** повинен копіюватися в Angular як одна форма.
- Джерело вимог для [questionnaire-360-field-catalog.md](../questionnaire-360-field-catalog.md) (policy SoT) і checked-in seed → `schema_json` ([ADR 0009](../../adr/0009-questionnaire-360-mvp.md)).
- Runtime **не** парсить цей HTML і **не** читає Markdown-каталог.
- **Fill UI** у Loom = schema-driven wizard на `/questionnaires/:id` (кроки з `schema_json`), не цей HTML.
- Кнопка «Друкувати / PDF» у HTML = браузерний `window.print()` — **не** Loom server PDF. Loom PDF (paper-form layout 2.0, blank + filled): [questionnaire-pdf.md](../questionnaire-pdf.md), [ADR 0015](../../adr/0015-questionnaire-pdf.md).
- Мапінг 19 блоків → модулі: див. [employee-profile-core.md](../employee-profile-core.md) §44 і [ADR 0007](../../adr/0007-employee-profile-boundaries.md).
- Поточний статус фаз у коді: [hr-profile-roadmap.md](../hr-profile-roadmap.md) (living), не цей прототип і не повна спека як «вже зроблено».

Файл: [anketa_360.html](./anketa_360.html)
