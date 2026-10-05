import {
  Component,
  HostListener,
  Input,
  OnDestroy,
  OnInit,
  inject,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  EMPLOYEE_DOCUMENT_TYPES,
  type EmployeeDocumentType,
} from '@loom/contracts-documents';
import { OverlayScrollLockService } from '../../core/overlay/overlay-scroll-lock.service';
import { HelpTriggerComponent } from '../../core/help/help-trigger.component';

export type PendingUploadFile = {
  key: string;
  file: File;
};

const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
]);
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILES = 20;

@Component({
  selector: 'loom-employee-document-upload-dialog',
  standalone: true,
  imports: [FormsModule, HelpTriggerComponent],
  template: `
    <div
      class="backdrop"
      (mousedown)="onBackdropPointerDown($event)"
      (click)="onBackdropClick($event)"
    >
      <div
        class="modal"
        (mousedown)="$event.stopPropagation()"
        (click)="$event.stopPropagation()"
        role="dialog"
        aria-modal="true"
        [attr.aria-labelledby]="headingId"
      >
        <div class="head">
          <div class="head-title">
            <h2 [id]="headingId">Нове подання документів</h2>
            <loom-help-trigger
              tourId="people.dialog.document-upload"
              ariaLabel="Підказка про цю форму"
            />
          </div>
          <button
            type="button"
            class="icon-close"
            aria-label="Закрити"
            title="Закрити"
            [disabled]="busy"
            (click)="closed.emit()"
          >
            ×
          </button>
        </div>

        <div class="body">
          @if (error || localError()) {
            <p class="error">{{ error || localError() }}</p>
          }

          <div class="fields">
            <label class="span-2">
              Заголовок
              <input
                data-help-id="people.dialog.document-upload.title"
                type="text"
                name="uploadTitle"
                [(ngModel)]="title"
                maxlength="255"
                required
                [disabled]="busy"
              />
            </label>
            <label>
              Тип
              <select
                data-help-id="people.dialog.document-upload.type"
                name="uploadType"
                [(ngModel)]="documentType"
                [disabled]="busy"
              >
                @for (t of uploadTypes; track t) {
                  <option [value]="t">{{ typeLabel(t) }}</option>
                }
              </select>
            </label>
            @if (canMarkConfidential) {
              <label class="check span-2">
                <input
                  type="checkbox"
                  name="uploadConfidential"
                  [(ngModel)]="isConfidential"
                  [disabled]="busy"
                />
                Конфіденційно
              </label>
            }
            <label>
              Файли
              <input
                type="file"
                name="uploadFiles"
                data-help-id="people.dialog.document-upload.files"
                multiple
                accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                [disabled]="busy"
                (change)="onFilesPicked($event)"
              />
            </label>
          </div>

          @if (pending().length) {
            <ul class="pending">
              @for (item of pending(); track item.key) {
                <li>
                  <div class="pending-main">
                    <span class="file-name" [title]="item.file.name">{{ item.file.name }}</span>
                    <span class="muted">{{ formatSize(item.file.size) }}</span>
                  </div>
                  <div class="pending-actions">
                    <button
                      type="button"
                      class="icon-btn"
                      title="Переглянути"
                      [attr.aria-label]="'Переглянути ' + item.file.name"
                      [disabled]="busy"
                      (click)="previewLocal(item.file)"
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          fill="currentColor"
                          d="M12 5c-7 0-10 7-10 7s3 7 10 7 10-7 10-7-3-7-10-7zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-2.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"
                        />
                      </svg>
                    </button>
                    <button
                      type="button"
                      class="icon-btn danger"
                      title="Прибрати"
                      [attr.aria-label]="'Прибрати ' + item.file.name"
                      [disabled]="busy"
                      (click)="removePending(item.key)"
                    >
                      ×
                    </button>
                  </div>
                </li>
              }
            </ul>
          } @else {
            <p class="muted hint">PDF / JPG / PNG, до 10 МБ кожен, не більше 20 файлів.</p>
          }
        </div>

        <div class="foot">
          <button type="button" class="btn ghost" [disabled]="busy" (click)="closed.emit()">
            Скасувати
          </button>
          <button
            type="button"
            class="btn"
            data-help-id="people.dialog.document-upload.submit"
            [disabled]="busy || !canSubmit"
            (click)="onSubmit()"
          >
            {{ busy ? 'Завантаження…' : submitLabel }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .backdrop {
        position: fixed;
        inset: 0;
        z-index: var(--pw-z-modal, 300);
        display: grid;
        place-items: center;
        padding: 1rem;
        background: color-mix(in srgb, var(--pw-text-strong, #000) 45%, transparent);
      }
      .modal {
        position: relative;
        width: min(36rem, 100%);
        max-height: min(90vh, 40rem);
        display: grid;
        grid-template-rows: auto minmax(0, 1fr) auto;
        border-radius: 12px;
        background: var(--pw-surface);
        border: 1px solid var(--pw-border);
        box-shadow: 0 12px 32px rgba(0, 0, 0, 0.22);
        overflow: hidden;
      }
      .head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        padding: 1rem 3.4rem 0.85rem 1.15rem;
        border-bottom: 1px solid var(--pw-border);
      }
      .head-title {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        min-width: 0;
      }
      h2 {
        margin: 0;
        font-size: 1.1rem;
      }
      .icon-close {
        position: absolute;
        top: 0.7rem;
        right: 0.75rem;
        display: inline-grid;
        place-items: center;
        width: 2.25rem;
        height: 2.25rem;
        padding: 0;
        font-size: 1.35rem;
        line-height: 1;
        background: transparent;
        color: var(--pw-text);
        border: 1px solid var(--pw-border-strong, var(--pw-border));
        border-radius: 8px;
        cursor: pointer;
      }
      .icon-close:disabled {
        opacity: 0.55;
        cursor: default;
      }
      .body {
        min-height: 0;
        overflow-y: auto;
        overscroll-behavior: contain;
        padding: 1rem 1.15rem;
        display: grid;
        gap: 0.85rem;
      }
      .error {
        margin: 0;
        color: var(--pw-danger, #a32d2d);
      }
      .fields {
        display: grid;
        gap: 0.75rem;
        grid-template-columns: minmax(0, 1fr);
      }
      @media (min-width: 641px) {
        .fields {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .span-2 {
          grid-column: 1 / -1;
        }
      }
      label {
        display: grid;
        gap: 0.25rem;
        font-size: 0.9rem;
        color: var(--pw-muted);
      }
      label.check {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 0.5rem;
        color: var(--pw-text);
      }
      .check input[type='checkbox'] {
        width: 1rem;
        height: 1rem;
        margin: 0;
        padding: 0;
        border: none;
        flex: 0 0 auto;
      }
      input,
      select {
        border: 1px solid var(--pw-border);
        border-radius: 8px;
        padding: 0.5rem 0.65rem;
        min-height: 2.5rem;
        background: var(--pw-surface);
        color: inherit;
        font: inherit;
        width: 100%;
        box-sizing: border-box;
      }
      .pending {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 0.4rem;
      }
      .pending li {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.65rem;
        padding: 0.45rem 0.55rem;
        border: 1px solid var(--pw-border);
        border-radius: 8px;
        background: var(--pw-surface-2, color-mix(in srgb, var(--pw-muted) 8%, var(--pw-surface)));
      }
      .pending-main {
        display: flex;
        flex-wrap: wrap;
        gap: 0.35rem 0.65rem;
        align-items: baseline;
        min-width: 0;
      }
      .file-name {
        overflow-wrap: anywhere;
        color: var(--pw-text);
        font-size: 0.9rem;
      }
      .pending-actions {
        display: flex;
        gap: 0.25rem;
        flex-shrink: 0;
      }
      .icon-btn {
        display: inline-grid;
        place-items: center;
        width: 2rem;
        height: 2rem;
        padding: 0;
        border: 1px solid var(--pw-border);
        border-radius: 8px;
        background: var(--pw-bg, var(--pw-surface));
        color: var(--pw-accent);
        cursor: pointer;
        font: inherit;
        font-size: 1.15rem;
        line-height: 1;
      }
      .icon-btn:hover:not(:disabled) {
        background: color-mix(in srgb, var(--pw-accent) 12%, var(--pw-surface));
      }
      .icon-btn:disabled {
        opacity: 0.5;
        cursor: default;
      }
      .icon-btn.danger {
        color: var(--pw-danger, #b42318);
      }
      .icon-btn svg {
        width: 1.05rem;
        height: 1.05rem;
      }
      .muted {
        color: var(--pw-muted);
        font-size: 0.85rem;
      }
      .hint {
        margin: 0;
      }
      .foot {
        display: flex;
        justify-content: flex-end;
        gap: 0.5rem;
        padding: 0.85rem 1.15rem 1rem;
        border-top: 1px solid var(--pw-border);
      }
      .btn {
        border: 0;
        background: var(--pw-accent);
        color: #fff;
        border-radius: 8px;
        padding: 0.45rem 0.9rem;
        min-height: 2.4rem;
        font: inherit;
        cursor: pointer;
      }
      .btn.ghost {
        background: var(--pw-accent-soft, #e8eef5);
        border: 1px solid color-mix(in srgb, var(--pw-accent) 35%, var(--pw-border));
        color: var(--pw-accent);
      }
      .btn:disabled {
        opacity: 0.65;
        cursor: default;
      }
    `,
  ],
})
export class EmployeeDocumentUploadDialogComponent implements OnInit, OnDestroy {
  private readonly scrollLock = inject(OverlayScrollLockService);
  private backdropPress = false;
  private keySeq = 0;

