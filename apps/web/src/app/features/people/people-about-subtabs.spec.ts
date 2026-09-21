import {
  resolvePeopleAboutSubtab,
  visiblePeopleAboutSubtabs,
} from './people-about-subtabs';

describe('people-about-subtabs', () => {
  it('ships all six catalog subtabs', () => {
    expect(visiblePeopleAboutSubtabs().map((t) => t.id)).toEqual([
      'family_home',
      'celebrations',
      'hobbies',
      'strengths',
      'work_style',
      'life_goals',
    ]);
  });

  it('resolves requested or falls back to first', () => {
    const visible = visiblePeopleAboutSubtabs();
    expect(resolvePeopleAboutSubtab('hobbies', visible)).toBe('hobbies');
    expect(resolvePeopleAboutSubtab('nope', visible)).toBe('family_home');
  });
});
