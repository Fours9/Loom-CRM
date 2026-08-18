import { Component, OnInit, inject } from '@angular/core';
import { OrganizationCatalogColumnComponent } from './organization-catalog-column.component';
import { PositionDetailsPanelComponent } from './position-details-panel.component';
import { PositionEditDialogComponent } from './position-edit-dialog.component';
import { SkillEditDialogComponent } from './skill-edit-dialog.component';
import { SkillGroupEditDialogComponent } from './skill-group-edit-dialog.component';
import { DirectionEditDialogComponent } from './direction-edit-dialog.component';
import { DepartmentEditDialogComponent } from './department-edit-dialog.component';
import { PositionManagementFacade } from './position-management.facade';

@Component({
  selector: 'loom-position-management-page',
  standalone: true,
  providers: [PositionManagementFacade],
  imports: [
    OrganizationCatalogColumnComponent,
    PositionDetailsPanelComponent,
    PositionEditDialogComponent,
    SkillEditDialogComponent,
    SkillGroupEditDialogComponent,
    DirectionEditDialogComponent,
    DepartmentEditDialogComponent,
  ],
  template: `
    <section class="section">
      <h1>Керування посадами</h1>
      <p class="lead">Напрямки, відділи, посади та навички організації</p>

      @if (
        vm.error() &&
        !vm.positionDialogOpen() &&
        !vm.activeCatalogDialog()
      ) {
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
      @if (vm.activeCatalogDialog() === 'skill') {
        <loom-skill-edit-dialog />
      }
      @if (vm.activeCatalogDialog() === 'group') {
        <loom-skill-group-edit-dialog />
      }
      @if (vm.activeCatalogDialog() === 'direction') {
        <loom-direction-edit-dialog />
      }
      @if (vm.activeCatalogDialog() === 'department') {
        <loom-department-edit-dialog />
      }
    </section>
  `,
  styles: [
    `
      .section {
        display: grid;
        gap: 1rem;
        max-width: 1400px;
        margin-inline: auto;
        width: 100%;
      }
      h1 {
        margin: 0;
        font-size: 1.75rem;
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
