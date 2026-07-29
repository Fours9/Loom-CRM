import {
  isPersonalContactType,
  legacyPersonalFromContacts,
  normalizePersonalContactsForWrite,
  resolvePrimaryPersonalValue,
} from './employee-personal-contacts';

describe('employee-personal-contacts', () => {
  describe('resolvePrimaryPersonalValue', () => {
    it('prefers primary contact row over legacy column', () => {
      const value = resolvePrimaryPersonalValue(
        [
          { type: 'personal_phone', value: '111', isPrimary: false },
          { type: 'personal_phone', value: '222', isPrimary: true },
        ],
        'personal_phone',
        { personalPhoneNumber: 'legacy', personalEmail: null, personalTelegram: null },
      );
      expect(value).toBe('222');
    });

    it('falls back to legacy when no contact rows', () => {
      const value = resolvePrimaryPersonalValue(
        [],
        'personal_email',
        {
          personalPhoneNumber: null,
          personalEmail: 'legacy@example.com',
          personalTelegram: null,
        },
      );
      expect(value).toBe('legacy@example.com');
    });
  });

  describe('normalizePersonalContactsForWrite', () => {
    it('enforces one primary per type and drops empty values', () => {
      const normalized = normalizePersonalContactsForWrite([
        { type: 'personal_phone', value: ' 3801 ', isPrimary: false },
        { type: 'personal_phone', value: '3802', isPrimary: true },
        { type: 'personal_email', value: ' ', isPrimary: true },
        { type: 'personal_telegram', value: '@tg', isPrimary: false },
      ]);

      expect(normalized).toEqual([
        { type: 'personal_phone', value: '3801', isPrimary: false },
        { type: 'personal_phone', value: '3802', isPrimary: true },
        { type: 'personal_telegram', value: '@tg', isPrimary: true },
      ]);
    });

    it('rejects invalid types', () => {
      expect(() =>
        normalizePersonalContactsForWrite([
          { type: 'work_phone' as never, value: '123', isPrimary: true },
        ]),
      ).toThrow('Invalid personal contact type');
    });
  });

  describe('legacyPersonalFromContacts', () => {
    it('maps primary values to legacy columns', () => {
      expect(
        legacyPersonalFromContacts([
          { type: 'personal_phone', value: '380', isPrimary: true },
          { type: 'personal_email', value: 'a@b.c', isPrimary: true },
        ]),
      ).toEqual({
        personalPhoneNumber: '380',
        personalEmail: 'a@b.c',
        personalTelegram: null,
      });
    });
  });

  describe('isPersonalContactType', () => {
    it('accepts personal_* types only', () => {
      expect(isPersonalContactType('personal_phone')).toBe(true);
      expect(isPersonalContactType('work_phone')).toBe(false);
    });
  });
});
