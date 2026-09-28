import {
  isSectionPassed,
  isStepPassed,
  sectionSpineProgress,
  substepSpineProgress,
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

describe('questionnaire section rail position trail', () => {
  it('lights all sections before the active one (even if never opened)', () => {
    expect(isSectionPassed(sections, 'work', 'intro')).toBe(true);
    expect(isSectionPassed(sections, 'work', 'personal')).toBe(true);
    expect(isSectionPassed(sections, 'work', 'work')).toBe(false);
    expect(isSectionPassed(sections, 'work', 'review')).toBe(false);
  });

  it('spine progress follows position', () => {
    expect(sectionSpineProgress(sections, 'intro')).toBe('0%');
    expect(sectionSpineProgress(sections, 'review')).toBe('100%');
    expect(substepSpineProgress(sections[1]!.steps, 'education')).toBe('100%');
  });

  it('lights all substeps before the active step', () => {
    const personal = sections[1]!.steps;
    expect(isStepPassed(personal, 'education', 'identity')).toBe(true);
    expect(isStepPassed(personal, 'education', 'education')).toBe(false);
    expect(isStepPassed(personal, 'identity', 'education')).toBe(false);
  });
});
