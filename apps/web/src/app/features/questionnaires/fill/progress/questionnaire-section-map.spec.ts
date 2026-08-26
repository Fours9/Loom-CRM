import {
  QUESTIONNAIRE_INTRO_STEP,
  QUESTIONNAIRE_REVIEW_STEP,
} from '../../navigation/questionnaire-step-keys';
import {
  buildProgressSections,
  findProgressSection,
} from './questionnaire-section-map';

describe('buildProgressSections', () => {
  const seedLike = [
    { key: 'profile_mirror', label: 'Особисті дані' },
    { key: 'contacts', label: 'Контакти' },
    { key: 'family', label: 'Сімейний стан' },
    { key: 'celebration_dates', label: 'Святкові дати' },
    { key: 'experience', label: 'Професійний досвід' },
    { key: 'education', label: 'Освіта та навчання' },
    { key: 'strengths', label: 'Сильні сторони та потенціал' },
    { key: 'hobbies', label: 'Хобі' },
    { key: 'work_style', label: 'Стиль роботи та комунікація' },
    { key: 'consents_review', label: 'Згода та підписи' },
  ];

  it('groups employee-360 by template map (education under personal)', () => {
    const sections = buildProgressSections({
      templateCode: 'employee-360',
      schemaSteps: seedLike,
    });
    expect(sections.map((s) => s.id)).toEqual([
      'intro',
      'personal',
      'work',
      'consents',
      'review',
    ]);
    expect(sections.find((s) => s.id === 'personal')!.steps.map((t) => t.key)).toEqual(
      [
        'profile_mirror',
        'contacts',
        'family',
        'celebration_dates',
        'education',
        'hobbies',
      ],
    );
    expect(sections.find((s) => s.id === 'work')!.steps.map((t) => t.key)).toEqual(
      [
        'experience',
        'strengths',
        'work_style',
      ],
    );
    expect(sections.at(-1)?.id).toBe('review');
  });

  it('does not apply employee-360 grouping for other template codes with same keys', () => {
    const sections = buildProgressSections({
      templateCode: 'other-template',
      schemaSteps: seedLike,
    });
    expect(sections.map((s) => s.id)).toEqual([
      'intro',
      ...seedLike.map((s) => `step:${s.key}`),
      'review',
    ]);
  });

  it('keeps leftovers in schema order before review', () => {
    const sections = buildProgressSections({
      templateCode: 'employee-360',
      schemaSteps: [
        ...seedLike,
        { key: 'extra_b', label: 'B' },
        { key: 'extra_a', label: 'A' },
      ],
    });
    const ids = sections.map((s) => s.id);
    const reviewIdx = ids.indexOf('review');
    expect(ids[reviewIdx - 2]).toBe('step:extra_b');
    expect(ids[reviewIdx - 1]).toBe('step:extra_a');
    expect(ids.at(-1)).toBe('review');
  });

  it('does not create empty section when optional mapped step is missing', () => {
    const withoutEducation = seedLike.filter((s) => s.key !== 'education');
    const sections = buildProgressSections({
      templateCode: 'employee-360',
      schemaSteps: withoutEducation,
    });
    const personal = sections.find((s) => s.id === 'personal')!;
    expect(personal.steps.map((t) => t.key)).toEqual([
      'profile_mirror',
      'contacts',
      'family',
      'celebration_dates',
      'hobbies',
    ]);
    expect(sections.every((s) => s.steps.length > 0)).toBe(true);
  });

  it('employee-starter is intro + review only', () => {
    const sections = buildProgressSections({
      templateCode: 'employee-starter',
      schemaSteps: [],
    });
    expect(sections.map((s) => s.id)).toEqual(['intro', 'review']);
    expect(sections[0]!.steps.map((t) => t.key)).toEqual([
      QUESTIONNAIRE_INTRO_STEP,
    ]);
    expect(sections[1]!.steps.map((t) => t.key)).toEqual([
      QUESTIONNAIRE_REVIEW_STEP,
    ]);
  });

  it('findProgressSection resolves by step key', () => {
    const sections = buildProgressSections({
      templateCode: 'employee-360',
      schemaSteps: seedLike,
    });
    expect(findProgressSection(sections, 'education')?.id).toBe('personal');
    expect(findProgressSection(sections, QUESTIONNAIRE_INTRO_STEP)?.id).toBe(
      'intro',
    );
    expect(findProgressSection(sections, QUESTIONNAIRE_REVIEW_STEP)?.id).toBe(
      'review',
    );
  });
});
