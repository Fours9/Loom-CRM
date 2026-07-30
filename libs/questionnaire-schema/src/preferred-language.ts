export type PreferredLanguageOption = { value: string; label: string };

export type PreferredLanguageParsed = {
  selected: string[];
  otherText?: string;
};

/**
 * Canonical profile / proposal string:
 *   uk | uk,en | uk,en,other:Польська | other:Польська
 *
 * Parse rule: `other:` is the last segment; everything after the first `other:`
 * is otherText (commas/colons allowed in text).
 */
export function parsePreferredLanguage(
  value: unknown,
  options: PreferredLanguageOption[],
): PreferredLanguageParsed {
  const optionOrder = options.map((o) => o.value);
  const known = new Set(optionOrder);

  if (value === null || value === undefined || value === '') {
    return { selected: [] };
  }

  if (Array.isArray(value)) {
    return normalizeSelection(
      value.filter((v): v is string => typeof v === 'string'),
      undefined,
      optionOrder,
      known,
    );
  }

  if (typeof value !== 'string') {
    return { selected: [] };
  }

  const trimmed = value.trim();
  if (!trimmed) return { selected: [] };

  const otherIdx = trimmed.indexOf('other:');
  let otherText: string | undefined;
  let codesPart = trimmed;

  if (otherIdx >= 0) {
    otherText = trimmed.slice(otherIdx + 'other:'.length);
    codesPart = trimmed.slice(0, otherIdx).replace(/,+$/, '');
  }

  const codes = codesPart
    ? codesPart
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean)
    : [];

  if (otherIdx >= 0 && !codes.includes('other')) {
    codes.push('other');
  }

  // Legacy: bare language name not in options → other
  if (codes.length === 1 && !known.has(codes[0]!) && otherIdx < 0) {
    return { selected: ['other'], otherText: codes[0] };
  }

  return normalizeSelection(codes, otherText, optionOrder, known);
}

export function serializePreferredLanguage(
  selected: string[],
  otherText: string | undefined,
  options: PreferredLanguageOption[],
): string | null {
  const optionOrder = options.map((o) => o.value);
  const known = new Set(optionOrder);
  const normalized = normalizeSelection(
    selected,
    otherText,
    optionOrder,
    known,
  );
  if (!normalized.selected.length) return null;

  const codes = normalized.selected.filter((c) => c !== 'other');
  const hasOther = normalized.selected.includes('other');
  const parts = [...codes];
  if (hasOther) {
    const text = normalized.otherText?.trim();
    if (text) {
      parts.push(`other:${text}`);
    } else {
      parts.push('other');
    }
  }
  return parts.join(',') || null;
}

/**
 * Profile mirror / legacy string → multi_choice UI state.
 */
export function normalizePreferredLanguageMirror(
  value: unknown,
  options: PreferredLanguageOption[],
): PreferredLanguageParsed {
  return parsePreferredLanguage(value, options);
}

function normalizeSelection(
  codes: string[],
  otherText: string | undefined,
  optionOrder: string[],
  known: Set<string>,
): PreferredLanguageParsed {
  const selectedSet = new Set<string>();
  let other = otherText?.trim() || undefined;

  for (const code of codes) {
    if (code === 'other' || code.startsWith('other:')) {
      selectedSet.add('other');
      if (code.startsWith('other:') && !other) {
        other = code.slice('other:'.length);
      }
      continue;
    }
    if (known.has(code)) {
      selectedSet.add(code);
    } else {
      selectedSet.add('other');
      if (!other) other = code;
    }
  }

  const selected = optionOrder.filter((o) => selectedSet.has(o));
  // Include other if selected but not in options order somehow
  if (selectedSet.has('other') && !selected.includes('other')) {
    selected.push('other');
  }

  return other
    ? { selected, otherText: other }
    : { selected };
}
