import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';

export interface MultiSelectItem {
  id: string;
  label: string;
}

@Component({
  selector: 'app-multi-select-list',
  standalone: true,
  template: `
    <div class="ms" [class.open]="open" [class.drop-up]="openUp" [class.disabled]="disabled">
      <div
        class="trigger"
        role="button"
        [attr.tabindex]="disabled || searchable ? -1 : 0"
        (click)="onTriggerClick($event)"
        (keydown.enter)="onTriggerClick($event)"
        (keydown.space)="onSpace($event)"
        [attr.aria-expanded]="open"
        [attr.aria-disabled]="disabled"
        aria-haspopup="listbox"
      >
        <div class="chips">
          @if (!searchable && selectedItems.length === 0) {
            <span class="placeholder">{{ placeholder }}</span>
          } @else if (showSelectAll && allSelected) {
            <span class="chip" (click)="$event.stopPropagation()">
              <span class="chip-label">{{ selectAllLabel }}</span>
              <button
                type="button"
                class="chip-remove"
                [attr.aria-label]="'Прибрати ' + selectAllLabel"
                (click)="clearAll($event)"
              >
                ×
              </button>
            </span>
          } @else {
            @for (item of selectedItems; track item.id) {
              <span class="chip" (click)="$event.stopPropagation()">
                <span class="chip-label">{{ item.label }}</span>
                <button
                  type="button"
                  class="chip-remove"
                  [attr.aria-label]="'Прибрати ' + item.label"
                  (click)="remove(item.id, $event)"
                >
                  ×
                </button>
              </span>
            }
          }
          @if (searchable) {
            <input
              #filterInput
              class="filter"
              type="text"
              [disabled]="disabled"
              [value]="query"
              [placeholder]="selectedItems.length === 0 ? placeholder : searchPlaceholder"
              (click)="$event.stopPropagation()"
              (input)="onQuery($event)"
              (focus)="openFromFilter()"
              (keydown)="onFilterKeydown($event)"
            />
          }
        </div>
        <span class="caret" aria-hidden="true">▾</span>
      </div>

      @if (open) {
        <ul class="dropdown" role="listbox" aria-multiselectable="true" (click)="$event.stopPropagation()">
          @if (showSelectAll && visibleItems.length > 0 && !query.trim()) {
            <li
              role="option"
              [attr.aria-selected]="allSelected"
              [class.selected]="allSelected"
              (mousedown)="$event.preventDefault()"
              (click)="toggleSelectAll($event)"
            >
              <span class="check" aria-hidden="true">
                @if (allSelected) {
                  ✓
                }
              </span>
              <span>{{ selectAllLabel }}</span>
            </li>
          }
          @for (item of visibleItems; track item.id) {
            <li
              role="option"
              [attr.aria-selected]="isSelected(item.id)"
              [class.selected]="isSelected(item.id)"
              (mousedown)="$event.preventDefault()"
              (click)="toggleItem(item.id, $event)"
            >
              <span class="check" aria-hidden="true">
                @if (isSelected(item.id)) {
                  ✓
                }
              </span>
              <span>{{ item.label }}</span>
            </li>
          }
          @if (visibleItems.length === 0) {
            <li class="empty">{{ query.trim() ? 'Нічого не знайдено' : 'Немає варіантів' }}</li>
          }
        </ul>
      }
    </div>
  `,
  styles: [
    `
      .ms {
        position: relative;
        width: 100%;
      }
      .trigger {
        display: flex;
        align-items: flex-start;
        gap: 0.5rem;
        box-sizing: border-box;
        width: 100%;
        height: var(--ms-trigger-height, 2.75rem);
        padding: 0.35rem 0.55rem 0.35rem 0.65rem;
        border: 1px solid var(--pw-border-strong);
        border-radius: 8px;
        background: var(--pw-surface);
        text-align: left;
        cursor: pointer;
      }
      .ms.open .trigger {
        border-color: var(--pw-accent);
        box-shadow: 0 0 0 2px rgba(31, 75, 122, 0.12);
      }
      .ms.disabled .trigger {
        opacity: 0.45;
        cursor: not-allowed;
      }
      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 0.35rem;
        flex: 1;
        min-width: 0;
        height: 100%;
        overflow-x: hidden;
        overflow-y: auto;
        align-content: flex-start;
        scrollbar-gutter: stable;
        scrollbar-width: thin;
      }
      .placeholder {
        color: var(--pw-muted);
        font-size: 0.95rem;
        line-height: 1.9rem;
      }
      .filter {
        flex: 1 1 7rem;
        min-width: 5rem;
        height: 1.7rem;
        margin: 0;
        padding: 0;
        border: 0;
        background: transparent;
        color: var(--pw-text);
        font: inherit;
        outline: none;
      }
      .filter::placeholder {
        color: var(--pw-muted);
      }
      .chip {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        max-width: 100%;
        padding: 0.15rem 0.25rem 0.15rem 0.5rem;
        border-radius: 999px;
        background: var(--pw-accent-soft);
        color: var(--pw-accent);
        font-size: 0.85rem;
      }
      .chip-label {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .chip-remove {
        border: 0;
        background: transparent;
        color: var(--pw-muted);
        cursor: pointer;
        font-size: 1rem;
        line-height: 1;
        padding: 0 0.25rem;
        border-radius: 999px;
      }
      .chip-remove:hover {
        background: var(--pw-hover);
        color: var(--pw-accent);
      }
      .caret {
        color: var(--pw-muted);
        flex-shrink: 0;
        font-size: 0.75rem;
        margin-top: 0.4rem;
      }
      .dropdown {
        position: absolute;
        z-index: 20;
        top: calc(100% + 4px);
        bottom: auto;
        left: 0;
        right: 0;
        margin: 0;
        padding: 0.35rem;
        list-style: none;
        max-height: 14rem;
        overflow: auto;
        border: 1px solid var(--pw-border-strong);
        border-radius: 8px;
        background: var(--pw-surface);
        box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
      }
      .ms.drop-up .dropdown {
        top: auto;
        bottom: calc(100% + 4px);
      }
      .dropdown li {
        display: flex;
        align-items: center;
        gap: 0.55rem;
        padding: 0.55rem 0.65rem;
        border-radius: 6px;
        cursor: pointer;
        color: var(--pw-text);
      }
      .dropdown li:hover {
        background: var(--pw-hover);
      }
      .dropdown li.selected {
        background: var(--pw-accent-soft);
      }
      .check {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 1.1rem;
        height: 1.1rem;
        border: 1px solid var(--pw-muted);
        border-radius: 4px;
        font-size: 0.75rem;
        color: var(--pw-accent);
        flex-shrink: 0;
        background: var(--pw-surface);
      }
      .dropdown li.selected .check {
        border-color: var(--pw-accent);
        background: var(--pw-accent);
        color: var(--pw-on-accent);
      }
      .empty {
        color: var(--pw-muted);
        cursor: default;
      }
      .empty:hover {
        background: transparent;
      }
    `,
  ],
})
export class MultiSelectListComponent implements OnChanges {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly dropdownMaxPx = 14 * 16;
  private readonly dropdownGapPx = 4;

