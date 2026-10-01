/**
 * Resolve first visible + usable [data-help-id] match.
 * data-help-id is not a unique HTML id — lists may repeat the same value.
 */

export type HelpAnchorDocument = Pick<Document, 'querySelectorAll'>;

export function isVisibleAndUsable(el: Element): el is HTMLElement {
  const HtmlEl = globalThis.HTMLElement;
  if (typeof HtmlEl === 'function') {
    if (!(el instanceof HtmlEl)) return false;
  } else if (typeof (el as HTMLElement).getBoundingClientRect !== 'function') {
    return false;
  }
  const node = el as HTMLElement;
  if (node.hasAttribute('disabled') || node.getAttribute('aria-disabled') === 'true') {
    return false;
  }
  const style = globalThis.getComputedStyle?.(node);
  if (style) {
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    if (Number(style.opacity) === 0) return false;
  }
  const rect = node.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;
  return true;
}

export function resolveHelpAnchor(
  doc: HelpAnchorDocument,
  anchorId: string,
): HTMLElement | null {
  const nodes = doc.querySelectorAll(`[data-help-id="${cssEscape(anchorId)}"]`);
  for (const node of Array.from(nodes)) {
    if (isVisibleAndUsable(node)) return node;
  }
  return null;
}

function cssEscape(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value);
  }
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
