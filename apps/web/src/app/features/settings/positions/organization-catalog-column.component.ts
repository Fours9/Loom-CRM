import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PositionManagementFacade } from './position-management.facade';

@Component({
  selector: 'loom-organization-catalog-column',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="catalog-rail">
      <article
        class="card panel"
        [class.collapsed]="!vm.panelOpen().directions"
        [attr.aria-expanded]="vm.panelOpen().directions"
      >
        <button
          type="button"
          class="panel-toggle"
          [attr.title]="vm.panelOpen().directions ? 'Згорнути: Напрямки' : 'Напрямки'"
          [attr.aria-label]="vm.panelOpen().directions ? 'Згорнути напрямки' : 'Розгорнути напрямки'"
          (click)="vm.togglePanel('directions')"
        >
          @if (vm.panelOpen().directions) {
            <h3>Напрямки</h3>
            <span class="panel-caret" aria-hidden="true"></span>
          } @else {
            <svg class="panel-icon" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path
                fill="currentColor"
                d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z"
              />
            </svg>
          }
        </button>
        <div class="panel-body">
          @if (vm.canManageDirections()) {
            <form class="inline" novalidate (submit)="$event.preventDefault()">
              <input
                [(ngModel)]="vm.newDirection"
                name="newDirection"
                placeholder="Назва напрямку"
              />
              <button type="button" (click)="vm.saveDirection()">
                {{ vm.editingDirectionId() ? 'Зберегти' : 'Додати' }}
              </button>
              @if (vm.editingDirectionId()) {
                <button type="button" class="ghost-neutral" (click)="vm.cancelEditDirection()">
                  Скасувати
                </button>
              }
            </form>
          }
          <ul>
            @for (d of vm.directions(); track d.id) {
              <li>
                <span>
                  {{ d.name }}
                  @if (!d.isActive) {
                    <small class="badge">вимкнено</small>
                  }
                </span>
                @if (vm.canManageDirections()) {
                  <span class="row-actions">
                    <label class="toggle" [title]="d.isActive ? 'Увімкнено' : 'Вимкнено'">
                      <input
                        type="checkbox"
                        [checked]="d.isActive"
                        (change)="vm.setDirectionActive(d, $any($event.target).checked)"
                      />
                    </label>
                    <button
                      type="button"
                      class="icon-btn"
                      title="Редагувати"
                      aria-label="Редагувати напрямок"
                      (click)="vm.startEditDirection(d)"
                    >
                      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                        <path
                          fill="currentColor"
                          d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"
                        />
                      </svg>
                    </button>
                    <button
                      type="button"
                      class="icon-btn danger"
                      title="Видалити назавжди"
                      aria-label="Видалити напрямок назавжди"
                      (click)="vm.hardDeleteDirection(d)"
                    >
                      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                        <path
                          fill="currentColor"
                          d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"
                        />
                      </svg>
                    </button>
                  </span>
                }
              </li>
            }
          </ul>
        </div>
      </article>

      <article
        class="card panel"
        [class.collapsed]="!vm.panelOpen().departments"
        [attr.aria-expanded]="vm.panelOpen().departments"
      >
        <button
          type="button"
          class="panel-toggle"
          [attr.title]="vm.panelOpen().departments ? 'Згорнути: Відділи' : 'Відділи'"
          [attr.aria-label]="vm.panelOpen().departments ? 'Згорнути відділи' : 'Розгорнути відділи'"
          (click)="vm.togglePanel('departments')"
        >
          @if (vm.panelOpen().departments) {
            <h3>Відділи</h3>
            <span class="panel-caret" aria-hidden="true"></span>
          } @else {
            <svg class="panel-icon" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path
                fill="currentColor"
                d="M12 2 4.5 20.3l1.8.7L12 6.2l5.7 14.8 1.8-.7L12 2zm0 8.5-2.2 5.7h4.4L12 10.5z"
              />
            </svg>
          }
        </button>
        <div class="panel-body">
          @if (vm.canManageDepartments()) {
            <form class="dept-form" novalidate (submit)="$event.preventDefault()">
              <input
                [(ngModel)]="vm.newDepartment"
                name="newDepartment"
                placeholder="Назва відділу"
              />
              <select [(ngModel)]="vm.newDepartmentDirectionId" name="newDepartmentDirectionId">
                <option value="">Без напрямку</option>
                @for (dir of vm.formDirectionOptions(); track dir.id) {
                  <option [value]="dir.id">{{ dir.name }}</option>
                }
              </select>
              <div class="form-actions">
                <button type="button" (click)="vm.saveDepartment()">
                  {{ vm.editingDepartmentId() ? 'Зберегти' : 'Додати' }}
                </button>
                @if (vm.editingDepartmentId()) {
                  <button type="button" class="ghost-neutral" (click)="vm.cancelEditDepartment()">
                    Скасувати
                  </button>
                }
              </div>
            </form>
          }
          <ul>
            @for (d of vm.departments(); track d.id) {
              <li>
                <span>
                  {{ d.name }}
                  @if (vm.departmentDirectionLabel(d)) {
                    <small>· {{ vm.departmentDirectionLabel(d) }}</small>
                  }
                  @if (!d.isActive || d.isHidden) {
                    <small class="badge">приховано</small>
                  }
                </span>
                @if (vm.canManageDepartments()) {
                  <span class="row-actions">
                    <label
                      class="toggle"
                      [title]="d.isActive && !d.isHidden ? 'Увімкнено' : 'Вимкнено'"
                    >
                      <input
                        type="checkbox"
                        [checked]="d.isActive && !d.isHidden"
                        (change)="vm.setDepartmentActive(d, $any($event.target).checked)"
                      />
                    </label>
                    <button
                      type="button"
                      class="icon-btn"
                      title="Редагувати"
                      aria-label="Редагувати відділ"
                      (click)="vm.startEditDepartment(d)"
                    >
                      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                        <path
                          fill="currentColor"
                          d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"
                        />
                      </svg>
                    </button>
                    <button
                      type="button"
                      class="icon-btn danger"
                      title="Видалити назавжди"
                      aria-label="Видалити відділ назавжди"
                      (click)="vm.hardDeleteDepartment(d)"
                    >
                      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                        <path
                          fill="currentColor"
                          d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"
                        />
                      </svg>
                    </button>
                  </span>
                }
              </li>
            }
          </ul>
        </div>
      </article>

      <article
        class="card panel card-positions"
        [class.collapsed]="!vm.panelOpen().positions"
        [attr.aria-expanded]="vm.panelOpen().positions"
      >
        <button
          type="button"
          class="panel-toggle"
          [attr.title]="vm.panelOpen().positions ? 'Згорнути: Посади' : 'Посади'"
          [attr.aria-label]="vm.panelOpen().positions ? 'Згорнути посади' : 'Розгорнути посади'"
          (click)="vm.togglePanel('positions')"
        >
          @if (vm.panelOpen().positions) {
            <h3>Посади</h3>
            <span class="panel-caret" aria-hidden="true"></span>
          } @else {
            <svg class="panel-icon" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path
                fill="currentColor"
                d="M20 6h-4V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2H4a2 2 0 0 0-2 2v11a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3V8a2 2 0 0 0-2-2zM10 4h4v2h-4V4zm10 15a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V8h16v11z"
              />
            </svg>
          }
        </button>
        <div class="panel-body">
          @if (vm.canManagePositions()) {
            <form class="position-form" novalidate (submit)="$event.preventDefault()">
              <label>
                Назва
                <input
                  [(ngModel)]="vm.formName"
                  name="formName"
                  placeholder="Назва посади"
                />
              </label>
              <label>
                Відділ
                <select
                  [(ngModel)]="vm.formDepartmentId"
                  name="formDepartmentId"
                  (ngModelChange)="vm.onFormDepartmentChange()"
                >
                  <option value="">Без відділу</option>
                  @for (d of vm.formDepartmentOptions(); track d.id) {
                    <option [value]="d.id">{{ d.name }}</option>
                  }
                </select>
              </label>
              @if (vm.formDepartmentId) {
                <p class="hint">
                  @if (vm.inheritedDirectionLabel()) {
                    Напрямок від відділу: {{ vm.inheritedDirectionLabel() }}
                  } @else {
                    Відділ без напрямку — посада успадковує відсутність напрямку.
                  }
                </p>
              } @else {
                <label>
                  Напрямок
                  <select [(ngModel)]="vm.formDirectionId" name="formDirectionId">
                    <option value="">Без напрямку</option>
                    @for (dir of vm.formPositionDirectionOptions(); track dir.id) {
                      <option [value]="dir.id">{{ dir.name }}</option>
                    }
                  </select>
                </label>
              }
              <label>
                Опис
                <textarea
                  [(ngModel)]="vm.formDescription"
                  name="formDescription"
                  rows="2"
                  placeholder="Опис посади (необовʼязково)"
                ></textarea>
              </label>
              @if (vm.editingId()) {
                <label class="check">
                  <input type="checkbox" [(ngModel)]="vm.formIsActive" name="formIsActive" />
                  Увімкнено
                </label>
              }
              <div class="form-actions">
                <button type="button" (click)="vm.savePosition()">
                  {{ vm.editingId() ? 'Зберегти' : 'Додати' }}
                </button>
                @if (vm.editingId()) {
                  <button type="button" class="ghost-neutral" (click)="vm.cancelEdit()">Скасувати</button>
                }
              </div>
            </form>
          }
          <ul>
            @for (p of vm.positions(); track p.id) {
              <li
                class="position-row"
                [class.selected]="vm.selectedPositionId() === p.id"
              >
                <button type="button" class="select-pos" (click)="vm.selectPosition(p)">
                  <strong>{{ p.name }}</strong>
                  <small>
                    {{ vm.departmentLabel(p) }}
                    @if (vm.directionLabel(p)) {
                      · {{ vm.directionLabel(p) }}
                    }
                  </small>
                  @if (p.description) {
                    <small class="desc">{{ p.description }}</small>
                  }
                  @if (!p.isActive) {
                    <small class="badge">вимкнено</small>
                  }
                </button>
                @if (vm.canManagePositions()) {
                  <span class="row-actions">
                    <label class="toggle" [title]="p.isActive ? 'Увімкнено' : 'Вимкнено'">
                      <input
                        type="checkbox"
                        [checked]="p.isActive"
                        (click)="$event.stopPropagation()"
                        (change)="vm.setPositionActive(p, $any($event.target).checked)"
                      />
                    </label>
                    <button
                      type="button"
                      class="icon-btn"
                      title="Редагувати"
                      aria-label="Редагувати посаду"
                      (click)="vm.startEdit(p)"
                    >
                      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                        <path
                          fill="currentColor"
                          d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"
                        />
                      </svg>
                    </button>
                    <button
                      type="button"
                      class="icon-btn danger"
                      title="Видалити назавжди"
                      aria-label="Видалити посаду назавжди"
                      (click)="vm.hardDeletePosition(p)"
                    >
                      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                        <path
                          fill="currentColor"
                          d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"
                        />
                      </svg>
                    </button>
                  </span>
                }
              </li>
            }
          </ul>
        </div>
      </article>
    </div>
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
      .catalog-rail {
        display: flex;
        flex-wrap: nowrap;
        gap: 1rem;
        align-items: stretch;
        min-width: 0;
        overflow-x: auto;
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
      .card.panel {
        flex: 1 1 0;
        min-width: 14rem;
        max-width: 100%;
        transition:
          flex-basis 0.22s ease,
          min-width 0.22s ease,
          max-width 0.22s ease,
          padding 0.22s ease;
      }
      .card.panel.card-positions {
        flex-grow: 1.35;
      }
      .card.panel.collapsed {
        flex: 0 0 3.25rem;
        min-width: 3.25rem;
        max-width: 3.25rem;
        padding: 0.65rem 0.35rem;
        overflow: hidden;
      }
      .panel-toggle {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
        width: 100%;
        margin: 0;
        padding: 0;
        border: 0;
        background: transparent;
        color: inherit;
        cursor: pointer;
        text-align: left;
        min-height: 2rem;
      }
      .panel-toggle h3 {
        margin: 0;
        font-size: 1.05rem;
      }
      .panel-toggle .panel-caret {
        flex: 0 0 auto;
        width: 1.6rem;
        height: 1.6rem;
        display: grid;
        place-items: center;
        border-radius: 6px;
        border: 1px solid color-mix(in srgb, var(--pw-muted) 55%, transparent);
        background: var(--pw-surface-2, color-mix(in srgb, var(--pw-muted) 8%, var(--pw-surface)));
        color: var(--pw-text-strong, inherit);
        font-size: 1.05rem;
        line-height: 1;
        transform: rotate(90deg);
        transition:
          transform 0.15s ease,
          background 0.15s ease,
          border-color 0.15s ease,
          color 0.15s ease;
      }
      .panel-toggle .panel-caret::before {
        content: '▾';
      }
      .panel-toggle:hover .panel-caret {
        background: var(--pw-accent-soft);
        border-color: var(--pw-accent);
        color: var(--pw-accent);
      }
      .card.panel.collapsed .panel-toggle {
        justify-content: center;
        padding: 0.25rem 0;
      }
      .panel-icon {
        display: block;
        color: var(--pw-accent);
      }
      .panel-body {
        display: grid;
        gap: 0.75rem;
        min-width: 0;
        overflow: hidden;
      }
      .card.panel.collapsed .panel-body {
        display: none;
      }
      @media (prefers-reduced-motion: reduce) {
        .card.panel {
          transition: none;
        }
      }
      @media (max-width: 640px) {
        .catalog-rail {
          flex-wrap: wrap;
        }
        .card.panel,
        .card.panel.collapsed {
          flex: 1 1 100%;
          min-width: 0;
          max-width: none;
        }
        .card.panel.collapsed {
          flex-basis: 3.25rem;
          max-width: 3.25rem;
          min-width: 3.25rem;
        }
      }
      .inline {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        align-items: center;
      }
      .dept-form {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        align-items: center;
        margin-bottom: 0.5rem;
      }
      .dept-form input,
      .dept-form select {
        flex: 1 1 120px;
        min-width: 0;
      }
      .hint {
        margin: 0;
        font-size: 0.85rem;
        opacity: 0.75;
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
      .form-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
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
      .position-row {
        align-items: flex-start;
      }
      .position-row.selected {
        background: #f0f7ff;
        margin: 0 -0.5rem;
        padding-left: 0.5rem;
        padding-right: 0.5rem;
        border-radius: 8px;
      }
      .select-pos {
        display: grid;
        gap: 0.15rem;
        min-width: 0;
        flex: 1 1 auto;
        text-align: left;
        background: transparent;
        color: inherit;
        border: 0;
        padding: 0.15rem 0;
        cursor: pointer;
      }
      .row-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.25rem;
        flex-shrink: 0;
        align-items: center;
      }
      .icon-btn {
        display: inline-grid;
        place-items: center;
        width: 2rem;
        height: 2rem;
        padding: 0;
        border-radius: 8px;
        background: transparent;
        color: var(--pw-text);
        border: 1px solid var(--pw-border-strong);
      }
      .icon-btn:hover {
        background: color-mix(in srgb, var(--pw-accent) 10%, transparent);
      }
      .icon-btn.danger {
        color: var(--pw-danger);
        border-color: #f3d1d1;
      }
      .icon-btn.danger:hover {
        background: color-mix(in srgb, var(--pw-danger) 12%, transparent);
      }
      .toggle {
        display: inline-grid;
        place-items: center;
        margin: 0;
        cursor: pointer;
        min-height: 2rem;
        padding: 0 0.2rem;
      }
      .toggle input {
        width: 1.05rem;
        height: 1.05rem;
        accent-color: var(--pw-accent);
        cursor: pointer;
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
    `,
  ],
})
export class OrganizationCatalogColumnComponent {
  readonly vm = inject(PositionManagementFacade);
}
