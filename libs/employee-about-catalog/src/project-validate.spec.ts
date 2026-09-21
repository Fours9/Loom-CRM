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

  it('unknown option is fail-safe', () => {
    const r = projectEmployeeAbout({
      answers: { 'family.has_children': 'legacy_maybe' },
    });
    const field = r.subtabs
      .find((s) => s.id === 'family_home')!
      .fields.find((f) => f.key === 'family.has_children')!;
    expect(field.displayValue).toBe('Невідоме значення: legacy_maybe');
  });
});
