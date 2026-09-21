import { canonicalizeAboutMutation } from './canonicalize';

describe('canonicalizeAboutMutation', () => {
  it('clears family.children when has_children becomes no', () => {
    const r = canonicalizeAboutMutation({
      'family.has_children': 'no',
    });
    expect(r.clearKeys).toContain('family.children');
    expect(r.set['family.has_children']).toBe('no');
    expect(r.set['family.children']).toBeUndefined();
  });

  it('clears food_notes when food becomes none', () => {
    const r = canonicalizeAboutMutation({
      'hobbies.food': 'none',
    });
    expect(r.clearKeys).toContain('hobbies.food_notes');
  });

  it('does not clear children when has_children absent', () => {
    const r = canonicalizeAboutMutation({
      'family.pets': 'кіт',
    });
    expect(r.clearKeys).not.toContain('family.children');
  });

  it('does not clear children when has_children is yes', () => {
    const r = canonicalizeAboutMutation({
      'family.has_children': 'yes',
      'family.children': [{ name: 'Аня' }],
    });
    expect(r.clearKeys).not.toContain('family.children');
    expect(r.set['family.children']).toEqual([{ name: 'Аня' }]);
  });
});
