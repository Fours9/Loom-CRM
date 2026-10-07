import {
  assignThenHandle,
  clearInvalidEndTime,
} from './request-create-binding.util';

describe('request-create-binding.util', () => {
  it('assignThenHandle updates model before handler reads it', () => {
    let value = 'old';
    let seen = '';
    assignThenHandle(
      (next) => {
        value = next;
      },
      'new',
      () => {
        seen = value;
      },
    );
    expect(value).toBe('new');
    expect(seen).toBe('new');
  });

  it('clears end time when it is not after start', () => {
    expect(clearInvalidEndTime('10:00', '09:00')).toBe('');
    expect(clearInvalidEndTime('10:00', '10:00')).toBe('');
    expect(clearInvalidEndTime('10:00', '11:00')).toBe('11:00');
    expect(clearInvalidEndTime('', '11:00')).toBe('11:00');
  });
});
