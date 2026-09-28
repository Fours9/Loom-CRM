import { formatPdfGeneratedByLabel } from './format-pdf-generated-by-label';

describe('formatPdfGeneratedByLabel', () => {
  it('prefers lastName + firstName over email', () => {
    expect(
      formatPdfGeneratedByLabel({
        lastName: 'Іваненко',
        firstName: 'Іван',
        email: 'ivan@example.com',
      }),
    ).toBe('Іваненко Іван');
  });

  it('falls back to email when name missing', () => {
    expect(
      formatPdfGeneratedByLabel({
        lastName: '  ',
        firstName: null,
        email: 'hr@example.com',
        fallbackId: 'uuid',
      }),
    ).toBe('hr@example.com');
  });

  it('falls back to id then dash', () => {
    expect(
      formatPdfGeneratedByLabel({ email: null, fallbackId: 'u-1' }),
    ).toBe('u-1');
    expect(formatPdfGeneratedByLabel({})).toBe('—');
  });
});
