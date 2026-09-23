import type { QuestionnaireSchemaJson } from '@loom/contracts-questionnaires';
import { QUESTIONNAIRE_PRINT_LAYOUT_VERSION } from '@loom/contracts-questionnaires';
import {
  buildQuestionnairePrintModel,
  listPrintModelFieldKeys,
  listTopLevelFields,
} from './index';

const miniSchema: QuestionnaireSchemaJson = {
  code: 'mini',
  version: 1,
  title: 'Міні',
  steps: [
    {
      key: 's1',
      label: 'Крок 1',
      fields: [
        {
          key: 'personal.first_name',
          label: 'Імʼя',
          valueType: 'text',
          profileMirrorKey: 'firstName',
        },
        {
          key: 'family.has_children',
          label: 'Діти',
          valueType: 'single_choice',
          options: [
            { value: 'yes', label: 'Так' },
            { value: 'no', label: 'Ні' },
          ],
        },
        {
          key: 'family.children',
          label: 'Діти — деталі',
          valueType: 'repeating_group',
          visibleWhen: { answerKey: 'family.has_children', equals: 'yes' },
          children: [
            { key: 'name', label: 'Імʼя дитини', valueType: 'text' },
          ],
        },
        {
          key: 'consent.ok',
          label: 'Згода',
          valueType: 'boolean',
        },
      ],
    },
  ],
};

const noopFormat = {
  resolveOrgLabel: (_f: unknown, v: unknown) =>
    v == null || v === '' ? '—' : String(v),
};

const baseMeta = {
  title: 'Міні',
  templateCode: 'mini',
  templateTypeLabelUa: 'Повна',
  generatedAtLabel: '01.01.2026 12:00',
  generatedByLabel: 'tester@example.com',
  schemaVersion: 1,
  printLayoutVersion: QUESTIONNAIRE_PRINT_LAYOUT_VERSION,
};

describe('buildQuestionnairePrintModel', () => {
  it('blank includes all top-level keys (ignores visibleWhen)', () => {
    const model = buildQuestionnairePrintModel({
      schema: miniSchema,
      answers: {},
      mode: 'blank',
      meta: baseMeta,
      formatContext: noopFormat,
    });
    const keys = listPrintModelFieldKeys(model);
    expect(keys).toEqual(
      listTopLevelFields(miniSchema).map((f) => f.key),
    );
    const repeating = model.steps[0].fields.find(
      (f) => f.key === 'family.children',
    );
    expect(repeating?.kind).toBe('repeating_group');
    if (repeating?.kind === 'repeating_group') {
      expect(repeating.rows).toHaveLength(1);
      expect(repeating.rows[0].cells[0].display).toBeNull();
    }
  });

  it('filled respects visibleWhen (visibility-superset vs blank)', () => {
    const blank = buildQuestionnairePrintModel({
      schema: miniSchema,
      answers: { 'family.has_children': 'no' },
      mode: 'blank',
      meta: baseMeta,
      formatContext: noopFormat,
    });
    const filled = buildQuestionnairePrintModel({
      schema: miniSchema,
      answers: { 'family.has_children': 'no', 'consent.ok': true },
      mode: 'filled',
      meta: baseMeta,
      formatContext: noopFormat,
    });
    expect(listPrintModelFieldKeys(blank).length).toBeGreaterThan(
      listPrintModelFieldKeys(filled).length,
    );
    expect(listPrintModelFieldKeys(filled)).not.toContain('family.children');
    const consent = filled.steps[0].fields.find((f) => f.key === 'consent.ok');
    expect(consent?.kind).toBe('scalar');
    if (consent?.kind === 'scalar') {
      expect(consent.display).toBe('Так');
    }
  });

  it('draft profileMirror fills missing personal.first_name', () => {
    const model = buildQuestionnairePrintModel({
      schema: miniSchema,
      answers: {},
      profileMirror: { firstName: 'Іван' },
      mode: 'filled',
      meta: baseMeta,
      formatContext: noopFormat,
    });
    const name = model.steps[0].fields.find(
      (f) => f.key === 'personal.first_name',
    );
    expect(name?.kind).toBe('scalar');
    if (name?.kind === 'scalar') {
      expect(name.display).toBe('Іван');
    }
  });

  it('submitted path with empty mirror does not invent values', () => {
    const model = buildQuestionnairePrintModel({
      schema: miniSchema,
      answers: {},
      profileMirror: {},
      mode: 'filled',
      meta: baseMeta,
      formatContext: noopFormat,
    });
    const name = model.steps[0].fields.find(
      (f) => f.key === 'personal.first_name',
    );
    expect(name?.kind).toBe('scalar');
    if (name?.kind === 'scalar') {
      expect(name.display).toBeNull();
    }
  });

  it('filled repeating_group expands structured rows', () => {
    const model = buildQuestionnairePrintModel({
      schema: miniSchema,
      answers: {
        'family.has_children': 'yes',
        'family.children': [{ name: 'Оля' }, { name: 'Тарас' }],
      },
      mode: 'filled',
      meta: baseMeta,
      formatContext: noopFormat,
    });
    const repeating = model.steps[0].fields.find(
      (f) => f.key === 'family.children',
    );
    expect(repeating?.kind).toBe('repeating_group');
    if (repeating?.kind === 'repeating_group') {
      expect(repeating.rows).toHaveLength(2);
      expect(repeating.rows[0].cells[0].display).toBe('Оля');
      expect(repeating.rows[1].cells[0].display).toBe('Тарас');
    }
  });
});
