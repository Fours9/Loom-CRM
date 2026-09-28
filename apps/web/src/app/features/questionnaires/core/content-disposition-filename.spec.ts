import { filenameFromContentDisposition } from './content-disposition-filename';

describe('filenameFromContentDisposition', () => {
  it('prefers filename* UTF-8', () => {
    const header =
      "attachment; filename=\"Anketa_test.pdf\"; filename*=UTF-8''%D0%90%D0%BD%D0%BA%D0%B5%D1%82%D0%B0_test.pdf";
    expect(filenameFromContentDisposition(header)).toBe('Анкета_test.pdf');
  });

  it('falls back to filename=', () => {
    expect(
      filenameFromContentDisposition('attachment; filename="anketa-blank.pdf"'),
    ).toBe('anketa-blank.pdf');
  });

  it('returns null when missing', () => {
    expect(filenameFromContentDisposition(null)).toBeNull();
    expect(filenameFromContentDisposition('inline')).toBeNull();
  });
});
