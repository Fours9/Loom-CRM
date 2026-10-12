import {
  Directive,
  ElementRef,
  OnDestroy,
  OnInit,
  inject,
} from '@angular/core';
import {
  attachPwDialogHostToBody,
  type PwDialogHostDetach,
} from './pw-dialog-host';

/**
 * Single lifecycle entry for dialog host reparent + detach.
 *
 * Apply via `hostDirectives: [PwDialogHostDirective]` on the **outermost**
 * `@if`-gated dialog component only — never on nested chrome
 * (`loom-catalog-edit-dialog`).
 */
@Directive({
  selector: '[loomPwDialogHost]',
  standalone: true,
})
export class PwDialogHostDirective implements OnInit, OnDestroy {
  private readonly host = inject(ElementRef<HTMLElement>);
  private detachHost: PwDialogHostDetach | null = null;

  ngOnInit(): void {
    this.detachHost = attachPwDialogHostToBody(this.host);
  }

  ngOnDestroy(): void {
    this.detachHost?.();
    this.detachHost = null;
  }
}
