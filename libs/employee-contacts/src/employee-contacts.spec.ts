import {
  canonicalEmployeeContactsBundle,
  emptyEmployeeContactsBundle,
  isEmployeeContactsBundleMeaningful,
  normalizeEmployeeContactsBundle,
  parseEmployeeContactsBundleStrict,
  validateEmployeeContactsBundleForWrite,
} from './index';
import { InvalidEmployeeContactsBundle } from './errors';

describe('employee contacts bundle', () => {
  it('empty bundle is not meaningful', () => {
    expect(isEmployeeContactsBundleMeaningful(emptyEmployeeContactsBundle())).toBe(
      false,
    );
  });

  it('draft normalize drops fully empty emergency rows but keeps partial', () => {
    const bundle = normalizeEmployeeContactsBundle({
      work: { email: '  a@b.c  ', phone: '', telegram: null },
      personal: [
        { type: 'personal_email', value: '  x@y.z ', isPrimary: true },
        { type: 'personal_email', value: '   ', isPrimary: false },
      ],
      emergency: [
        {
          fullName: '',
          relationship: '',
          primaryPhone: '',
          secondaryPhone: '',
          notes: '',
        },
        {
          fullName: 'Ann',
          relationship: '',
          primaryPhone: '',
          secondaryPhone: '',
          notes: '',
        },
      ],
    });
    expect(bundle.work.email).toBe('a@b.c');
    expect(bundle.personal).toHaveLength(1);
    expect(bundle.emergency).toHaveLength(1);
    expect(bundle.emergency[0]?.fullName).toBe('Ann');
    expect(isEmployeeContactsBundleMeaningful(bundle)).toBe(true);
  });

  it('write validate rejects incomplete emergency row with data', () => {
    const bundle = normalizeEmployeeContactsBundle({
      emergency: [
        {
          fullName: 'Ann',
          relationship: 'sister',
          primaryPhone: '',
          secondaryPhone: '',
          notes: '',
        },
      ],
    });
    expect(() => validateEmployeeContactsBundleForWrite(bundle)).toThrow(
      InvalidEmployeeContactsBundle,
    );
  });

  it('strict parse rejects malformed shape', () => {
    expect(() => parseEmployeeContactsBundleStrict([])).toThrow(
      InvalidEmployeeContactsBundle,
    );
  });

  it('canonical sort is stable', () => {
    const a = canonicalEmployeeContactsBundle(
      normalizeEmployeeContactsBundle({
        personal: [
          { type: 'personal_phone', value: '2', isPrimary: false },
          { type: 'personal_phone', value: '1', isPrimary: true },
        ],
      }),
    );
    expect(a.personal[0]?.isPrimary).toBe(true);
    expect(a.personal[0]?.value).toBe('1');
  });
});
