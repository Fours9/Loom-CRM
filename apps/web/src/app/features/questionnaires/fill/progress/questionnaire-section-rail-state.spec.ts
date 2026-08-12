import {
  isSectionPassed,
  isSectionVisited,
  isStepPassed,
  isStepVisited,
  sectionSpineProgress,
} from './questionnaire-section-rail-state';
import type { ProgressSection } from './questionnaire-section-map';

const sections: ProgressSection[] = [
  {
    id: 'intro',
    label: 'Вступ',
    steps: [{ key: '__intro__', label: 'Вступ' }],
  },
  {
    id: 'personal',
    label: 'Особисті',
    steps: [
      { key: 'identity', label: 'Особа' },
      { key: 'education', label: 'Освіта' },
    ],
  },
  {
    id: 'work',
    label: 'Робота',
    steps: [{ key: 'work', label: 'Робота' }],
  },
  {
    id: 'review',
    label: 'Перегляд',
    steps: [{ key: '__review__', label: 'Перегляд' }],
  },
];

describe('questionnaire section rail visit vs passed', () => {
  it('section/step dots fill only from visits, not position', () => {
    const visited = new Set<string>(['__intro__', 'identity']);
    const activeSectionId = 'personal';

    expect(isSectionPassed(sections, activeSectionId, 'intro')).toBe(true);
    expect(isSectionPassed(sections, activeSectionId, 'work')).toBe(false);

    expect(isSectionVisited(sections[0], visited)).toBe(true);
    expect(isSectionVisited(sections[1], visited)).toBe(true); // identity visited
    expect(isSectionVisited(sections[2], visited)).toBe(false);
    expect(isSectionVisited(sections[3], visited)).toBe(false);

    expect(isStepVisited('__intro__', visited)).toBe(true);
    expect(isStepVisited('identity', visited)).toBe(true);
    expect(isStepVisited('education', visited)).toBe(false);
    expect(isStepVisited('work', visited)).toBe(false);
  });

  it('spine progress follows position, not visit', () => {
    expect(sectionSpineProgress(sections, 'intro')).toBe('0%');
    expect(sectionSpineProgress(sections, 'review')).toBe('100%');
  });

  it('step passed is position within active section', () => {
    const personal = sections[1]!.steps;
    expect(isStepPassed(personal, 'education', 'identity')).toBe(true);
    expect(isStepPassed(personal, 'education', 'education')).toBe(false);
    expect(isStepPassed(personal, 'identity', 'education')).toBe(false);
  });
});
