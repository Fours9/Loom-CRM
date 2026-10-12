import type { ElementRef } from '@angular/core';

/**
 * Close an open overlay when the user clicks outside its host.
 *
 * Uses **capture** on `document` so modal shells that call
 * `stopPropagation()` on bubble clicks (backdrop/modal recipe) still dismiss
 * the menu. Bubble-only `@HostListener('document:click')` never sees those.
 */
export function listenPwOverlayOutsideClick(
  host: ElementRef<HTMLElement>,
  isOpen: () => boolean,
  onOutside: () => void,
): () => void {
  const handler = (event: MouseEvent): void => {
    if (!isOpen()) return;
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (!host.nativeElement.contains(target)) {
      onOutside();
    }
  };
  document.addEventListener('click', handler, true);
  return () => document.removeEventListener('click', handler, true);
}
