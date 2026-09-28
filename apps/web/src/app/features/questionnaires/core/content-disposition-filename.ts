/**
 * Prefer RFC 6266 filename* (UTF-8); fall back to quoted filename=.
 */
export function filenameFromContentDisposition(
  header: string | null | undefined,
): string | null {
  if (!header) return null;
  const star = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(header);
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1].trim().replace(/^"+|"+$/g, ''));
    } catch {
      return star[1].trim();
    }
  }
  const plain = /filename\s*=\s*("?)([^";]+)\1/i.exec(header);
  return plain?.[2]?.trim() || null;
}
