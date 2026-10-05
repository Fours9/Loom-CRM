import {
  Component,
  DestroyRef,
  OnInit,
  effect,
  inject,
  signal,
} from '@angular/core';
import { OrganizationCatalogColumnComponent } from './organization-catalog-column.component';
import { PositionDetailsPanelComponent } from './position-details-panel.component';
import { PositionEditDialogComponent } from './position-edit-dialog.component';
import { SkillEditDialogComponent } from './skill-edit-dialog.component';
import { SkillGroupEditDialogComponent } from './skill-group-edit-dialog.component';
import { DirectionEditDialogComponent } from './direction-edit-dialog.component';
import { DepartmentEditDialogComponent } from './department-edit-dialog.component';
import { PositionManagementFacade } from './position-management.facade';
import { PositionSettingsTabComponent } from './position-settings-tab.component';
import { HelpPageContextService } from '../../core/help';
import {
  resolvePositionDialogKind,
  resolvePositionsHelpContext,
  type PositionSettingsHelpDialogKind,
} from './help/resolve-positions-help-context';
import type { PositionPageTabId } from './position-help-context.model';

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
    PositionSettingsTabComponent,
  ],
  template: `
    <section
      class="section"
      [attr.data-help-id]="tab() === 'settings' ? 'positions.formats' : 'positions.management'"
    >
      <h1>Керування посадами</h1>
      <p class="lead">Напрямки, відділи, посади та навички організації</p>

      <nav class="tabs" aria-label="Вкладки каталогу посад">
        <button
          type="button"
          class="tab"
          [class.active]="tab() === 'management'"
          (click)="tab.set('management')"
        >
          Керування посадами
        </button>
        <button
          type="button"
          class="tab"
          [class.active]="tab() === 'settings'"
          (click)="tab.set('settings')"
        >
          Формати
        </button>
      </nav>

      @if (tab() === 'management') {
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
      } @else {
        <loom-position-settings-tab (helpDialogChange)="settingsDialogKind.set($event)" />
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
      .tabs {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
      }
      .tab {
        border: 1px solid var(--pw-border);
        background: var(--pw-surface);
        border-radius: 999px;
        padding: 0.45rem 0.9rem;
        cursor: pointer;
      }
      .tab.active {
        border-color: var(--pw-accent);
        background: var(--pw-accent-soft);
        color: var(--pw-accent);
        font-weight: 700;
      }
    `,
  ],
})
export class PositionManagementPageComponent implements OnInit {
  readonly vm = inject(PositionManagementFacade);
  readonly tab = signal<PositionPageTabId>('management');
  readonly settingsDialogKind = signal<PositionSettingsHelpDialogKind>(null);
  private readonly helpPage = inject(HelpPageContextService);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    effect(() => {
      this.helpPage.setFeatureContext(
        'positions',
        resolvePositionsHelpContext({
          pageTab: this.tab(),
          selectedPositionId: this.vm.selectedPositionId(),
          catalogTab: this.vm.catalogTab(),
          standalone: false,
          dialogKind: resolvePositionDialogKind({
            positionDialogOpen: this.vm.positionDialogOpen(),
            catalogDialog: this.vm.activeCatalogDialog(),
            settingsDialog: this.settingsDialogKind(),
          }),
        }),
      );
    });
    this.destroyRef.onDestroy(() => {
      this.helpPage.clearFeatureContext('positions');
    });
  }

  ngOnInit(): void {
    this.vm.reload();
  }
}
