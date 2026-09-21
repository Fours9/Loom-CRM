import { canonicalizeAboutMutation } from '@loom/employee-about-catalog';
import { EmployeeAboutFacade } from './employee-about.facade';
import type { EntityManager } from 'typeorm';

describe('EmployeeAboutFacade.mergeAnswers', () => {
  it('no-ops when set and clearKeys are empty', async () => {
    const query = jest.fn();
    const manager = { query } as unknown as EntityManager;
    const facade = new EmployeeAboutFacade();
    await facade.mergeAnswers(manager, 'e1', {
      set: {},
      clearKeys: [],
      source: { kind: 'manual', actorUserId: 'u1' },
    });
    expect(query).not.toHaveBeenCalled();
  });

  it('passes clearKeys from canonicalize for has_children=no', () => {
    const { set, clearKeys } = canonicalizeAboutMutation({
      'family.has_children': 'no',
    });
    expect(set['family.has_children']).toBe('no');
    expect(clearKeys).toContain('family.children');
  });
});
