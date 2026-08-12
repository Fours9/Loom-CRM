import {
  allocateNextAssignmentCode,
  escapeIlikePattern,
  formatAssignmentCode,
  questionnaireAssignmentCodePrefix,
} from './questionnaire-assignment-code';

describe('questionnaireAssignmentCodePrefix', () => {
  it('maps employee-360 and types', () => {
    expect(questionnaireAssignmentCodePrefix('employee-360', 'full')).toBe(
      '360',
    );
    expect(questionnaireAssignmentCodePrefix('other', 'full')).toBe('POV');
    expect(questionnaireAssignmentCodePrefix('x', 'managing')).toBe('MAN');
    expect(questionnaireAssignmentCodePrefix('x', 'docs')).toBe('DOC');
  });

  it('throws on unknown type', () => {
    expect(() =>
      questionnaireAssignmentCodePrefix('unknown-tmpl', 'primary'),
    ).toThrow();
    expect(() =>
      questionnaireAssignmentCodePrefix('unknown-tmpl', 'nope'),
    ).toThrow();
  });
});

describe('formatAssignmentCode', () => {
  it('pads to at least 3 digits and grows past 999', () => {
    expect(formatAssignmentCode('360', 1)).toBe('360-001');
    expect(formatAssignmentCode('POV', 42)).toBe('POV-042');
    expect(formatAssignmentCode('360', 1000)).toBe('360-1000');
  });
});

describe('escapeIlikePattern', () => {
  it('escapes wildcards', () => {
    expect(escapeIlikePattern('a%b_c\\d')).toBe('a\\%b\\_c\\\\d');
  });
});

describe('allocateNextAssignmentCode', () => {
  it('inserts counter, locks, returns old next_value and increments', async () => {
    const manager = {
      query: jest
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce([{ nextValue: 6 }])
        .mockResolvedValueOnce(undefined),
    };

    const code = await allocateNextAssignmentCode(manager as never, '360');
    expect(code).toBe('360-006');
    expect(manager.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('ON CONFLICT'),
      ['360'],
    );
    expect(manager.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('FOR UPDATE'),
      ['360'],
    );
    expect(manager.query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('UPDATE'),
      ['360', 7],
    );
  });
});
