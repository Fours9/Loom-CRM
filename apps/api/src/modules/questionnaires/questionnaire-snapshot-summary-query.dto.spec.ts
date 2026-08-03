import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { QuestionnaireSnapshotSummaryQueryDto } from './questionnaire.dto';

describe('QuestionnaireSnapshotSummaryQueryDto', () => {
  function validate(raw: Record<string, unknown>) {
    const dto = plainToInstance(QuestionnaireSnapshotSummaryQueryDto, raw);
    return validateSync(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
  }

  it('accepts missing assignmentId', () => {
    expect(validate({})).toHaveLength(0);
  });

  it('accepts valid UUID assignmentId', () => {
    expect(
      validate({ assignmentId: '550e8400-e29b-41d4-a716-446655440000' }),
    ).toHaveLength(0);
  });

  it('rejects malformed assignmentId', () => {
    const errors = validate({ assignmentId: 'not-a-uuid' });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.property).toBe('assignmentId');
  });

  it('rejects empty assignmentId string', () => {
    const errors = validate({ assignmentId: '' });
    expect(errors.length).toBeGreaterThan(0);
  });
});
