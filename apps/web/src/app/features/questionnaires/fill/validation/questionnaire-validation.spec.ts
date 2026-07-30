import { normalizeQuestionnaireSchemaSteps } from './normalize-schema';
import {
  isIsoDateOnly,
  formatIsoDateOnlyUk,
  parseIsoDateOnly,
} from './iso-date';
import {
  displayFieldValue,
  parseNumberInput,
  validateFieldValue,
  validateFieldRecommended,
  areStepRequiredFieldsValid,
} from './questionnaire-validation';
import type { QuestionnaireSchemaField } from '@loom/contracts-questionnaires';
import {
  choiceLabel,
  computeQuestionnaireProgress,
} from '../progress/questionnaire-progress';
import {
  QUESTIONNAIRE_INTRO_STEP,
  QUESTIONNAIRE_REVIEW_STEP,
} from '../../navigation/questionnaire-step-keys';

describe('normalizeQuestionnaireSchemaSteps', () => {
  it('rejects duplicate keys', () => {
    const result = normalizeQuestionnaireSchemaSteps({
      code: 'x',
      version: 1,
      title: 't',
      steps: [
        { key: 'a', label: 'A', fields: [{ key: 'f', label: 'F', valueType: 'text' }] },
        { key: 'a', label: 'A2', fields: [{ key: 'g', label: 'G', valueType: 'text' }] },
      ],
    });
    expect(result.ok).toBe(false);
  });

  it('rejects reserved keys', () => {
    const result = normalizeQuestionnaireSchemaSteps({
      code: 'x',
      version: 1,
      title: 't',
      steps: [
        {
          key: QUESTIONNAIRE_INTRO_STEP,
          label: 'Intro',
          fields: [{ key: 'f', label: 'F', valueType: 'text' }],
        },
      ],
    });
    expect(result.ok).toBe(false);
  });

  it('rejects review reserved key', () => {
    const result = normalizeQuestionnaireSchemaSteps({
      code: 'x',
      version: 1,
      title: 't',
      steps: [
        {
          key: QUESTIONNAIRE_REVIEW_STEP,
          label: 'R',
          fields: [{ key: 'f', label: 'F', valueType: 'text' }],
        },
      ],
    });
    expect(result.ok).toBe(false);
  });

  it('drops empty-field steps', () => {
    const result = normalizeQuestionnaireSchemaSteps({
      code: 'x',
      version: 1,
      title: 't',
      steps: [
        { key: 'a', label: 'A', fields: [{ key: 'f', label: 'F', valueType: 'text' }] },
        { key: 'submit', label: 'Send', fields: [] },
      ],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.steps.map((s) => s.key)).toEqual(['a']);
    }
  });
});

describe('iso-date', () => {
  it('accepts valid YYYY-MM-DD', () => {
    expect(isIsoDateOnly('2026-02-28')).toBe(true);
    expect(parseIsoDateOnly('2026-02-28')).toEqual({
      year: 2026,
      month: 2,
      day: 28,
    });
    expect(formatIsoDateOnlyUk('2026-02-28')).toBe('28.02.2026');
  });

  it('rejects invalid calendar dates', () => {
    expect(isIsoDateOnly('2026-02-31')).toBe(false);
    expect(isIsoDateOnly('2026-13-01')).toBe(false);
    expect(isIsoDateOnly('26-02-01')).toBe(false);
  });
});

