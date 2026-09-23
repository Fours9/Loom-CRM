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

export function buildQuestionnairePdfFilenames(input: {
  templateCode: string;
  assignmentCode?: string | null;
  blank?: boolean;
  now?: Date;
}): { asciiFilename: string; utf8Filename: string } {
  const date = formatKyivYyyyMmDd(input.now);
  const code = sanitize(input.templateCode) || 'template';
  const mid = input.blank
    ? 'blank'
    : sanitize(input.assignmentCode ?? 'assignment') || 'assignment';
  const utf8Filename = `anketa-${code}-${mid}-${date}.pdf`;
  const asciiFilename = `anketa-${sanitize(transliterate(code))}-${sanitize(transliterate(mid))}-${date}.pdf`;
  return { asciiFilename, utf8Filename };
}