  @Input() items: MultiSelectItem[] = [];
  @Input() selectedIds: string[] = [];
  /** Kept for compatibility with existing call sites */
  @Input() availableLabel = 'Доступні';
  @Input() selectedLabel = 'Обрані';
  @Input() placeholder = 'Оберіть…';
  @Input() searchable = false;
  @Input() searchPlaceholder = 'Пошук…';
  /** Показує пункт «Всі» на початку списку (select/deselect all). */
  @Input() showSelectAll = false;
  @Input() selectAllLabel = 'Всі';
  @Input() disabled = false;
  @Output() selectedIdsChange = new EventEmitter<string[]>();

  open = false;
  openUp = false;
  query = '';
  /** Local copy so rapid clicks keep previous selections before parent CD. */
  private localSelectedIds: string[] = [];

  get selectedItems(): MultiSelectItem[] {
    const byId = new Map(this.items.map((item) => [item.id, item]));
    return this.localSelectedIds
      .map((id) => byId.get(id))
      .filter((item): item is MultiSelectItem => !!item);
  }

  get visibleItems(): MultiSelectItem[] {
    const q = this.query.trim().toLocaleLowerCase('uk');
    if (!q) return this.items;
    return this.items.filter((item) => item.label.toLocaleLowerCase('uk').includes(q));
  }

