import {
  PRIVACY_DEFAULTS,
  parseAbsenceVisibilityMode,
  parseBool,
  parseProfileVisibilityMode,
  parseSessionMinutes,
} from './privacy-settings.keys';

describe('privacy-settings parsers', () => {
  it('parseBool accepts common truthy/falsy strings', () => {
    expect(parseBool('true', false)).toBe(true);
    expect(parseBool('1', false)).toBe(true);
    expect(parseBool('false', true)).toBe(false);
    expect(parseBool('0', true)).toBe(false);
    expect(parseBool(null, true)).toBe(true);
    expect(parseBool('maybe', false)).toBe(false);
  });

  it('parseAbsenceVisibilityMode falls back to default', () => {
    expect(parseAbsenceVisibilityMode('own_department')).toBe('own_department');
    expect(parseAbsenceVisibilityMode('bogus')).toBe(
      PRIVACY_DEFAULTS.absenceVisibilityMode,
    );
    expect(parseAbsenceVisibilityMode(null)).toBe(
      PRIVACY_DEFAULTS.absenceVisibilityMode,
    );
  });

  it('parseProfileVisibilityMode falls back to default', () => {
    expect(parseProfileVisibilityMode('none')).toBe('none');
    expect(parseProfileVisibilityMode('nope')).toBe(
      PRIVACY_DEFAULTS.profileVisibilityMode,
    );
  });

  it('parseSessionMinutes rejects non-positive', () => {
    expect(parseSessionMinutes('120')).toBe(120);
    expect(parseSessionMinutes('0')).toBe(
      PRIVACY_DEFAULTS.sessionInactivityMinutes,
    );
    expect(parseSessionMinutes(null)).toBe(
      PRIVACY_DEFAULTS.sessionInactivityMinutes,
    );
  });
});
