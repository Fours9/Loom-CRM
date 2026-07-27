/**
 * RFC 6266 Content-Disposition for file downloads.
 * ASCII fallback avoids non-ASCII in the legacy filename= parameter.
 */
export function attachmentContentDisposition(utf8Filename: string): string {
  const extension = safeExtension(utf8Filename);
  const asciiFallback = `download${extension}`;
  const encoded = encodeURIComponent(utf8Filename).replace(/['()]/g, escape);
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}

function safeExtension(filename: string): string {
  const match = /\.([a-zA-Z0-9]{1,16})$/.exec(filename.trim());
  if (!match) return '';
  return `.${match[1].toLowerCase()}`;
}
