import { PdfRenderer } from './pdf-renderer';
import {
  QUESTIONNAIRE_PRINT_LAYOUT_VERSION,
  TEXTAREA_PAPER_LINES,
  type QuestionnairePrintModel,
} from '@loom/contracts-questionnaires';

describe('PdfRenderer.renderQuestionnaire (layout 2.4)', () => {
  const baseMeta = {
    title: 'Тестова анкета',
    templateCode: 'employee-docs',
    templateTypeLabelUa: 'Docs',
    generatedAtLabel: '01.01.2026 12:00',
    generatedByLabel: 'tester@example.com',
    schemaVersion: 1,
    printLayoutVersion: QUESTIONNAIRE_PRINT_LAYOUT_VERSION,
  };

  it('blank paper form returns %PDF', async () => {
    const renderer = new PdfRenderer();
    const model: QuestionnairePrintModel = {
      mode: 'blank',
      meta: baseMeta,
      steps: [
        {
          key: 's1',
          label: 'Крок',
          fields: [
            {
              kind: 'text_line',
              key: 'a',
              label: 'Поле',
              value: null,
            },
            {
              kind: 'text_box',
              key: 'b',
              label: 'Текст',
              lines: TEXTAREA_PAPER_LINES,
              value: null,
            },
            {
              kind: 'choice_list',
              key: 'c',
              label: 'Вибір',
              exclusive: true,
              options: [
                { value: 'yes', label: 'Так', checked: false },
                { value: 'no', label: 'Ні', checked: false },
              ],
            },
            {
              kind: 'checkbox_item',
              key: 'd',
              label: 'Прапорець',
              checked: false,
            },
            {
              kind: 'repeating_table',
              key: 'r',
              label: 'Група',
              columns: [
                { key: 'item', label: 'Пункт' },
                { key: 'completed', label: 'Готово' },
                { key: 'description', label: 'Опис' },
              ],
              rows: [
                {
                  cells: [
                    {
                      kind: 'text_line',
                      key: 'item',
                      label: 'Пункт',
                      value: null,
                    },
                    {
                      kind: 'checkbox_item',
                      key: 'completed',
                      label: 'Готово',
                      checked: false,
                    },
                    {
                      kind: 'text_box',
                      key: 'description',
                      label: 'Опис',
                      lines: 2,
                      value: null,
                    },
                  ],
                },
              ],
            },
            {
              kind: 'contacts_form',
              key: 'contacts',
              label: 'Контакти',
              work: [
                {
                  kind: 'text_line',
                  key: 'w.email',
                  label: 'Email',
                  value: null,
                },
              ],
              personal: [],
              emergency: [
                {
                  controls: [
                    {
                      kind: 'text_line',
                      key: 'e.fullName',
                      label: 'ПІБ',
                      value: null,
                    },
                    {
                      kind: 'text_line',
                      key: 'e.relationship',
                      label: 'Ким',
                      value: null,
                    },
                    {
                      kind: 'text_line',
                      key: 'e.primaryPhone',
                      label: 'Тел',
                      value: null,
                    },
                    {
                      kind: 'text_line',
                      key: 'e.secondaryPhone',
                      label: 'Тел2',
                      value: null,
                    },
                  ],
                },
              ],
            },
            {
              kind: 'skills_matrix',
              key: 'skills',
              label: 'Навички',
              rows: [
                {
                  identity: { kind: 'blank' },
                  label: null,
                  rating: { kind: 'freehand', value: null },
                  comment: null,
                },
              ],
            },
          ],
        },
      ],
    };

    const buffer = await renderer.renderQuestionnaire(model);
    expect(buffer.length).toBeGreaterThan(100);
    expect(buffer.subarray(0, 4).toString('utf8')).toBe('%PDF');
    const pages =
      buffer.toString('latin1').match(/\/Type\s*\/Page(?![s])/g) ?? [];
    // Single-step smoke must not invent empty trailing pages from footers.
    expect(pages.length).toBeLessThanOrEqual(2);
  });

  it('filled paper form with nested choice cells returns %PDF', async () => {
    const renderer = new PdfRenderer();
    const model: QuestionnairePrintModel = {
      mode: 'filled',
      meta: {
        ...baseMeta,
        assignmentCode: 'Q-1',
        employeeDisplayName: 'Тест Тестовий',
      },
      steps: [
        {
          key: 's1',
          label: 'Крок',
          fields: [
            {
              kind: 'choice_list',
              key: 'status',
              label: 'Статус',
              exclusive: true,
              options: [
                { value: 'done', label: 'Виконано', checked: true },
                { value: 'planned', label: 'Заплановано', checked: false },
              ],
            },
            {
              kind: 'repeating_table',
              key: 'items',
              label: 'Пункти',
              columns: [
                { key: 'title', label: 'Назва' },
                { key: 'status', label: 'Статус' },
              ],
              rows: [
                {
                  cells: [
                    {
                      kind: 'text_line',
                      key: 'title',
                      label: 'Назва',
                      value: 'Задача',
                    },
                    {
                      kind: 'choice_list',
                      key: 'status',
                      label: 'Статус',
                      exclusive: true,
                      options: [
                        { value: 'done', label: 'Виконано', checked: true },
                        {
                          value: 'planned',
                          label: 'Заплановано',
                          checked: false,
                        },
                      ],
                    },
                  ],
                },
              ],
            },
            {
              kind: 'skills_matrix',
              key: 'skills',
              label: 'Навички',
              rows: [
                {
                  identity: { kind: 'catalog', code: 'sewing' },
                  label: 'Пошиття',
                  rating: {
                    kind: 'choice_scale',
                    options: [
                      { value: 0, label: '0', checked: false },
                      { value: 4, label: '4', checked: true },
                      { value: 5, label: '5', checked: false },
                    ],
                  },
                  comment: 'ok',
                },
                {
                  identity: { kind: 'catalog', code: 'pct' },
                  label: 'Швидкість',
                  rating: {
                    kind: 'number',
                    value: 82,
                    min: 0,
                    max: 100,
                    unit: '%',
                  },
                  comment: null,
                },
              ],
            },
          ],
        },
      ],
    };

    const buffer = await renderer.renderQuestionnaire(model);
    expect(buffer.length).toBeGreaterThan(100);
    expect(buffer.subarray(0, 4).toString('utf8')).toBe('%PDF');
  });

  it('multi-step model starts later steps on new pages without trailing blank', async () => {
    const renderer = new PdfRenderer();
    const model: QuestionnairePrintModel = {
      mode: 'blank',
      meta: baseMeta,
      steps: [
        {
          key: 's1',
          label: 'Step One',
          fields: [
            {
              kind: 'text_line',
              key: 'lastName',
              label: 'Last name',
              value: null,
            },
          ],
        },
        {
          key: 's2',
          label: 'Step Two Experience',
          fields: [
            {
              kind: 'text_line',
              key: 'job',
              label: 'Job',
              value: null,
            },
          ],
        },
      ],
    };
    const buffer = await renderer.renderQuestionnaire(model);
    expect(buffer.subarray(0, 4).toString('utf8')).toBe('%PDF');
    const pageObjects =
      buffer.toString('latin1').match(/\/Type\s*\/Page(?![s])/g) ?? [];
    // Two steps ⇒ two pages; footer must not append blank overflow pages.
    expect(pageObjects.length).toBe(2);
  });
});
