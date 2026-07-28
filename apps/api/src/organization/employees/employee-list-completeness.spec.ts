import {
  buildProfileCompletenessFacts,
  computeProfileCompleteness,
} from './employee-profile-completeness';

describe('list core completeness parity helpers', () => {
  const baseEmployee = {
    firstName: 'Іван',
    lastName: 'Петренко',
    employeeNumber: 'E-1',
    phoneNumber: null as string | null,
    workEmail: 'w@ex.com',
    personalPhoneNumber: null as string | null,
    photoUrl: null as string | null,
    birthDate: null as string | null,
    city: null as string | null,
  };

  it('scores core the same for list-style facts (no emergency/dates)', () => {
    const withAssignment = computeProfileCompleteness(
      buildProfileCompletenessFacts({
        employee: baseEmployee,
        contacts: [],
        emergencyCount: 0,
        importantDatesCount: 0,
        assignment: {
          status: 'active',
          departmentId: 'd1',
          positionId: 'p1',
          startDate: '2024-01-01',
        },
      }),
    );

    const withEndedCurrent = computeProfileCompleteness(
      buildProfileCompletenessFacts({
        employee: baseEmployee,
        contacts: [],
        emergencyCount: 0,
        importantDatesCount: 0,
        assignment: {
          status: 'ended',
          departmentId: 'd1',
          positionId: 'p1',
          startDate: '2024-01-01',
        },
      }),
    );

    expect(withAssignment.core.percent).toBeGreaterThan(
      withEndedCurrent.core.percent,
    );
  });

  it('counts legacy phoneNumber without contact row', () => {
    const scored = computeProfileCompleteness(
      buildProfileCompletenessFacts({
        employee: { ...baseEmployee, workEmail: null, phoneNumber: '+380' },
        contacts: [],
        emergencyCount: 0,
        importantDatesCount: 0,
        assignment: {
          status: 'active',
          departmentId: 'd1',
          positionId: 'p1',
          startDate: '2024-01-01',
        },
      }),
    );
    expect(scored.core.sections['workContacts']?.complete).toBe(true);
  });

  it('numeric completeness sort is not lexicographic', () => {
    const rows = [
      { id: 'a', score: 100, name: 'А', number: '2' },
      { id: 'b', score: 25, name: 'Б', number: '1' },
      { id: 'c', score: 5, name: 'В', number: '3' },
    ];
    const dir = 1;
    rows.sort((a, b) => {
      const scoreDiff = a.score - b.score;
      if (scoreDiff !== 0) return scoreDiff * dir;
      return a.name.localeCompare(b.name, 'uk-UA');
    });
    expect(rows.map((r) => r.score)).toEqual([5, 25, 100]);
  });

  it('tie-break keeps alphabetical name regardless of score dir', () => {
    const rows = [
      { id: 'a', score: 50, name: 'Янко', number: '2' },
      { id: 'b', score: 50, name: 'Анна', number: '1' },
    ];
    for (const dir of [1, -1] as const) {
      const copy = [...rows];
      copy.sort((a, b) => {
        const scoreDiff = a.score - b.score;
        if (scoreDiff !== 0) return scoreDiff * dir;
        const nameDiff = a.name.localeCompare(b.name, 'uk-UA');
        if (nameDiff !== 0) return nameDiff;
        return a.number.localeCompare(b.number);
      });
      expect(copy.map((r) => r.name)).toEqual(['Анна', 'Янко']);
    }
  });
});
