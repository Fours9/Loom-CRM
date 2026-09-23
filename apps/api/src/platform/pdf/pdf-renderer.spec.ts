import { PdfRenderer } from './pdf-renderer';
import {
  QUESTIONNAIRE_PRINT_LAYOUT_VERSION,
  type QuestionnairePrintModel,
} from '@loom/contracts-questionnaires';

describe('PdfRenderer.renderQuestionnaire', () => {
  it('returns a non-empty %PDF buffer without throwing', async () => {
    const renderer = new PdfRenderer();
    const model: QuestionnairePrintModel = {
      mode: 'blank',
      meta: {
        title: 'Тестова анкета',
        templateCode: 'employee-docs',
        templateTypeLabelUa: 'Docs',
        generatedAtLabel: '01.01.2026 12:00',
        generatedByLabel: 'tester@example.com',
        schemaVersion: 1,
        printLayoutVersion: QUESTIONNAIRE_PRINT_LAYOUT_VERSION,
      },
      steps: [
        {
          key: 's1',
          label: 'Крок',
          fields: [
            {
              kind: 'scalar',
              key: 'a',
              label: 'Поле',
              valueType: 'text',
              display: null,
            },
            {
              kind: 'repeating_group',
              key: 'r',
              label: 'Група',
              rows: [
                {
                  cells: [
                    { key: 'c1', label: 'Клітинка', display: null },
                  ],
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
});