  readonly headingId = 'employee-document-upload-dialog-title';
  readonly uploadTypes = [...EMPLOYEE_DOCUMENT_TYPES];
  readonly pending = signal<PendingUploadFile[]>([]);

  @Input() busy = false;
  @Input() error: string | null = null;
  /** Session can mark confidential (adminEq or confidential.view). */
  @Input() canMarkConfidential = false;

  title = '';
  documentType: EmployeeDocumentType = 'employment';
  isConfidential = false;
  readonly localError = signal<string | null>(null);

  readonly closed = output<void>();
  readonly submitted = output<{
    title: string;
    documentType: EmployeeDocumentType;
    isConfidential: boolean;
    files: File[];
  }>();

  private readonly typeLabels: Record<EmployeeDocumentType, string> = {
    employment: 'Працевлаштування',
    questionnaire: 'Анкета',
    identity: 'Ідентифікація',
    education: 'Освіта',
    certificate: 'Сертифікат',
    medical: 'Медичні',
    consent: 'Згода',
    other: 'Інше',
  };

  get canSubmit(): boolean {
    return this.title.trim().length > 0 && this.pending().length > 0;
  }

  get submitLabel(): string {
    const n = this.pending().length;
    if (n <= 1) return 'Завантажити';
    return `Завантажити (${n})`;
  }

