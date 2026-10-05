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
      class="section pw-stage"
      [attr.data-help-id]="tab() === 'settings' ? 'positions.formats' : 'positions.management'"
    >
      <span class="pw-stage__glow" aria-hidden="true"></span>
      <header class="pw-page-head pw-rise">
        <div>
          <p class="pw-eyebrow">Організація</p>
          <h1>Керування посадами</h1>
          <p class="pw-lead">Напрямки, відділи, посади та навички</p>
        </div>
      </header>

      <nav class="tabs pw-rise" style="--pw-delay: 70ms" aria-label="Вкладки каталогу посад">
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

      <div class="body pw-rise" style="--pw-delay: 130ms">
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
      </div>
    </section>
  `,
  styles: [
    `
      .section {
        max-width: 1400px;
        margin-inline: auto;
        width: 100%;
      }
      .body {
        display: grid;
        gap: 1rem;
        min-width: 0;
      }
      .error {
        color: var(--pw-danger);
        margin: 0;
        font-weight: 600;
      }
      .muted {
        color: var(--pw-muted);
        margin: 0;
      }
      .tabs {
        display: inline-flex;
        gap: 0.25rem;
        flex-wrap: wrap;
        padding: 0.22rem;
        border-radius: 999px;
        background: color-mix(in srgb, var(--pw-surface) 88%, transparent);
        border: 1px solid color-mix(in srgb, var(--pw-accent) 14%, var(--pw-border));
        width: fit-content;
        box-shadow: 0 2px 10px var(--pw-shadow);
      }
      .tab {
        border: 0;
        background: transparent;
        border-radius: 999px;
        padding: 0.45rem 0.95rem;
        cursor: pointer;
        color: var(--pw-muted);
        font-weight: 700;
        transition:
          background 0.16s ease,
          color 0.16s ease,
          box-shadow 0.16s ease;
      }
      .tab.active {
        color: var(--pw-accent);
        background: var(--pw-surface);
        box-shadow: 0 2px 8px var(--pw-shadow);
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
