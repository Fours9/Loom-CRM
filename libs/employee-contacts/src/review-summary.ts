import type { EmployeeContactsBundle } from './types';

export function formatContactsBundleReviewSummary(
  bundle: EmployeeContactsBundle,
): string {
  const workParts: string[] = [];
  if (bundle.work.email) workParts.push(bundle.work.email);
  if (bundle.work.phone) workParts.push(bundle.work.phone);
  if (bundle.work.telegram) workParts.push(bundle.work.telegram);
  const work = workParts.length ? workParts.join(' · ') : '—';
  return `${work} · ${bundle.personal.length} особистих · ${bundle.emergency.length} екстрених`;
}
