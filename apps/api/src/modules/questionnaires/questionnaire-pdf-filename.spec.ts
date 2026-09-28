import { buildQuestionnairePdfFilenames } from './questionnaire-pdf-filename';

describe('buildQuestionnairePdfFilenames', () => {
  const now = new Date('2026-09-28T12:00:00+03:00');

  it('includes employee number and name for filled assignment PDF', () => {
    const names = buildQuestionnairePdfFilenames({
      templateTitle: 'Первинна анкета',
      templateCode: 'employee-starter',
      assignmentCode: '360-002',
      employee: {
        employeeNumber: '12',
        lastName: 'Іваненко',
        firstName: 'Іван',
      },
      now,
    });
    expect(names.utf8Filename).toBe(
      'Анкета_Первинна_анкета_0012_Іваненко_Іван_360-002.pdf',
    );
    expect(names.asciiFilename).toMatch(/^Anketa_/);
    expect(names.asciiFilename).toContain('0012');
    expect(names.asciiFilename).toContain('360-002');
  });

  it('omits person segment when unattached', () => {
    const names = buildQuestionnairePdfFilenames({
      templateTitle: 'Анкета Managing',
      templateCode: 'employee-managing',
      assignmentCode: 'MNG-001',
      now,
    });
    expect(names.utf8Filename).toBe(
      'Анкета_Анкета_Managing_MNG-001_20260928.pdf',
    );
  });

  it('names blank template PDF as заготовка', () => {
    const names = buildQuestionnairePdfFilenames({
      templateTitle: 'Первинна анкета',
      templateCode: 'employee-starter',
      blank: true,
      now,
    });
    expect(names.utf8Filename).toBe(
      'Анкета_заготовка_Первинна_анкета_20260928.pdf',
    );
  });
});
