const UA_TO_LATIN: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'h',
  ґ: 'g',
  д: 'd',
  е: 'e',
  є: 'ye',
  ж: 'zh',
  з: 'z',
  и: 'y',
  і: 'i',
  ї: 'yi',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'kh',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'shch',
  ь: '',
  ю: 'yu',
  я: 'ya',
  "'": '',
  '’': '',
  '`': '',
};

function transliterate(value: string): string {
  return value
    .split('')
    .map((ch) => {
      const lower = ch.toLowerCase();
      const mapped = UA_TO_LATIN[lower];
      if (mapped !== undefined) {
        return ch === lower
          ? mapped
          : mapped.charAt(0).toUpperCase() + mapped.slice(1);
      }
      return ch;
    })
    .join('');
}

function sanitize(value: string): string {
  return value
    .replace(/[/\\:*?"<>|]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[.\s_]+|[.\s_]+$/g, '');
}

function padEmployeeNumber(raw: string | null | undefined): string {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return '';
  if (/^\d+$/.test(trimmed)) {
    return trimmed.padStart(4, '0');
  }
  return sanitize(trimmed);
}

/** Europe/Kyiv calendar date as yyyyMMdd. */
export function formatKyivYyyyMmDd(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Kyiv',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}${get('month')}${get('day')}`;
}

export type QuestionnairePdfFilenameEmployee = {
  employeeNumber?: string | null;
  lastName?: string | null;
  firstName?: string | null;
};

/**
 * Download names for questionnaire PDFs.
 * Filled + attached employee → includes таб.№ + ПІБ (profile-PDF parity).
 * Blank / unattached → template title + date (no fake person).
 */
export function buildQuestionnairePdfFilenames(input: {
  templateTitle: string;
  templateCode: string;
  assignmentCode?: string | null;
  employee?: QuestionnairePdfFilenameEmployee | null;
  blank?: boolean;
  now?: Date;
}): { asciiFilename: string; utf8Filename: string } {
  const date = formatKyivYyyyMmDd(input.now);
  const title =
    sanitize(input.templateTitle) ||
    sanitize(input.templateCode) ||
    'anketa';
  const titleAscii =
    sanitize(transliterate(input.templateTitle)) ||
    sanitize(transliterate(input.templateCode)) ||
    'anketa';

  if (input.blank) {
    const utf8Filename = `Анкета_заготовка_${title}_${date}.pdf`;
    const asciiFilename = `Anketa_blank_${titleAscii}_${date}.pdf`;
    return { asciiFilename, utf8Filename };
  }

  const assignment =
    sanitize(input.assignmentCode ?? '') || 'assignment';
  const assignmentAscii =
    sanitize(transliterate(input.assignmentCode ?? '')) || 'assignment';

  const number = padEmployeeNumber(input.employee?.employeeNumber);
  const last = sanitize(input.employee?.lastName ?? '');
  const first = sanitize(input.employee?.firstName ?? '');
  const lastAscii = sanitize(transliterate(input.employee?.lastName ?? ''));
  const firstAscii = sanitize(transliterate(input.employee?.firstName ?? ''));

  if (number || last || first) {
    const person = [number, last, first].filter(Boolean).join('_');
    const personAscii = [number, lastAscii, firstAscii]
      .filter(Boolean)
      .join('_');
    const utf8Filename = `Анкета_${title}_${person}_${assignment}.pdf`;
    const asciiFilename = `Anketa_${titleAscii}_${personAscii}_${assignmentAscii}.pdf`;
    return { asciiFilename, utf8Filename };
  }

  const utf8Filename = `Анкета_${title}_${assignment}_${date}.pdf`;
  const asciiFilename = `Anketa_${titleAscii}_${assignmentAscii}_${date}.pdf`;
  return { asciiFilename, utf8Filename };
}