  get allSelected(): boolean {
    return (
      this.items.length > 0 &&
      this.items.every((item) => this.localSelectedIds.includes(item.id))
    );
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedIds']) {
      this.localSelectedIds = Array.isArray(this.selectedIds) ? [...this.selectedIds] : [];
    }
    if (this.disabled) {
      this.open = false;
      this.openUp = false;
      this.query = '';
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.open) {
      return;
    }
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.close();
    }
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    if (this.open) this.updatePlacement();
  }

  onTriggerClick(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.disabled) return;
    this.open = !this.open;
    if (this.open) {
      this.openUp = this.shouldOpenUp(this.estimatedDropdownHeight());
      setTimeout(() => {
        this.updatePlacement();
        this.focusFilter();
      });
    } else {
      this.close();
    }
  }

  openFromFilter(): void {
    if (this.disabled || this.open) return;
    this.open = true;
    this.openUp = this.shouldOpenUp(this.estimatedDropdownHeight());
    setTimeout(() => this.updatePlacement());
  }

  onQuery(event: Event): void {
    if (this.disabled) return;
    this.query = (event.target as HTMLInputElement).value;
    this.openFromFilter();
    setTimeout(() => this.updatePlacement());
  }

  onFilterKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
    }
    event.stopPropagation();
  }

  onSpace(event: Event): void {
    if (this.searchable) return;
    event.preventDefault();
    this.onTriggerClick(event);
  }

  private close(): void {
    this.open = false;
    this.openUp = false;
    this.query = '';
  }

  private focusFilter(): void {
    const input = this.host.nativeElement.querySelector('.filter') as HTMLInputElement | null;
    input?.focus();
  }

  isSelected(id: string): boolean {
    return this.localSelectedIds.includes(id);
  }

  toggleSelectAll(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.disabled) return;
    const next = this.allSelected ? [] : this.items.map((item) => item.id);
    this.localSelectedIds = next;
    this.selectedIdsChange.emit([...next]);
  }

  clearAll(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.disabled) return;
    this.localSelectedIds = [];
    this.selectedIdsChange.emit([]);
  }

  toggleItem(id: string, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.disabled) return;
    const next = this.isSelected(id)
      ? this.localSelectedIds.filter((x) => x !== id)
      : [...this.localSelectedIds, id];
    this.localSelectedIds = next;
    this.selectedIdsChange.emit([...next]);
  }

  remove(id: string, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.disabled) return;
    const next = this.localSelectedIds.filter((x) => x !== id);
    this.localSelectedIds = next;
    this.selectedIdsChange.emit([...next]);
  }

  private estimatedDropdownHeight(): number {
    const extra = this.showSelectAll && this.visibleItems.length > 0 && !this.query.trim() ? 1 : 0;
    const rows = Math.max(
      this.visibleItems.length + extra,
      this.visibleItems.length === 0 ? 1 : 0,
    );
    return Math.min(this.dropdownMaxPx, 12 + rows * 40);
  }

  private shouldOpenUp(neededPx: number): boolean {
    const trigger = this.host.nativeElement.querySelector('.trigger') as HTMLElement | null;
    if (!trigger) return false;
    const rect = trigger.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - this.dropdownGapPx;
    const spaceAbove = rect.top - this.dropdownGapPx;
    return spaceBelow < neededPx && spaceAbove > spaceBelow;
  }

  private updatePlacement(): void {
    if (!this.open) return;
    const dropdown = this.host.nativeElement.querySelector('.dropdown') as HTMLElement | null;
    const needed = dropdown?.offsetHeight || this.estimatedDropdownHeight();
    this.openUp = this.shouldOpenUp(needed);
  }
}
