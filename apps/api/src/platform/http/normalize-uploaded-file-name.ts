/**
 * Multer/busboy often decodes multipart filename bytes as Latin-1.
 * UTF-8 Cyrillic then shows as mojibake (e.g. ÐÐ½ÐºÐµÑÐ°). Repair when needed.
 */
export function normalizeUploadedFileName(raw: string): string {
  const trimmed = (raw || 'file').trim() || 'file';
  const repaired = Buffer.from(trimmed, 'latin1').toString('utf8');
  const hasCyrillic = (s: string) => /[\u0400-\u04FF]/.test(s);
  if (hasCyrillic(repaired) && !hasCyrillic(trimmed)) {
    return truncateFileName(repaired);
  }
  if (/[ÐÑ]/.test(trimmed) && hasCyrillic(repaired)) {
    return truncateFileName(repaired);
  }
  return truncateFileName(trimmed);
}

function truncateFileName(name: string): string {
  return name.length > 255 ? name.slice(0, 255) : name;
}
