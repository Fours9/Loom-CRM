import {
  isSectionCompleted,
  isSectionPassed,
  isStepCompleted,
  isStepPassed,
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

describe('questionnaire section rail passed vs done', () => {
  it('read-only: last section → prior sections passed; incomplete substeps not done', () => {
    const completed = new Set<string>(['identity']); // education missing
    const activeSectionId = 'review';

    expect(isSectionPassed(sections, activeSectionId, 'intro')).toBe(true);
    expect(isSectionPassed(sections, activeSectionId, 'personal')).toBe(true);
    expect(isSectionPassed(sections, activeSectionId, 'work')).toBe(true);
    expect(isSectionPassed(sections, activeSectionId, 'review')).toBe(false);

    expect(isSectionCompleted(sections[0], completed)).toBe(false); // intro only
    expect(isSectionCompleted(sections[1], completed)).toBe(false); // education incomplete
    expect(isSectionCompleted(sections[2], completed)).toBe(false);
    expect(isSectionCompleted(sections[3], completed)).toBe(false); // review only

    expect(isStepCompleted('identity', completed)).toBe(true);
    expect(isStepCompleted('education', completed)).toBe(false);
    expect(isStepCompleted('__intro__', completed)).toBe(false);
    expect(isStepCompleted('__review__', completed)).toBe(false);
  });

  it('spine progress follows position, not completion', () => {
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