describe('questionnaire-validation', () => {
  const requiredText: QuestionnaireSchemaField = {
    key: 'name',
    label: "Ім'я",
    valueType: 'text',
    requiredPolicy: 'required',
  };

  const recommended: QuestionnaireSchemaField = {
    key: 'city',
    label: 'Місто',
    valueType: 'text',
    requiredPolicy: 'recommended',
  };

  const voluntary: QuestionnaireSchemaField = {
    key: 'note',
    label: 'Нотатка',
    valueType: 'text',
    requiredPolicy: 'voluntary',
  };

  it('required / recommended / voluntary', () => {
    expect(validateFieldValue(requiredText, '')?.severity).toBe('error');
    expect(validateFieldRecommended(recommended, '')?.severity).toBe('warning');
    expect(validateFieldValue(voluntary, '')).toBeNull();
    expect(validateFieldRecommended(voluntary, '')).toBeNull();
  });

  it('draft has priority over mirror via hasOwn', () => {
    const field: QuestionnaireSchemaField = {
      key: 'personal.last_name',
      label: 'Прізвище',
      valueType: 'text',
      proposalMapping: { section: 'overview', field: 'lastName' },
    };
    expect(
      displayFieldValue(
        { 'personal.last_name': '' },
        { lastName: 'Mirror' },
        field,
      ),
    ).toBe('');
    expect(
      displayFieldValue(
        { 'personal.last_name': false as unknown as string },
        { lastName: 'Mirror' },
        field,
      ),
    ).toBe(false);
    expect(
      displayFieldValue({}, { lastName: 'Mirror' }, field),
    ).toBe('Mirror');
  });

  it('parses number with comma', () => {
    expect(parseNumberInput('3,5')).toBe(3.5);
    expect(parseNumberInput('x')).toBeNull();
  });

  it('validates nested repeating group', () => {
    const field: QuestionnaireSchemaField = {
      key: 'kids',
      label: 'Діти',
      valueType: 'repeating_group',
      requiredPolicy: 'voluntary',
      minItems: 1,
      children: [
        {
          key: 'name',
          label: "Ім'я",
          valueType: 'text',
          requiredPolicy: 'required',
        },
      ],
    };
    expect(validateFieldValue(field, [])?.severity).toBe('error');
    expect(validateFieldValue(field, [{ name: '' }])?.severity).toBe('error');
    expect(validateFieldValue(field, [{ name: 'Ann' }])).toBeNull();
  });

  it('rejects repeating row when to is before from', () => {
    const field: QuestionnaireSchemaField = {
      key: 'family.other_dates',
      label: 'Інші важливі дати',
      valueType: 'repeating_group',
      requiredPolicy: 'voluntary',
      maxItems: 20,
      children: [
        {
          key: 'title',
          label: 'Назва',
          valueType: 'text',
          requiredPolicy: 'voluntary',
        },
        {
          key: 'from',
          label: 'З',
          valueType: 'date',
          requiredPolicy: 'voluntary',
        },
        {
          key: 'to',
          label: 'По',
          valueType: 'date',
          requiredPolicy: 'voluntary',
        },
      ],
    };
    expect(
      validateFieldValue(field, [
        { title: 'Ювілей', from: '2026-05-01', to: '2026-04-01' },
      ])?.severity,
    ).toBe('error');
    expect(
      validateFieldValue(field, [
        { title: 'Ювілей', from: '2026-04-01', to: '2026-05-01' },
      ]),
    ).toBeNull();
    expect(
      validateFieldValue(field, [
        { title: 'Ювілей', from: '2026-04-01', to: '' },
      ]),
    ).toBeNull();
  });

  it('step required ignores recommended', () => {
    expect(
      areStepRequiredFieldsValid(
        [recommended, voluntary],
        {},
        {},
      ),
    ).toBe(true);
    expect(
      areStepRequiredFieldsValid([requiredText], {}, {}),
    ).toBe(false);
  });
});

describe('progress and review labels', () => {
  it('computes completion from answered visible fields', () => {
    const steps = [
      {
        key: 's1',
        label: 'S1',
        fields: [
          {
            key: 'a',
            label: 'A',
            valueType: 'text',
            requiredPolicy: 'required',
          },
        ],
      },
      {
        key: 's2',
        label: 'S2',
        fields: [
          {
            key: 'b',
            label: 'B',
            valueType: 'text',
            requiredPolicy: 'voluntary',
          },
        ],
      },
    ];
    expect(computeQuestionnaireProgress(steps, {}, {}).percent).toBe(0);
    expect(
      computeQuestionnaireProgress(steps, { a: 'x' }, {}).percent,
    ).toBe(50);
    expect(
      computeQuestionnaireProgress(steps, { a: 'x', b: 'y' }, {}).percent,
    ).toBe(100);
  });

  it('maps choice labels', () => {
    const field: QuestionnaireSchemaField = {
      key: 'lang',
      label: 'Мова',
      valueType: 'single_choice',
      options: [{ value: 'uk', label: 'Українська' }],
    };
    expect(choiceLabel(field, 'uk')).toBe('Українська');
    const multi: QuestionnaireSchemaField = {
      key: 'tags',
      label: 'Теги',
      valueType: 'multi_choice',
      options: [
        { value: 'a', label: 'А' },
        { value: 'b', label: 'Б' },
      ],
    };
    expect(choiceLabel(multi, ['a', 'b'])).toBe('А, Б');
  });
});
