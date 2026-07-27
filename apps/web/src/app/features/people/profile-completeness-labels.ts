/** Labels for incomplete completeness sections (UA, voluntary-friendly). */
export function formatIncompleteSections(
  sections: string[],
  kind: 'core' | 'extended',
): string {
  if (!sections.length) return '';
  const joined = sections.join(', ');
  return kind === 'core'
    ? `кадрові розділи: ${joined}`
    : `ще не заповнені добровільні розділи: ${joined}`;
}
