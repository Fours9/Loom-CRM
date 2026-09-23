import { Employee } from './employee.entity';
import { attachmentContentDisposition } from '../../platform/http/content-disposition';

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
        return ch === lower ? mapped : mapped.charAt(0).toUpperCase() + mapped.slice(1);
      }
      return ch;
    })
    .join('');
}

function sanitizeFilenamePart(value: string): string {
  return value
    .replace(/[/\\:*?"<>|]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[.\s_]+|[.\s_]+$/g, '');
}

function padEmployeeNumber(raw: string): string {
  const trimmed = raw.trim();
  if (/^\d+$/.test(trimmed)) {
    return trimmed.padStart(4, '0');
  }
  return sanitizeFilenamePart(trimmed) || '0000';
}

export function buildEmployeePdfFilenames(employee: Employee): {
  asciiFilename: string;
  utf8Filename: string;
} {
  const number = padEmployeeNumber(employee.employeeNumber);
  const last = sanitizeFilenamePart(employee.lastName);
  const first = sanitizeFilenamePart(employee.firstName);
  const utf8Filename = `Анкета_${number}_${last}_${first}.pdf`;
  const asciiFilename = `Anketa_${number}_${sanitizeFilenamePart(transliterate(employee.lastName))}_${sanitizeFilenamePart(transliterate(employee.firstName))}.pdf`;
  return { asciiFilename, utf8Filename };
}

export function contentDisposition(asciiFilename: string, utf8Filename: string): string {
  return attachmentContentDisposition(utf8Filename, asciiFilename);
}

/** Prefer platform helper for generic downloads without a prepared ASCII name. */
export { attachmentContentDisposition };

/** Kyiv wall clock as DD.MM.YYYY HH:mm */
export function formatKyivDateTime(date: Date): string {
  const parts = new Intl.DateTimeFormat('uk-UA', {
    timeZone: 'Europe/Kyiv',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('day')}.${get('month')}.${get('year')} ${get('hour')}:${get('minute')}`;
}
