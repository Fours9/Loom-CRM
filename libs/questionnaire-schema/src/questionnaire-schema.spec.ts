import {
  isQuestionnaireFieldVisible,
  projectVisibleQuestionnaireAnswers,
  completionPercentVisible,
  isFieldAnswered,
  parsePreferredLanguage,
  serializePreferredLanguage,
  validateQuestionnaireSchema,
  schemasStructurallyEqual,
} from './index';
import type {
  QuestionnaireSchemaField,
  QuestionnaireSchemaJson,
} from '@loom/contracts-questionnaires';

const OPTIONS = [
  { value: 'uk', label: 'Українська' },
  { value: 'en', label: 'Англійська' },
  { value: 'other', label: 'Інша' },
];

const schema: QuestionnaireSchemaJson = {
  code: 't',
  version: 1,
  title: 'T',
  steps: [
    {
      key: 'family',
      label: 'Family',
      fields: [
        {
          key: 'family.has_children',
          label: 'Kids?',
          valueType: 'single_choice',
          requiredPolicy: 'voluntary',
        },
        {
          key: 'family.children',
          label: 'Children',
          valueType: 'repeating_group',
          requiredPolicy: 'voluntary',
          visibleWhen: { answerKey: 'family.has_children', equals: 'yes' },
          children: [
            { key: 'name', label: 'Name', valueType: 'text' },
            { key: 'birth_date', label: 'DOB', valueType: 'date' },
          ],
        },
        {
          key: 'experience.prior_jobs',
          label: 'Jobs',
          valueType: 'repeating_group',
          requiredPolicy: 'voluntary',
          children: [
            { key: 'company', label: 'Company', valueType: 'text' },
            { key: 'from', label: 'From', valueType: 'date' },
            { key: 'to', label: 'To', valueType: 'date' },
          ],
        },
      ],
    },
  ],
};

describe('visibleWhen', () => {
  it('hides when controlling answer missing', () => {
    const field = schema.steps[0]!.fields[1]!;
    expect(isQuestionnaireFieldVisible(field, {})).toBe(false);
  });

  it('shows when equals matches', () => {
    const field = schema.steps[0]!.fields[1]!;
    expect(
      isQuestionnaireFieldVisible(field, { 'family.has_children': 'yes' }),
    ).toBe(true);
  });
});

describe('projectVisibleQuestionnaireAnswers', () => {
  it('excludes hidden fields and strips unknown row keys', () => {
    const draft = {
      'family.has_children': 'no',
      'family.children': [{ name: 'Ann', period: 'x', __uiId: '1' }],
      'experience.prior_jobs': [
        { company: 'Acme', from: '2020-01-01', to: '', period: 'old', __uiId: 'r' },
        { company: '', from: '', to: '' },
      ],
    };
    const snap = projectVisibleQuestionnaireAnswers(schema, draft);
    expect(snap['family.children']).toBeUndefined();
    expect(snap['family.has_children']).toBe('no');
    expect(snap['experience.prior_jobs']).toEqual([
      { company: 'Acme', from: '2020-01-01' },
    ]);
  });

  it('keeps false and 0', () => {
    const s: QuestionnaireSchemaJson = {
      code: 't',
      version: 1,
      title: 'T',
      steps: [
        {
          key: 's',
          label: 'S',
          fields: [
            { key: 'flag', label: 'F', valueType: 'boolean' },
            { key: 'n', label: 'N', valueType: 'number' },
          ],
        },
      ],
    };
    expect(
      projectVisibleQuestionnaireAnswers(s, { flag: false, n: 0 }),
    ).toEqual({ flag: false, n: 0 });
  });
});

describe('completionPercentVisible', () => {
  it('returns 0 when no visible fields', () => {
    expect(
      completionPercentVisible({ code: 't', version: 1, title: 'T', steps: [] }, {}),
    ).toBe(0);
  });

  it('does not count empty repeating rows as answered', () => {
    const field = schema.steps[0]!.fields[2]!;
    expect(isFieldAnswered(field, [{ company: '', from: '', to: '' }])).toBe(
      false,
    );
    expect(isFieldAnswered(field, [{ company: 'Acme' }])).toBe(true);
  });
});

describe('preferred language', () => {
  it('parses other text with commas', () => {
    expect(
      parsePreferredLanguage('uk,en,other:Польська, німецька', OPTIONS),
    ).toEqual({
      selected: ['uk', 'en', 'other'],
      otherText: 'Польська, німецька',
    });
  });

  it('serializes with other text', () => {
    expect(
      serializePreferredLanguage(['en', 'uk', 'other'], 'Polish', OPTIONS),
    ).toBe('uk,en,other:Polish');
  });

  it('maps unknown legacy string to other', () => {
    expect(parsePreferredLanguage('Deutsch', OPTIONS)).toEqual({
      selected: ['other'],
      otherText: 'Deutsch',
    });
  });
});

describe('validateQuestionnaireSchema', () => {
  it('rejects reserved step and bad visibleWhen', () => {
    const bad: QuestionnaireSchemaJson = {
      code: 't',
      version: 1,
      title: 'T',
      steps: [
        {
          key: '__intro__',
          label: 'X',
          fields: [
            {
              key: 'a',
              label: 'A',
              valueType: 'text',
              visibleWhen: { answerKey: 'missing', equals: 'x' },
            },
          ],
        },
      ],
    };
    const r = validateQuestionnaireSchema(bad);
    expect(r.ok).toBe(false);
  });
});

describe('schemasStructurallyEqual', () => {
  it('ignores key order', () => {
    expect(
      schemasStructurallyEqual({ a: 1, b: 2 }, { b: 2, a: 1 }),
    ).toBe(true);
  });
});

describe('contacts_bundle snapshot', () => {
  const contactsSchema: QuestionnaireSchemaJson = {
    code: 't',
    version: 1,
    title: 'T',
    steps: [
      {
        key: 'contacts',
        label: 'Contacts',
        fields: [
          {
            key: 'contacts.bundle',
            label: 'Contacts',
            valueType: 'contacts_bundle',
            requiredPolicy: 'voluntary',
          },
        ],
      },
    ],
  };

  it('preserves own empty bundle in snapshot', () => {
    const empty = {
      work: { email: null, phone: null, telegram: null },
      personal: [],
      emergency: [],
    };
    const out = projectVisibleQuestionnaireAnswers(contactsSchema, {
      'contacts.bundle': empty,
    });
    expect(out['contacts.bundle']).toEqual(empty);
  });

  it('omits absent bundle key', () => {
    const out = projectVisibleQuestionnaireAnswers(contactsSchema, {});
    expect(Object.keys(out)).toHaveLength(0);
  });
});

describe('valueType allowlist', () => {
  it('rejects unknown valueType', () => {
    const bad: QuestionnaireSchemaJson = {
      code: 't',
      version: 1,
      title: 'T',
      steps: [
        {
          key: 's',
          label: 'S',
          fields: [
            {
              key: 'x',
              label: 'X',
              valueType: 'contacts_bunlde' as QuestionnaireSchemaField['valueType'],
              requiredPolicy: 'voluntary',
            },
          ],
        },
      ],
    };
    const r = validateQuestionnaireSchema(bad);
    expect(r.ok).toBe(false);
  });
});
