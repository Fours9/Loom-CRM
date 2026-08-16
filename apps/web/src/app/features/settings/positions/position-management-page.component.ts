import { Component, OnInit, inject } from '@angular/core';
import { OrganizationCatalogColumnComponent } from './organization-catalog-column.component';
import { PositionDetailsPanelComponent } from './position-details-panel.component';
import { PositionManagementFacade } from './position-management.facade';

@Component({
  selector: 'loom-position-management-page',
  standalone: true,
  providers: [PositionManagementFacade],
  imports: [OrganizationCatalogColumnComponent, PositionDetailsPanelComponent],
  template: `
    <section class="section">
      <h2>Керування посадами</h2>
      <p class="lead">Напрямки, відділи та посади організації</p>

      @if (vm.error()) {
        <p class="error">{{ vm.error() }}</p>
      }

      @if (!vm.canManage()) {
        <p class="muted">Керувати довідниками може лише адміністратор або користувач з відповідними правами.</p>
      }

      <loom-organization-catalog-column />
      <loom-position-details-panel />

      <article class="card">
        <h3>Каталог навичок</h3>
        <p class="muted">Довідник груп і навичок (seed з реєстру Track B)</p>
        @for (g of vm.skillGroups(); track g.id) {
          <div class="catalog-group">
            <strong>{{ g.name }}</strong>
            <small class="code">{{ g.code }}</small>
            <ul class="flat">
              @for (s of vm.skillsForGroup(g.id); track s.id) {
                <li>
                  <span>{{ s.name }}</span>
                  <small class="code">{{ s.code }}</small>
                </li>
              }
            </ul>
          </div>
        }
      </article>
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
      h3 {
        margin: 0;
        font-size: 1.05rem;
      }
      .lead,
      .muted {
        color: var(--pw-muted);
        margin: 0;
      }
      .card {
        background: var(--pw-surface);
        border: 1px solid var(--pw-border);
        border-radius: 12px;
        padding: 1rem;
        display: grid;
        gap: 0.75rem;
        align-content: start;
        min-width: 0;
      }
      .error {
        color: var(--pw-danger);
        margin: 0;
      }
      .catalog-group {
        display: grid;
        gap: 0.35rem;
        padding-top: 0.5rem;
        border-top: 1px solid #eef2f7;
      }
      .catalog-group:first-of-type {
        border-top: 0;
        padding-top: 0;
      }
      ul {
        list-style: none;
        padding: 0;
        margin: 0;
        display: grid;
        gap: 0.45rem;
      }
      .flat li {
        border: 0;
        padding: 0.2rem 0;
        display: flex;
        justify-content: space-between;
        gap: 0.75rem;
        align-items: center;
      }
      small {
        color: var(--pw-muted);
      }
      .code {
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        font-size: 0.8rem;
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
