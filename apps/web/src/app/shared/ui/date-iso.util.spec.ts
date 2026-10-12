import {
  formatIsoToUa,
  isValidCivilDate,
  parseUaDateToIso,
  toIsoDate,
} from './date-iso.util';

describe('date-iso.util typing helpers', () => {
  it('formats ISO to UA display', () => {
    expect(formatIsoToUa('1990-05-07')).toBe('07.05.1990');
    expect(formatIsoToUa('')).toBe('');
  });

  it('parses dotted / slash / dash typed dates', () => {
    expect(parseUaDateToIso('07.05.1990')).toBe('1990-05-07');
    expect(parseUaDateToIso('7/5/1990')).toBe('1990-05-07');
    expect(parseUaDateToIso('07-05-1990')).toBe('1990-05-07');
  });

  it('rejects empty and invalid civil dates', () => {
    expect(parseUaDateToIso('')).toBeNull();
    expect(parseUaDateToIso('  ')).toBeNull();
    expect(parseUaDateToIso('32.01.2000')).toBeNull();
    expect(parseUaDateToIso('29.02.2021')).toBeNull();
    expect(parseUaDateToIso('abc')).toBeNull();
  });

  it('accepts leap day and builds ISO via toIsoDate', () => {
    expect(isValidCivilDate(2020, 2, 29)).toBe(true);
    expect(parseUaDateToIso('29.02.2020')).toBe(toIsoDate(2020, 2, 29));
  });
});
