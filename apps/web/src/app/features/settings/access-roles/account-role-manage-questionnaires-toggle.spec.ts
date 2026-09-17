/**
 * Mirrors Settings dialog TOGGLE_EXTRAS strip/re-add for Manage questionnaires triad.
 */
const TOGGLE_EXTRAS = [
  'questionnaires.assign',
  'questionnaires.manage_lifecycle',
  'questionnaires.delete',
  'questionnaires.apply_profile_changes',
] as const;

const L = 'questionnaires.manage_lifecycle';
const D = 'questionnaires.delete';
const A = 'questionnaires.apply_profile_changes';

describe('account-role Manage questionnaires toggle extras', () => {
  it('strips all three when Manage OFF', () => {
    const existing = ['documents.view', L, D, A, 'questionnaires.assign'];
    const extras = new Set(
      existing.filter((p) => !(TOGGLE_EXTRAS as readonly string[]).includes(p)),
    );
    expect([...extras].sort()).toEqual(['documents.view'].sort());
  });

  it('re-adds triad when Manage ON', () => {
    const existing = ['documents.view', L, D];
    const extras = new Set(
      existing.filter((p) => !(TOGGLE_EXTRAS as readonly string[]).includes(p)),
    );
    extras.add(L);
    extras.add(D);
    extras.add(A);
    expect(extras.has(L)).toBe(true);
    expect(extras.has(D)).toBe(true);
    expect(extras.has(A)).toBe(true);
    expect(extras.has('documents.view')).toBe(true);
  });
});
