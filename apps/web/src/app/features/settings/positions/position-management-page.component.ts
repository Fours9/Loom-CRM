import { Component, OnInit, inject } from '@angular/core';
import { OrganizationCatalogColumnComponent } from './organization-catalog-column.component';
import { PositionDetailsPanelComponent } from './position-details-panel.component';
import { PositionEditDialogComponent } from './position-edit-dialog.component';
import { PositionManagementFacade } from './position-management.facade';

@Component({
  selector: 'loom-position-management-page',
  standalone: true,
  providers: [PositionManagementFacade],
  imports: [
    OrganizationCatalogColumnComponent,
    PositionDetailsPanelComponent,
    PositionEditDialogComponent,
  ],
  template: `
    <section class="section">
      <h2>Керування посадами</h2>
      <p class="lead">Напрямки, відділи, посади та навички організації</p>

      @if (vm.error() && !vm.positionDialogOpen()) {
        <p class="error">{{ vm.error() }}</p>
      }

      @if (!vm.canManage()) {
        <p class="muted">Керувати довідниками може лише адміністратор або користувач з відповідними правами.</p>
      }

      <loom-organization-catalog-column />
      <loom-position-details-panel />
      @if (vm.positionDialogOpen()) {
        <loom-position-edit-dialog />
      }
    </section>
  `,
  styles: [
    `
      .section {
        display: grid;
        gap: 1rem;
      }
      h2 {
        margin: 0;
        font-size: 1.35rem;
        color: var(--pw-text-strong);
      }
      .lead,
      .muted {
        color: var(--pw-muted);
        margin: 0;
      }
      .error {
        color: var(--pw-danger);
        margin: 0;
      }
    `,
  ],
})
export class PositionManagementPageComponent implements OnInit {
  readonly vm = inject(PositionManagementFacade);

  ngOnInit(): void {
    this.vm.reload();
  }
}
