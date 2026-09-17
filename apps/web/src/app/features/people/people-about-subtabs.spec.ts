import {
  PLANNED_ABOUT_SUBTABS,
  resolvePeopleAboutSubtab,
  visiblePeopleAboutSubtabs,
} from './people-about-subtabs';

describe('people-about-subtabs', () => {
  it('plans six subtabs from questionnaire soft blocks', () => {
    expect(PLANNED_ABOUT_SUBTABS.map((t) => t.id)).toEqual([
      'family_home',
      'celebrations',
      'hobbies',
      'strengths',
      'work_style',
      'life_goals',
    ]);
  });

  it('does not render subtabs yet', () => {
    expect(visiblePeopleAboutSubtabs()).toEqual([]);
    expect(resolvePeopleAboutSubtab('hobbies', [])).toBeNull();
  });

  it('covers family/hobbies/strengths/work_style sections', () => {
    const sections = new Set(
      PLANNED_ABOUT_SUBTABS.flatMap((t) => t.questionnaireSections),
    );
    expect(sections.has('family')).toBe(true);
    expect(sections.has('hobbies')).toBe(true);
    expect(sections.has('strengths')).toBe(true);
    expect(sections.has('work_style')).toBe(true);
    expect(sections.has('celebration_dates')).toBe(true);
  });
});
