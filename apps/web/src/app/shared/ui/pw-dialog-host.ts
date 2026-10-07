import type { ElementRef } from '@angular/core';

/**
 * Reparent a dialog host under `.app-shell` / `.loom-absence-module` so
 * `position: fixed` backdrops are viewport-relative.
 *
 * Nested tab panels (`.pw-rise` / `.pw-stage`) otherwise trap fixed positioning.
 * Must stay under the shell token host — CRM vars (`--pw-surface`, …) and the
 * `.pw-btn` / `.pw-btn--ghost` chrome rules are scoped to `.app-shell` /
 * `.loom-absence-module` (see styles.css), not `body`. NEVER fall back to bare
 * `document.body`: a body-parented dialog silently loses those tokens — panels
 * render transparent and footer buttons render unstyled, with no visible error.
 *
 * `[data-pw-app]` (set on the shell root alongside `.app-shell`, see
 * `shell.component.ts`) is kept as a secondary lookup in case the class name
 * ever changes while the attribute marker stays — still never bare body.
 *
 * If no token-bearing shell exists yet (e.g. a dialog opened before shell
 * bootstrap finishes, or in an isolated test harness), fail soft: leave the
 * host exactly where Angular placed it in the component tree instead of
 * moving it anywhere that would lose tokens. The dialog may stay nested under
 * a transformed/overflow-clipped ancestor in that edge case, but it keeps its
 * theme and chrome — losing fixed-position escape is strictly better than
 * losing tokens.
 *
 * Call once from `ngOnInit`. Angular removes the host on destroy from the new parent.
 */
export function attachPwDialogHostToBody(
  host: ElementRef<HTMLElement>,
): void {
  const el = host.nativeElement;
  const shell =
    document.querySelector<HTMLElement>('.app-shell') ??
    document.querySelector<HTMLElement>('.loom-absence-module') ??
    document.querySelector<HTMLElement>('[data-pw-app]');
  if (!shell) {
    console.assert(
      false,
      '[pw-dialog-host] no .app-shell / .loom-absence-module / [data-pw-app] found; ' +
        'leaving dialog host in place rather than reparenting to bare document.body ' +
        '(would lose --pw-surface / .pw-btn tokens).',
    );
    return;
  }
  if (el.parentElement !== shell) {
    shell.appendChild(el);
  }
}
