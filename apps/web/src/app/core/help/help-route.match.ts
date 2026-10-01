import type { HelpPageDescriptor, HelpRouteDescriptor } from './help-page.models';

/** Strip query/hash; return path segments (no empty leading). */
export function helpPathSegments(urlOrPath: string): string[] {
  const raw = urlOrPath.split('?')[0]?.split('#')[0] ?? '';
  const path = raw.startsWith('/') ? raw.slice(1) : raw;
  if (!path) return [];
  return path.split('/').filter((s) => s.length > 0);
}

function patternMatches(
  pattern: readonly string[],
  segments: readonly string[],
  exact: boolean,
): boolean {
  const hasGlob = pattern.includes('**');
  if (hasGlob) {
    const prefix = pattern.slice(0, pattern.indexOf('**'));
    if (segments.length < prefix.length) return false;
    return prefix.every((p, i) => segmentEq(p, segments[i]!));
  }
  if (exact) {
    if (pattern.length !== segments.length) return false;
    return pattern.every((p, i) => segmentEq(p, segments[i]!));
  }
  // non-exact without **: prefix match
  if (segments.length < pattern.length) return false;
  return pattern.every((p, i) => segmentEq(p, segments[i]!));
}

function segmentEq(patternSeg: string, actual: string): boolean {
  if (patternSeg.startsWith(':')) return true;
  return patternSeg === actual;
}

/** Higher score wins. Exact > wildcard; deeper / more concrete preferred. */
export function helpRouteMatchScore(
  desc: HelpRouteDescriptor,
  segments: readonly string[],
): number | null {
  if (!patternMatches(desc.pattern, segments, desc.exact)) return null;
  const hasGlob = desc.pattern.includes('**') || !desc.exact;
  const depth = desc.pattern.filter((p) => p !== '**').length;
  const concrete = desc.pattern.filter(
    (p) => p !== '**' && !p.startsWith(':'),
  ).length;
  return (hasGlob ? 0 : 10_000) + depth * 100 + concrete;
}

export function matchHelpRoute(
  descriptors: readonly HelpRouteDescriptor[],
  urlOrPath: string,
): HelpPageDescriptor | null {
  const segments = helpPathSegments(urlOrPath);
  let best: { score: number; context: HelpPageDescriptor } | null = null;
  for (const desc of descriptors) {
    const score = helpRouteMatchScore(desc, segments);
    if (score == null) continue;
    if (!best || score > best.score) {
      best = { score, context: desc.context };
    }
  }
  return best?.context ?? null;
}
