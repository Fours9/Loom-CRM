import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PositionManagementFacade } from './position-management.facade';

@Component({
  selector: 'loom-position-details-panel',
  standalone: true,
  imports: [FormsModule],
  template: `
    @if (vm.selectedPosition(); as pos) {
      <article class="card catalog-panel">
        <div class="panel-head">
          <h3>Каталог посади: {{ pos.name }}</h3>
          <span class="head-actions">
            @if (vm.canManagePositions()) {
              <button type="button" (click)="vm.startEdit(pos)">Редагувати</button>
            }
            <button type="button" class="ghost-neutral" (click)="vm.clearSelection()">Закрити</button>
          </span>
        </div>
        <div class="tabs" role="tablist">
          <button
            type="button"
            role="tab"
            [class.active]="vm.catalogTab() === 'skills'"
            (click)="vm.catalogTab.set('skills')"
          >
            Навички
          </button>
          <button
            type="button"
            role="tab"
            [class.active]="vm.catalogTab() === 'goals'"
            (click)="vm.catalogTab.set('goals')"
          >
            Цілі
          </button>
          <button
            type="button"
            role="tab"
            [class.active]="vm.catalogTab() === 'duties'"
            (click)="vm.catalogTab.set('duties')"
          >
            Обовʼязки
          </button>
        </div>

        @if (vm.catalogTab() === 'skills') {
          <div class="tab-body">
            <p class="hint">Навички посади змінюються в модалці редагування.</p>
            <ul>
              @for (r of vm.skillRequirements(); track r.id) {
                <li>
                  <span>
                    <strong>{{ r.skillName || r.skillCode }}</strong>
                    <small>{{ vm.formatNativeTarget(r) }}</small>
                    @if (r.required) {
                      <small class="badge">обовʼязкова</small>
                    }
                  </span>
                </li>
              } @empty {
                <li class="muted-row">Немає вимог до навичок</li>
              }
            </ul>
          </div>
        }

        @if (vm.catalogTab() === 'goals') {
          <div class="tab-body">
            @if (vm.canManagePositions()) {
              <form class="position-form" (ngSubmit)="vm.addGoalTemplate()">
                <label>
                  Тип
                  <select [(ngModel)]="vm.goalKind" name="goalKind">
                    <option value="career">Карʼєра</option>
                    <option value="probation">Випробувальний</option>
                    <option value="quarterly">Квартальна</option>
                  </select>
                </label>
                <label>
                  Назва
                  <input [(ngModel)]="vm.goalTitle" name="goalTitle" placeholder="Назва цілі" />
                </label>
                <label>
                  Опис
                  <textarea
                    [(ngModel)]="vm.goalDescription"
                    name="goalDescription"
                    rows="2"
                    placeholder="Опис (необовʼязково)"
                  ></textarea>
                </label>
                <button type="submit">Додати шаблон</button>
              </form>
            }
            <ul>
              @for (g of vm.goalTemplates(); track g.id) {
                <li>
                  <span>
                    <strong>{{ g.title }}</strong>
                    <small class="badge">{{ vm.goalKindLabel(g.goalKind) }}</small>
                    @if (g.description) {
                      <small class="desc">{{ g.description }}</small>
                    }
                  </span>
                  @if (vm.canManagePositions()) {
                    <button type="button" class="ghost" (click)="vm.removeGoalTemplate(g)">
                      Прибрати
                    </button>
                  }
                </li>
              } @empty {
                <li class="muted-row">Немає шаблонів цілей</li>
              }
            </ul>
          </div>
        }

        @if (vm.catalogTab() === 'duties') {
          <div class="tab-body">
            @if (vm.canManagePositions()) {
              <form class="position-form" (ngSubmit)="vm.addDuty()">
                <label>
                  Назва
                  <input [(ngModel)]="vm.dutyTitle" name="dutyTitle" placeholder="Обовʼязок" />
                </label>
                <label>
                  Опис
                  <textarea
                    [(ngModel)]="vm.dutyDescription"
                    name="dutyDescription"
                    rows="2"
                    placeholder="Опис (необовʼязково)"
                  ></textarea>
                </label>
                <label>
                  Порядок
                  <input
                    type="number"
                    [(ngModel)]="vm.dutySortOrder"
                    name="dutySortOrder"
                    min="0"
                  />
                </label>
                <button type="submit">Додати</button>
              </form>
            }
            <ul>
              @for (d of vm.duties(); track d.id) {
                <li>
                  <span>
                    <strong>{{ d.title }}</strong>
                    <small>порядок {{ d.sortOrder }}</small>
                    @if (d.description) {
                      <small class="desc">{{ d.description }}</small>
                    }
                  </span>
                  @if (vm.canManagePositions()) {
                    <span class="row-actions">
                      <button
                        type="button"
                        class="ghost-neutral"
                        (click)="vm.moveDuty(d, -1)"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        class="ghost-neutral"
                        (click)="vm.moveDuty(d, 1)"
                      >
                        ↓
                      </button>
                      <button type="button" class="ghost" (click)="vm.removeDuty(d)">Прибрати</button>
                    </span>
                  }
                </li>
              } @empty {
                <li class="muted-row">Немає обовʼязків</li>
              }
            </ul>
          </div>
        }
      </article>
    }
  `,
  styles: [
    `
      :host {
        display: contents;
      }
      h3 {
        margin: 0;
        font-size: 1.05rem;
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
      .inline {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        align-items: center;
      }
      .inline input,
      .inline select {
        flex: 1 1 120px;
        min-width: 0;
      }
      .inline button {
        flex: 0 0 auto;
        white-space: nowrap;
      }
      .add-row .level {
        display: flex;
        gap: 0.35rem;
        align-items: center;
        font-size: 0.9rem;
      }
      .add-row .level input {
        width: 3.5rem;
        flex: 0 0 auto;
      }
      .position-form {
        display: grid;
        gap: 0.55rem;
      }
      .position-form label {
        display: grid;
        gap: 0.3rem;
        font-size: 0.9rem;
      }
      .position-form label.check {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 0.5rem;
      }
      .position-form label.check input[type='checkbox'] {
        width: 1rem;
        height: 1rem;
        margin: 0;
        padding: 0;
        border: none;
        border-radius: 2px;
        flex: 0 0 auto;
      }
      input,
      select,
      textarea,
      button {
        padding: 0.5rem 0.7rem;
        border-radius: 8px;
        border: 1px solid var(--pw-border-strong);
        box-sizing: border-box;
        font: inherit;
      }
      textarea {
        resize: vertical;
        min-height: 2.5rem;
      }
      button {
        background: var(--pw-accent);
        color: var(--pw-on-accent);
        border: 0;
        cursor: pointer;
      }
      button:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }
      .ghost {
        background: transparent;
        color: var(--pw-danger);
        border: 1px solid #f3d1d1;
      }
      .ghost-neutral {
        background: transparent;
        color: var(--pw-text);
        border: 1px solid var(--pw-border-strong);
      }
      ul {
        list-style: none;
        padding: 0;
        margin: 0;
        display: grid;
        gap: 0.45rem;
      }
      li {
        display: flex;
        justify-content: space-between;
        gap: 0.75rem;
        align-items: center;
        padding: 0.35rem 0;
        border-bottom: 1px solid #eef2f7;
      }
      .row-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.25rem;
        flex-shrink: 0;
        align-items: center;
      }
      small {
        color: var(--pw-muted);
      }
      .desc {
        display: block;
        margin-top: 0.15rem;
      }
      .badge {
        background: #fef3c7;
        color: #92400e;
        padding: 0.1rem 0.4rem;
        border-radius: 999px;
        margin-left: 0.35rem;
      }
      .check {
        display: flex;
        gap: 0.5rem;
        align-items: center;
      }
      .check input[type='checkbox'] {
        width: 1rem;
        height: 1rem;
        margin: 0;
        padding: 0;
        border: none;
        flex: 0 0 auto;
      }
      .panel-head {
        display: flex;
        justify-content: space-between;
        gap: 0.75rem;
        align-items: center;
      }
      .head-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.35rem;
      }
      .hint {
        margin: 0;
        font-size: 0.85rem;
        color: var(--pw-muted);
      }
      .tabs {
        display: flex;
        flex-wrap: wrap;
        gap: 0.35rem;
      }
      .tabs button {
        background: transparent;
        color: var(--pw-text);
        border: 1px solid var(--pw-border-strong);
      }
      .tabs button.active {
        background: var(--pw-accent);
        color: var(--pw-on-accent);
        border-color: transparent;
      }
      .tab-body {
        display: grid;
        gap: 0.75rem;
      }
      .muted-row {
        color: var(--pw-muted);
        border: 0;
      }
    `,
  ],
})
export class PositionDetailsPanelComponent {
  readonly vm = inject(PositionManagementFacade);
}
