import { matchesRequestTypeAndStatusGroup } from './absence-request-list-filters';

describe('matchesRequestTypeAndStatusGroup', () => {
  const row = { type: 'vacation', statusGroup: 'pending' };

  it('matches everything when no filter is set', () => {
    expect(matchesRequestTypeAndStatusGroup(row, {})).toBe(true);
  });

  it('empty plural arrays are treated as no constraint (not match-none)', () => {
    expect(
      matchesRequestTypeAndStatusGroup(row, { types: [], statusGroups: [] }),
    ).toBe(true);
  });

  describe('type / types', () => {
    it('matches singular type equality', () => {
      expect(matchesRequestTypeAndStatusGroup(row, { type: 'vacation' })).toBe(true);
      expect(matchesRequestTypeAndStatusGroup(row, { type: 'sick_leave' })).toBe(
        false,
      );
    });

    it('nonempty types is inclusive OR and takes priority over singular type', () => {
      expect(
        matchesRequestTypeAndStatusGroup(row, {
          types: ['vacation', 'day_off'],
        }),
      ).toBe(true);
      expect(
        matchesRequestTypeAndStatusGroup(row, { types: ['day_off'] }),
      ).toBe(false);
      expect(
        matchesRequestTypeAndStatusGroup(row, {
          types: ['day_off'],
          type: 'vacation',
        }),
      ).toBe(false);
    });
  });

  describe('statusGroup / statusGroups', () => {
    it('matches singular statusGroup equality', () => {
      expect(
        matchesRequestTypeAndStatusGroup(row, { statusGroup: 'pending' }),
      ).toBe(true);
      expect(
        matchesRequestTypeAndStatusGroup(row, { statusGroup: 'approved' }),
      ).toBe(false);
    });

    it('nonempty statusGroups is inclusive OR and takes priority over singular statusGroup', () => {
      expect(
        matchesRequestTypeAndStatusGroup(row, {
          statusGroups: ['pending', 'approved'],
        }),
      ).toBe(true);
      expect(
        matchesRequestTypeAndStatusGroup(row, { statusGroups: ['approved'] }),
      ).toBe(false);
      expect(
        matchesRequestTypeAndStatusGroup(row, {
          statusGroups: ['approved'],
          statusGroup: 'pending',
        }),
      ).toBe(false);
    });
  });

  it('combines type and statusGroup constraints', () => {
    expect(
      matchesRequestTypeAndStatusGroup(row, {
        types: ['vacation'],
        statusGroups: ['approved', 'completed'],
      }),
    ).toBe(false);
    expect(
      matchesRequestTypeAndStatusGroup(row, {
        types: ['vacation'],
        statusGroups: ['pending'],
      }),
    ).toBe(true);
  });
});
