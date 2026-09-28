import {
  buildQuestionnairePrintModel,
  listPrintModelFieldKeys,
  listTopLevelFields,
  QUESTIONNAIRE_PRINT_OMIT_FIELD_KEYS,
} from '@loom/questionnaire-schema';
import {
  BLANK_SKILLS_MATRIX_ROWS,
  PAPER_FORM_MIN_ROWS,
  QUESTIONNAIRE_PRINT_LAYOUT_VERSION,
  TEXTAREA_PAPER_LINES,
} from '@loom/contracts-questionnaires';
import { EMPLOYEE_360_V1_SCHEMA } from './employee-360-v1.schema';
import { EMPLOYEE_STARTER_V1_SCHEMA } from './employee-starter-v1.schema';
import { EMPLOYEE_MANAGING_V1_SCHEMA } from './employee-managing-v1.schema';
import { EMPLOYEE_DOCS_V1_SCHEMA } from './employee-docs-v1.schema';

const noopFormat = {
  resolveOrgLabel: (_f: unknown, v: unknown) =>
    v == null || v === '' ? '—' : String(v),
};

const meta = (title: string, code: string) => ({
  title,
  templateCode: code,
  templateTypeLabelUa: 'Test',
  generatedAtLabel: '01.01.2026 12:00',
  generatedByLabel: 'test@example.com',
  schemaVersion: 1,
  printLayoutVersion: QUESTIONNAIRE_PRINT_LAYOUT_VERSION,
});

describe('questionnaire print model — seed schemas', () => {
  const schemas = [
    EMPLOYEE_360_V1_SCHEMA,
    EMPLOYEE_STARTER_V1_SCHEMA,
    EMPLOYEE_MANAGING_V1_SCHEMA,
    EMPLOYEE_DOCS_V1_SCHEMA,
  ];

  it.each(schemas.map((s) => [s.code, s] as const))(
    '%s blank includes every printable top-level field as paper controls',
    (_code, schema) => {
      const model = buildQuestionnairePrintModel({
        schema,
        answers: {},
        mode: 'blank',
        meta: meta(schema.title, schema.code),
        formatContext: noopFormat,
      });
      const expected = listTopLevelFields(schema)
        .map((f) => f.key)
        .filter((k) => !QUESTIONNAIRE_PRINT_OMIT_FIELD_KEYS.has(k))
        .sort();
      expect(listPrintModelFieldKeys(model).sort()).toEqual(expected);
      expect(listPrintModelFieldKeys(model)).not.toContain(
        'company_work.mentor',
      );
      expect(listPrintModelFieldKeys(model)).not.toContain(
        'company_work.hr_responsible',
      );
      for (const step of model.steps) {
        for (const field of step.fields) {
          if (field.kind === 'choice_list') {
            expect(field.options.every((o) => o.checked === false)).toBe(true);
          }
          if (field.kind === 'text_box') {
            expect(field.lines).toBe(TEXTAREA_PAPER_LINES);
          }
          if (field.kind === 'repeating_table') {
            expect(field.rows.length).toBeGreaterThanOrEqual(
              Math.min(PAPER_FORM_MIN_ROWS, 1),
            );
            for (const row of field.rows) {
              for (const cell of row.cells) {
                expect([
                  'text_line',
                  'text_box',
                  'choice_list',
                  'checkbox_item',
                ]).toContain(cell.kind);
              }
            }
          }
          if (field.kind === 'skills_matrix') {
            expect(field.rows).toHaveLength(BLANK_SKILLS_MATRIX_ROWS);
            expect(
              field.rows.every(
                (r) =>
                  r.identity.kind === 'blank' && r.rating.kind === 'freehand',
              ),
            ).toBe(true);
          }
          if (field.kind === 'contacts_form') {
            expect(field.emergency[0]?.controls).toHaveLength(4);
          }
        }
      }
    },
  );

  it('employee-managing projects one Цілі print section with career + probation fields', () => {
    const model = buildQuestionnairePrintModel({
      schema: EMPLOYEE_MANAGING_V1_SCHEMA,
      answers: {},
      mode: 'blank',
      meta: meta(EMPLOYEE_MANAGING_V1_SCHEMA.title, EMPLOYEE_MANAGING_V1_SCHEMA.code),
      formatContext: noopFormat,
    });
    const goalsSteps = model.steps.filter((s) => s.key === 'goals');
    expect(goalsSteps).toHaveLength(1);
    expect(goalsSteps[0]?.label).toBe('Цілі');
    expect(goalsSteps[0]?.fields.map((f) => f.key).sort()).toEqual([
      'career_goals.plan',
      'probation_goals.items',
    ]);
    expect(model.steps.some((s) => s.key === 'career_goals')).toBe(false);
    expect(model.steps.some((s) => s.key === 'probation_goals')).toBe(false);
  });
});
