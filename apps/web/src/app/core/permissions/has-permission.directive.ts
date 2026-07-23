import { Directive, Input, TemplateRef, ViewContainerRef, effect, inject } from '@angular/core';
import { SessionStore } from '../auth/session.store';
import type { Permission } from '@loom/contracts-auth';

@Directive({
  selector: '[loomHasPermission]',
  standalone: true,
})
export class HasPermissionDirective {
  private readonly tpl = inject(TemplateRef<unknown>);
  private readonly vcr = inject(ViewContainerRef);
  private readonly session = inject(SessionStore);
  private permission: Permission | string | null = null;
  private shown = false;

  @Input()
  set loomHasPermission(value: Permission | string) {
    this.permission = value;
    this.render();
  }

  constructor() {
    effect(() => {
      this.session.user();
      this.render();
    });
  }

  private render(): void {
    const ok =
      !!this.permission && this.session.hasPermission(this.permission);
    if (ok && !this.shown) {
      this.vcr.createEmbeddedView(this.tpl);
      this.shown = true;
    } else if (!ok && this.shown) {
      this.vcr.clear();
      this.shown = false;
    }
  }
}
