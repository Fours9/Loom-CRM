import { Component, DestroyRef, OnInit, effect, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PositionDetailsPanelComponent } from './position-details-panel.component';
import { PositionEditDialogComponent } from './position-edit-dialog.component';
import { PositionManagementFacade } from './position-management.facade';
import { HelpPageContextService } from '../../core/help';
import { resolvePositionsHelpContext } from './help/resolve-positions-help-context';

@Component({
  selector: 'loom-position-catalog-page',
  standalone: true,
  providers: [PositionManagementFacade],
  imports: [
    RouterLink,
    PositionDetailsPanelComponent,
    PositionEditDialogComponent,
  ],
  template: `
    <section class="section" data-help-id="positions.management">
      <a class="back" routerLink="/positions">← Керування посадами</a>
      <h1>Каталог посади</h1>
      @if (vm.error()) {
        <p class="error">{{ vm.error() }}</p>
      }
      <loom-position-details-panel />
      @if (!vm.selectedPosition() && !vm.error() && vm.positions().length > 0) {
        <p class="muted">Посаду не знайдено.</p>
      }
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
        max-width: 1400px;
        margin-inline: auto;
        width: 100%;
      }
      h1 {
        margin: 0;
        font-size: 1.75rem;
        color: var(--pw-text-strong);
      }
      .back {
        color: var(--pw-accent);
        width: fit-content;
      }
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
export class PositionCatalogPageComponent implements OnInit {
  readonly vm = inject(PositionManagementFacade);
  private readonly route = inject(ActivatedRoute);
  private readonly helpPage = inject(HelpPageContextService);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    effect(() => {
      this.helpPage.setFeatureContext(
        'positions',
        resolvePositionsHelpContext({
          pageTab: 'management',
          selectedPositionId: this.vm.selectedPositionId(),
          catalogTab: this.vm.catalogTab(),
          standalone: true,
        }),
      );
    });
    this.destroyRef.onDestroy(() => {
      this.helpPage.clearFeatureContext('positions');
    });
  }

  ngOnInit(): void {
    this.vm.openStandaloneCatalog(this.route.snapshot.paramMap.get('id'));
  }
}
