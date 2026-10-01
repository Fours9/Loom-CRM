import { projectEmployeeAbout } from './project';
import { validateAboutSubtabPatch } from './validate';
import { AboutValidationError } from './types';

describe('validateAboutSubtabPatch', () => {
  it('rejects unknown key for subtab', () => {
    expect(() =>
      validateAboutSubtabPatch({
        subtabId: 'hobbies',
        values: { 'family.pets': 'x' },
      }),
    ).toThrow(AboutValidationError);
  });

  it('rejects invalid option', () => {
    expect(() =>
      validateAboutSubtabPatch({
        subtabId: 'hobbies',
        values: { 'hobbies.shirt_size': 'huge' },
      }),
    ).toThrow(AboutValidationError);
  });

  it('null becomes clearKeys', () => {
    const r = validateAboutSubtabPatch({
      subtabId: 'hobbies',
      values: { 'hobbies.other': null },
    });
    expect(r.clearKeys).toEqual(['hobbies.other']);
    expect(r.set).toEqual({});
  });

  it('validates repeating_group children recursively', () => {
    expect(() =>
      validateAboutSubtabPatch({
        subtabId: 'family_home',
        values: {
          'family.children': [{ name: 'A', birth_date: 'not-a-date' }],
        },
      }),
    ).toThrow(AboutValidationError);
  });
});

describe('projectEmployeeAbout', () => {
  it('maps known option to UA label', () => {
    const r = projectEmployeeAbout({
      answers: { 'family.has_children': 'yes' },
    });
    const field = r.subtabs
      .find((s) => s.id === 'family_home')!
      .fields.find((f) => f.key === 'family.has_children')!;
    expect(field.displayValue).toBe('Так');
  });

  it('projects life_goals career + probation repeating children from catalog', () => {
    const r = projectEmployeeAbout({ answers: {} });
    const life = r.subtabs.find((s) => s.id === 'life_goals')!;
    expect(life.fields.map((f) => f.key)).toEqual([
      'strengths.in_one_year',
      'strengths.in_two_to_three_years',
      'career_goals.plan',
      'probation_goals.items',
    ]);
    const career = life.fields.find((f) => f.key === 'career_goals.plan')!;
    const probation = life.fields.find((f) => f.key === 'probation_goals.items')!;
    expect(career.valueType).toBe('repeating_group');
    expect(career.children?.map((c) => c.key)).toEqual([
      'title',
      'description',
      'targetDate',
    ]);
    expect(probation.children?.map((c) => c.key)).toEqual([
      'title',
      'description',
      'dueDate',
      'status',
    ]);
  });

  it('accepts life_goals repeating patch for career and probation', () => {
    const r = validateAboutSubtabPatch({
      subtabId: 'life_goals',
      values: {
        'career_goals.plan': [
          { title: 'Lead', description: 'Grow', targetDate: '2027-01-01' },
        ],
        'probation_goals.items': [
          {
            title: 'Onboard',
            description: 'First 90 days',
            dueDate: '2026-12-01',
            status: 'planned',
          },
        ],
      },
    });
    expect(r.clearKeys).toEqual([]);
    expect(Object.keys(r.set).sort()).toEqual([
      'career_goals.plan',
      'probation_goals.items',
    ]);
  });
});
