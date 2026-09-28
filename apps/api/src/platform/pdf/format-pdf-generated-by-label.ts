/**
 * PDF meta «Користувач» / Author: prefer linked employee name, else email.
 */
export function formatPdfGeneratedByLabel(input: {
  lastName?: string | null;
  firstName?: string | null;
  email?: string | null;
  fallbackId?: string | null;
}): string {
  const last = input.lastName?.trim() ?? '';
  const first = input.firstName?.trim() ?? '';
  const name = [last, first].filter(Boolean).join(' ');
  if (name) return name;
  const email = input.email?.trim() ?? '';
  if (email) return email;
  const id = input.fallbackId?.trim() ?? '';
  return id || '—';
}
