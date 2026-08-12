import { QuestionnaireTypeTaxonomy1730000017000 } from '../../../platform/database/migrations/1730000017000-QuestionnaireTypeTaxonomy';
import { QuestionnaireTypeFullCollapse1730000018000 } from '../../../platform/database/migrations/1730000018000-QuestionnaireTypeFullCollapse';

describe('QuestionnaireTypeTaxonomy1730000017000', () => {
  it('down() fails closed', async () => {
    const m = new QuestionnaireTypeTaxonomy1730000017000();
    await expect(m.down({} as never)).rejects.toThrow(
      /Cannot rollback questionnaire type taxonomy/,
    );
  });

  it('up() fails when legacy types remain after remap', async () => {
    const m = new QuestionnaireTypeTaxonomy1730000017000();
    const queryRunner = {
      query: jest
        .fn()
        .mockResolvedValueOnce(undefined) // drop check
        .mockResolvedValueOnce(undefined) // employee-360 → primary
        .mockResolvedValueOnce(undefined) // manager → managing
        .mockResolvedValueOnce([{ count: '1' }]), // leftover hr/full
    };
    await expect(m.up(queryRunner as never)).rejects.toThrow(
      /unexpected legacy template types/,
    );
  });
});

describe('QuestionnaireTypeFullCollapse1730000018000', () => {
  it('down() fails closed', async () => {
    const m = new QuestionnaireTypeFullCollapse1730000018000();
    await expect(m.down({} as never)).rejects.toThrow(
      /Cannot rollback questionnaire full collapse/,
    );
  });
});
