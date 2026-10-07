import { commitPwControlValue } from './pw-cva-commit';

describe('commitPwControlValue', () => {
  it('sets internal value then emits valueChange and CVA onChange/onTouched', () => {
    const calls: string[] = [];
    commitPwControlValue('2026-01-15', {
      setValue: (v) => calls.push(`set:${v}`),
      emitValueChange: (v) => calls.push(`vc:${v}`),
      cvaOnChange: (v) => calls.push(`cva:${v}`),
      cvaOnTouched: () => calls.push('touched'),
    });
    expect(calls).toEqual([
      'set:2026-01-15',
      'vc:2026-01-15',
      'cva:2026-01-15',
      'touched',
    ]);
  });

  it('supports clear to empty string', () => {
    let value = 'x';
    commitPwControlValue('', {
      setValue: (v) => {
        value = v;
      },
      emitValueChange: () => undefined,
      cvaOnChange: () => undefined,
      cvaOnTouched: () => undefined,
    });
    expect(value).toBe('');
  });
});
