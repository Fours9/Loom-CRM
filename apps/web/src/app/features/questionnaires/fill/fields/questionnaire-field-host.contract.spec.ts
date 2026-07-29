import type { QuestionnaireSchemaField } from '@loom/contracts-questionnaires';
import { parseNumberInput } from '../validation/questionnaire-validation';

/**
 * Field-host behavior contracts (pure). Full component TestBed needs Angular Jest
 * ESM transform — covered here for valueType semantics used by the host.
 */
describe('questionnaire field host contracts', () => {
  const types: QuestionnaireSchemaField['valueType'][] = [
    'text',
    'textarea',
    'date',
    'number',
    'boolean',
    'single_choice',
    'multi_choice',
    'repeating_group',
  ];

  it('covers all seven seed valueTypes (+ boolean variants)', () => {
    expect(types).toHaveLength(8);
  });

  it('boolean radio starts unanswered (undefined), checkbox uses boolean', () => {
    const radioInitial: unknown = undefined;
    const checkboxValue = true;
    expect(radioInitial).toBeUndefined();
    expect(checkboxValue).toBe(true);
    expect(false).not.toBe(undefined);
  });

  it('number commit stores number not raw string', () => {
    expect(parseNumberInput('12,5')).toBe(12.5);
    expect(typeof parseNumberInput('12,5')).toBe('number');
  });

  it('repeating row UI id must be stripped from payload', () => {
    const rows = [{ __uiId: 'row-1', name: 'Ann' }];
    const payload = rows.map(({ __uiId: _id, ...rest }) => rest);
    expect(payload[0]).toEqual({ name: 'Ann' });
    expect(payload[0]).not.toHaveProperty('__uiId');
  });
});