  ngOnInit(): void {
    this.scrollLock.acquire();
  }

  ngOnDestroy(): void {
    this.scrollLock.release();
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscape(event: Event): void {
    if (this.busy) return;
    event.preventDefault();
    this.closed.emit();
  }

  typeLabel(type: EmployeeDocumentType): string {
    return this.typeLabels[type] ?? type;
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  onFilesPicked(event: Event): void {
    const input = event.target as HTMLInputElement;
    const picked = Array.from(input.files ?? []);
    if (!picked.length) return;

    const next = [...this.pending()];
    const errors: string[] = [];
    for (const file of picked) {
      if (next.length >= MAX_FILES) {
        errors.push('Не більше 20 файлів');
        break;
      }
      if (!ALLOWED_MIME.has(file.type)) {
        errors.push(`${file.name}: недозволений тип`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name}: більше 10 МБ`);
        continue;
      }
      const dup = next.some(
        (p) =>
          p.file.name === file.name &&
          p.file.size === file.size &&
          p.file.lastModified === file.lastModified,
      );
      if (dup) continue;
      this.keySeq += 1;
      next.push({ key: `f-${this.keySeq}`, file });
    }
    this.pending.set(next);
    input.value = '';
    this.localError.set(errors.length ? errors.join('; ') : null);
  }

  removePending(key: string): void {
    this.pending.set(this.pending().filter((p) => p.key !== key));
  }

  previewLocal(file: File): void {
    const url = URL.createObjectURL(file);
    const win = window.open(url, '_blank');
    if (!win) {
      URL.revokeObjectURL(url);
      this.localError.set('Дозвольте спливаючі вікна, щоб переглянути файл');
      return;
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  onSubmit(): void {
    if (!this.canSubmit || this.busy) return;
    this.submitted.emit({
      title: this.title.trim(),
      documentType: this.documentType,
      isConfidential: this.canMarkConfidential ? this.isConfidential : false,
      files: this.pending().map((p) => p.file),
    });
  }

  onBackdropPointerDown(event: MouseEvent): void {
    this.backdropPress = event.target === event.currentTarget;
  }

  onBackdropClick(event: MouseEvent): void {
    if (!this.backdropPress || this.busy) return;
    if (event.target === event.currentTarget) {
      this.closed.emit();
    }
    this.backdropPress = false;
  }
}
