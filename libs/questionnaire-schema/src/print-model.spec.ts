import type { QuestionnaireSchemaJson } from '@loom/contracts-questionnaires';
import {
  BLANK_CONTACTS_EMERGENCY_ROWS,
  BLANK_SKILLS_MATRIX_ROWS,
  PAPER_FORM_MIN_ROWS,
  QUESTIONNAIRE_PRINT_LAYOUT_VERSION,
  REPEATING_TEXTAREA_LINES,
  TEXTAREA_PAPER_LINES,
} from '@loom/contracts-questionnaires';
import { SKILL_DEFINITIONS } from '@loom/position-skill-catalog';
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
          key: 'personal.notes',
          label: 'Нотатки',
          valueType: 'textarea',
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
            {
              key: 'status',
              label: 'Статус',
              valueType: 'single_choice',
              options: [
                { value: 'done', label: 'Виконано' },
                { value: 'planned', label: 'Заплановано' },
              ],
            },
            {
              key: 'completed',
              label: 'Виконано',
              valueType: 'boolean',
              uiControl: 'checkbox',
            },
            {
              key: 'description',
              label: 'Опис',
              valueType: 'textarea',
            },
          ],
        },
        {
          key: 'consent.ok',
          label: 'Згода',
          valueType: 'boolean',
        },
        {
          key: 'consent.check',
          label: 'Підтверджую',
          valueType: 'boolean',
          uiControl: 'checkbox',
        },
        {
          key: 'contacts',
          label: 'Контакти',
          valueType: 'contacts_bundle',
        },
        {
          key: 'skills.matrix',
          label: 'Навички',
          valueType: 'position_skills_matrix',
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

describe('buildQuestionnairePrintModel (layout 2.4)', () => {
  it('uses layout version 2.4', () => {
    expect(QUESTIONNAIRE_PRINT_LAYOUT_VERSION).toBe('2.4');
  });

  it('blank includes all top-level keys (ignores visibleWhen)', () => {
    const model = buildQuestionnairePrintModel({
      schema: miniSchema,
      answers: {},
      mode: 'blank',
      meta: baseMeta,
      formatContext: noopFormat,
    });
    const keys = listPrintModelFieldKeys(model);
    expect(keys).toEqual(listTopLevelFields(miniSchema).map((f) => f.key));
    const repeating = model.steps[0].fields.find(
      (f) => f.key === 'family.children',
    );
    expect(repeating?.kind).toBe('repeating_table');
    if (repeating?.kind === 'repeating_table') {
      expect(repeating.rows.length).toBe(PAPER_FORM_MIN_ROWS);
      expect(repeating.rows[0].cells[0].kind).toBe('text_line');
      if (repeating.rows[0].cells[0].kind === 'text_line') {
        expect(repeating.rows[0].cells[0].value).toBeNull();
      }
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
    expect(consent?.kind).toBe('choice_list');
    if (consent?.kind === 'choice_list') {
      expect(consent.exclusive).toBe(true);
      expect(consent.options.find((o) => o.value === 'true')?.checked).toBe(
        true,
      );
    }
  });

  it('boolean checkbox ≠ yes/no choice_list', () => {
    const model = buildQuestionnairePrintModel({
      schema: miniSchema,
      answers: { 'consent.check': true, 'consent.ok': false },
      mode: 'filled',
      meta: baseMeta,
      formatContext: noopFormat,
    });
    const check = model.steps[0].fields.find((f) => f.key === 'consent.check');
    const radio = model.steps[0].fields.find((f) => f.key === 'consent.ok');
    expect(check?.kind).toBe('checkbox_item');
    expect(radio?.kind).toBe('choice_list');
    if (check?.kind === 'checkbox_item') {
      expect(check.checked).toBe(true);
    }
  });

  it('blank textarea uses TEXTAREA_PAPER_LINES', () => {
    const model = buildQuestionnairePrintModel({
      schema: miniSchema,
      answers: {},
      mode: 'blank',
      meta: baseMeta,
      formatContext: noopFormat,
    });
    const notes = model.steps[0].fields.find((f) => f.key === 'personal.notes');
    expect(notes?.kind).toBe('text_box');
    if (notes?.kind === 'text_box') {
      expect(notes.lines).toBe(TEXTAREA_PAPER_LINES);
      expect(notes.value).toBeNull();
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
    expect(name?.kind).toBe('text_line');
    if (name?.kind === 'text_line') {
      expect(name.value).toBe('Іван');
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
    expect(name?.kind).toBe('text_line');
    if (name?.kind === 'text_line') {
      expect(name.value).toBeNull();
    }
  });

  it('filled repeating pads to minimum and keeps nested paper controls', () => {
    const model = buildQuestionnairePrintModel({
      schema: miniSchema,
      answers: {
        'family.has_children': 'yes',
        'family.children': [
          {
            name: 'Оля',
            status: 'done',
            completed: true,
            description: 'Довгий текст',
          },
        ],
      },
      mode: 'filled',
      meta: baseMeta,
      formatContext: noopFormat,
    });
    const repeating = model.steps[0].fields.find(
      (f) => f.key === 'family.children',
    );
    expect(repeating?.kind).toBe('repeating_table');
    if (repeating?.kind === 'repeating_table') {
      expect(repeating.rows.length).toBe(PAPER_FORM_MIN_ROWS);
      const cells = repeating.rows[0].cells;
      expect(cells.find((c) => c.key === 'status')?.kind).toBe('choice_list');
      const status = cells.find((c) => c.key === 'status');
      if (status?.kind === 'choice_list') {
        expect(status.options.find((o) => o.value === 'done')?.checked).toBe(
          true,
        );
        expect(status.options.every((o) => typeof o.checked === 'boolean')).toBe(
          true,
        );
      }
      expect(cells.find((c) => c.key === 'completed')?.kind).toBe(
        'checkbox_item',
      );
      const desc = cells.find((c) => c.key === 'description');
      expect(desc?.kind).toBe('text_box');
      if (desc?.kind === 'text_box') {
        expect(desc.lines).toBe(REPEATING_TEXTAREA_LINES);
        expect(desc.value).toBe('Довгий текст');
      }
      // spare empty row
      const spare = repeating.rows[1].cells.find((c) => c.key === 'name');
      if (spare?.kind === 'text_line') {
        expect(spare.value).toBeNull();
      }
    }
  });

  it('blank choice_list has all options unchecked', () => {
    const model = buildQuestionnairePrintModel({
      schema: miniSchema,
      answers: {},
      mode: 'blank',
      meta: baseMeta,
      formatContext: noopFormat,
    });
    const choice = model.steps[0].fields.find(
      (f) => f.key === 'family.has_children',
    );
    expect(choice?.kind).toBe('choice_list');
    if (choice?.kind === 'choice_list') {
      expect(choice.options.length).toBe(2);
      expect(choice.options.every((o) => o.checked === false)).toBe(true);
      expect(choice.layout ?? 'vertical').toBe('vertical');
    }
  });

  it('company_work status/schedule/contract_type use horizontal choice layout', () => {
    const schema: QuestionnaireSchemaJson = {
      code: 'cw',
      version: 1,
      title: 'CW',
      steps: [
        {
          key: 'company_work',
          label: 'Робота в компанії',
          fields: [
            {
              key: 'company_work.status',
              label: 'Статус',
              valueType: 'multi_choice',
              options: [
                { value: 'active', label: 'Активний' },
                { value: 'leave', label: 'Відпустка' },
              ],
            },
            {
              key: 'company_work.schedule',
              label: 'Графік',
              valueType: 'multi_choice',
              options: [
                { value: 'flexible', label: 'Гнучкий' },
              ],
            },
            {
              key: 'company_work.contract_type',
              label: 'Тип оформлення',
              valueType: 'multi_choice',
              options: [
                { value: 'staff', label: 'Штат' },
                { value: 'fop', label: 'ФОП' },
              ],
            },
            {
              key: 'company_work.other_choice',
              label: 'Інше',
              valueType: 'single_choice',
              options: [
                { value: 'a', label: 'A' },
                { value: 'b', label: 'B' },
              ],
            },
          ],
        },
      ],
    };
    const model = buildQuestionnairePrintModel({
      schema,
      answers: {},
      mode: 'blank',
      meta: { ...baseMeta, templateCode: 'cw', title: 'CW' },
      formatContext: noopFormat,
    });
    for (const key of [
      'company_work.status',
      'company_work.schedule',
      'company_work.contract_type',
    ]) {
      const f = model.steps[0].fields.find((x) => x.key === key);
      expect(f?.kind).toBe('choice_list');
      if (f?.kind === 'choice_list') {
        expect(f.layout).toBe('horizontal');
      }
    }
    const other = model.steps[0].fields.find(
      (x) => x.key === 'company_work.other_choice',
    );
    expect(other?.kind).toBe('choice_list');
    if (other?.kind === 'choice_list') {
      expect(other.layout ?? 'vertical').toBe('vertical');
    }
  });

  it('blank contacts expose work/personal/emergency without notes', () => {
    const model = buildQuestionnairePrintModel({
      schema: miniSchema,
      answers: {},
      mode: 'blank',
      meta: baseMeta,
      formatContext: noopFormat,
    });
    const contacts = model.steps[0].fields.find((f) => f.key === 'contacts');
    expect(contacts?.kind).toBe('contacts_form');
    if (contacts?.kind === 'contacts_form') {
      expect(contacts.work).toHaveLength(3);
      expect(contacts.personal.some((p) => p.contactType === 'personal_phone'))
        .toBe(true);
      expect(contacts.personal.some((p) => p.contactType === 'personal_email'))
        .toBe(true);
      expect(
        contacts.personal.some((p) => p.contactType === 'personal_telegram'),
      ).toBe(true);
      expect(contacts.emergency).toHaveLength(BLANK_CONTACTS_EMERGENCY_ROWS);
      expect(contacts.emergency[0].controls).toHaveLength(4);
      expect(contacts.emergency[0].controls[3].key).toContain('secondaryPhone');
      expect(
        contacts.emergency[0].controls.every((c) => !c.key.includes('notes')),
      ).toBe(true);
    }
  });

  it('filled emergency preserves secondaryPhone; omits notes from PDF', () => {
    const model = buildQuestionnairePrintModel({
      schema: miniSchema,
      answers: {
        contacts: {
          work: { email: null, phone: null, telegram: null },
          personal: [],
          emergency: [
            {
              fullName: 'Ann',
              relationship: 'Sister',
              primaryPhone: '111',
              secondaryPhone: '222',
              notes: 'Call after 18:00',
            },
          ],
        },
      },
      mode: 'filled',
      meta: baseMeta,
      formatContext: noopFormat,
    });
    const contacts = model.steps[0].fields.find((f) => f.key === 'contacts');
    expect(contacts?.kind).toBe('contacts_form');
    if (contacts?.kind === 'contacts_form') {
      const em = contacts.emergency[0].controls;
      expect(em).toHaveLength(4);
      expect(em[0].kind === 'text_line' && em[0].value).toBe('Ann');
      expect(em[3].kind === 'text_line' && em[3].value).toBe('222');
      expect(em.every((c) => !c.key.includes('notes'))).toBe(true);
      // pad personal per type even when empty
      expect(
        contacts.personal.filter((p) => p.contactType === 'personal_email')
          .length,
      ).toBeGreaterThanOrEqual(1);
    }
  });

  it('personal padding is per contact type', () => {
    const model = buildQuestionnairePrintModel({
      schema: miniSchema,
      answers: {
        contacts: {
          work: { email: null, phone: null, telegram: null },
          personal: [
            { type: 'personal_phone', value: '1', isPrimary: true },
            { type: 'personal_phone', value: '2', isPrimary: false },
            { type: 'personal_phone', value: '3', isPrimary: false },
          ],
          emergency: [],
        },
      },
      mode: 'filled',
      meta: baseMeta,
      formatContext: noopFormat,
    });
    const contacts = model.steps[0].fields.find((f) => f.key === 'contacts');
    if (contacts?.kind === 'contacts_form') {
      expect(
        contacts.personal.filter((p) => p.contactType === 'personal_phone')
          .length,
      ).toBe(3);
      expect(
        contacts.personal.filter((p) => p.contactType === 'personal_email')
          .length,
      ).toBeGreaterThanOrEqual(1);
      expect(
        contacts.personal.filter((p) => p.contactType === 'personal_telegram')
          .length,
      ).toBeGreaterThanOrEqual(1);
    }
  });

  it('blank skills_matrix uses freehand rows without registry', () => {
    const model = buildQuestionnairePrintModel({
      schema: miniSchema,
      answers: {},
      mode: 'blank',
      meta: baseMeta,
      formatContext: noopFormat,
    });
    const matrix = model.steps[0].fields.find((f) => f.key === 'skills.matrix');
    expect(matrix?.kind).toBe('skills_matrix');
    if (matrix?.kind === 'skills_matrix') {
      expect(matrix.rows).toHaveLength(BLANK_SKILLS_MATRIX_ROWS);
      expect(matrix.rows.every((r) => r.identity.kind === 'blank')).toBe(true);
      expect(matrix.rows.every((r) => r.rating.kind === 'freehand')).toBe(true);
      expect(matrix.rows.length).not.toBe(SKILL_DEFINITIONS.length);
    }
  });

  it('filled context=null uses legacy SKILL_DEFINITIONS and maps ratings/custom', () => {
    const model = buildQuestionnairePrintModel({
      schema: miniSchema,
      answers: {
        'skills.matrix': {
          ratings: [
            { skillCode: 'sewing', level: 4, comment: 'ok' },
          ],
          custom: [{ name: 'Оверлок', level: 3, comment: 'custom note' }],
        },
      },
      mode: 'filled',
      meta: baseMeta,
      formatContext: {
        ...noopFormat,
        matrixCatalogSkills: null,
        matrixContextVersion: null,
      },
    });
    const matrix = model.steps[0].fields.find((f) => f.key === 'skills.matrix');
    expect(matrix?.kind).toBe('skills_matrix');
    if (matrix?.kind === 'skills_matrix') {
      expect(
        matrix.rows.filter((r) => r.identity.kind === 'catalog').length,
      ).toBe(SKILL_DEFINITIONS.length);
      const sewing = matrix.rows.find(
        (r) => r.identity.kind === 'catalog' && r.identity.code === 'sewing',
      );
      expect(sewing?.rating.kind).toBe('choice_scale');
      if (sewing?.rating.kind === 'choice_scale') {
        expect(sewing.rating.options.find((o) => o.value === 4)?.checked).toBe(
          true,
        );
      }
      expect(sewing?.comment).toBe('ok');
      const custom = matrix.rows.find((r) => r.identity.kind === 'custom');
      expect(custom?.label).toBe('Оверлок');
      expect(custom?.comment).toBe('custom note');
    }
  });

  it('filled frozen context uses per-skill scales (mixed % and 0..5)', () => {
    const model = buildQuestionnairePrintModel({
      schema: miniSchema,
      answers: {
        'skills.matrix': {
          ratings: [
            { skillCode: 'pct', level: 82, comment: null },
            { skillCode: 'rng', level: 4, comment: null },
          ],
          custom: [],
        },
      },
      mode: 'filled',
      meta: baseMeta,
      formatContext: {
        ...noopFormat,
        matrixContextVersion: 2,
        matrixCatalogSkills: [
          {
            code: 'pct',
            labelUa: 'Швидкість',
            scaleKind: 'percent',
            scaleMin: 0,
            scaleMax: 100,
          },
          {
            code: 'rng',
            labelUa: 'Якість',
            scaleKind: 'range',
            scaleMin: 0,
            scaleMax: 5,
          },
        ],
      },
    });
    const matrix = model.steps[0].fields.find((f) => f.key === 'skills.matrix');
    if (matrix?.kind === 'skills_matrix') {
      const pct = matrix.rows.find(
        (r) => r.identity.kind === 'catalog' && r.identity.code === 'pct',
      );
      const rng = matrix.rows.find(
        (r) => r.identity.kind === 'catalog' && r.identity.code === 'rng',
      );
      expect(pct?.rating.kind).toBe('number');
      if (pct?.rating.kind === 'number') {
        expect(pct.rating.value).toBe(82);
        expect(pct.rating.unit).toBe('%');
      }
      expect(rng?.rating.kind).toBe('choice_scale');
    }
  });

  it('coalesces career_goals + probation_goals into one Цілі print section', () => {
    const model = buildQuestionnairePrintModel({
      schema: {
        code: 'employee-managing',
        version: 1,
        title: 'Managing',
        steps: [
          {
            key: 'skills',
            label: 'Матриця навичок',
            fields: [
              {
                key: 'skills.matrix',
                label: 'Матриця',
                valueType: 'position_skills_matrix',
                requiredPolicy: 'voluntary',
              },
            ],
          },
          {
            key: 'career_goals',
            label: "Кар'єрні цілі та розвиток",
            fields: [
              {
                key: 'career_goals.plan',
                label: "Кар'єрні цілі та розвиток",
                valueType: 'repeating_group',
                requiredPolicy: 'voluntary',
                children: [
                  {
                    key: 'title',
                    label: 'Ціль',
                    valueType: 'text',
                    requiredPolicy: 'voluntary',
                  },
                ],
              },
            ],
          },
          {
            key: 'probation_goals',
            label: 'Цілі на випробувальний термін',
            fields: [
              {
                key: 'probation_goals.items',
                label: 'Цілі на випробувальний термін',
                valueType: 'repeating_group',
                requiredPolicy: 'voluntary',
                children: [
                  {
                    key: 'title',
                    label: 'Ціль',
                    valueType: 'text',
                    requiredPolicy: 'voluntary',
                  },
                ],
              },
            ],
          },
        ],
      },
      answers: {},
      mode: 'blank',
      meta: baseMeta,
      formatContext: noopFormat,
    });

    expect(model.steps.map((s) => s.key)).toEqual(['skills', 'goals']);
    const goals = model.steps.find((s) => s.key === 'goals');
    expect(goals?.label).toBe('Цілі');
    expect(goals?.fields.map((f) => f.key)).toEqual([
      'career_goals.plan',
      'probation_goals.items',
    ]);
  });
});
