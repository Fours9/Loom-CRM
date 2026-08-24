import { Component, input, output, signal } from '@angular/core';
import type { EmploymentCatalogItem } from '../settings/settings-org-api.service';
import { moveCatalogItem } from './employment-catalog-reorder';

@Component({
  selector: 'loom-employment-catalog-list',
  standalone: true,
  template: `
    @if (!items().length) {
      <p class="muted">{{ emptyLabel() }}</p>
    } @else {
      <ul class="rows" (dragover)="$event.preventDefault()">
        @for (item of items(); track item.id; let index = $index) {
          <li
            [class.dragging]="dragFrom() === index"
            [class.drag-over]="dragOver() === index && dragFrom() !== index"
            (dragover)="onRowDragOver($event, index)"
            (drop)="onRowDrop($event, index)"
            (dragend)="clearDrag()"
          >
            <button
              type="button"
              class="handle"
              draggable="true"
              title="Перетягнути"
              aria-label="Перетягнути для зміни порядку"
              (dragstart)="onHandleDragStart($event, index)"
              (click)="$event.preventDefault()"
            >
              <span class="bars" aria-hidden="true"></span>
            </button>
            <span class="body">
              <span class="name">{{ item.name }}</span>
              @if (item.description) {
                <small class="desc">{{ item.description }}</small>
              }
              @if (!item.isActive) {
                <small class="badge">вимкнено</small>
              }
            </span>
            <span class="actions">
              <label class="toggle" [title]="item.isActive ? 'Увімкнено' : 'Вимкнено'">
                <input
                  type="checkbox"
                  [checked]="item.isActive"
                  (change)="toggled.emit({ item, isActive: $any($event.target).checked })"
                />
              </label>
              <button
                type="button"
                class="icon-btn"
                title="Редагувати"
                aria-label="Редагувати"
                (click)="edit.emit(item)"
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
                title="Видалити"
                aria-label="Видалити"
                (click)="remove.emit(item)"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"
                  />
                </svg>
              </button>
            </span>
          </li>
        }
      </ul>
    }
  `,
  styles: [
    `
      .rows {
        list-style: none;
        padding: 0;
        margin: 0;
        display: grid;
        gap: 0.5rem;
      }
      li {
        display: flex;
        gap: 0.65rem;
        align-items: center;
        border: 1px solid var(--pw-border);
        border-radius: 10px;
        padding: 0.65rem 0.75rem;
        background: var(--pw-surface);
      }
      li.dragging {
        opacity: 0.55;
      }
      li.drag-over {
        border-color: var(--pw-accent);
        box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--pw-accent) 45%, transparent);
      }
      .handle {
        flex: 0 0 auto;
        display: inline-grid;
        place-items: center;
        width: 1.75rem;
        height: 1.75rem;
        padding: 0;
        border: 0;
        border-radius: 6px;
        background: transparent;
        color: var(--pw-muted);
        cursor: grab;
      }
      .handle:active {
        cursor: grabbing;
      }
      .bars {
        display: block;
        width: 0.85rem;
        height: 0.7rem;
        background:
          linear-gradient(currentColor, currentColor) 0 0 / 100% 2px no-repeat,
          linear-gradient(currentColor, currentColor) 0 50% / 100% 2px no-repeat,
          linear-gradient(currentColor, currentColor) 0 100% / 100% 2px no-repeat;
      }
      .body {
        display: flex;
        flex: 1 1 auto;
        flex-wrap: wrap;
        gap: 0.25rem 0.65rem;
        align-items: baseline;
        min-width: 0;
      }
      .name {
        font-weight: 600;
      }
      .desc {
        color: var(--pw-muted);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 100%;
      }
      .badge {
        display: inline-block;
        padding: 0.1rem 0.45rem;
        border-radius: 999px;
        font-size: 0.75rem;
        background: color-mix(in srgb, var(--pw-muted) 18%, transparent);
        color: var(--pw-muted);
      }
      .actions {
        display: flex;
        gap: 0.25rem;
        align-items: center;
        flex: 0 0 auto;
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
        cursor: pointer;
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
      .muted {
        margin: 0;
        color: var(--pw-muted);
      }
    `,
  ],
})
export class EmploymentCatalogListComponent {
  readonly items = input.required<EmploymentCatalogItem[]>();
  readonly emptyLabel = input.required<string>();

  readonly reordered = output<EmploymentCatalogItem[]>();
  readonly edit = output<EmploymentCatalogItem>();
  readonly remove = output<EmploymentCatalogItem>();
  readonly toggled = output<{ item: EmploymentCatalogItem; isActive: boolean }>();

  readonly dragFrom = signal<number | null>(null);
  readonly dragOver = signal<number | null>(null);

  onHandleDragStart(event: DragEvent, index: number): void {
    this.dragFrom.set(index);
    this.dragOver.set(index);
    event.dataTransfer?.setData('text/plain', String(index));
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
    }
  }

  onRowDragOver(event: DragEvent, index: number): void {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
    this.dragOver.set(index);
  }

  onRowDrop(event: DragEvent, toIndex: number): void {
    event.preventDefault();
    const fromIndex = this.dragFrom();
    this.clearDrag();
    if (fromIndex == null || fromIndex === toIndex) {
      return;
    }
    this.reordered.emit(moveCatalogItem(this.items(), fromIndex, toIndex));
  }

  clearDrag(): void {
    this.dragFrom.set(null);
    this.dragOver.set(null);
  }
}
