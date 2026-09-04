import {
  Component,
  Input,
  OnChanges,
  SimpleChanges,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import {
  EMPLOYEE_DOCUMENT_TYPES,
  type EmployeeDocumentType,
} from '@loom/contracts-documents';
import type { AbsenceType } from '@loom/contracts-absences';
import { DocumentsApiService } from '../documents/public-api';
import { EmployeeAbsenceDocumentsService } from '../absences/public-api';
import { EmployeeDocumentUploadDialogComponent } from './employee-document-upload-dialog.component';
import { SessionStore } from '../../core/auth/session.store';
import { Permission } from '@loom/contracts-auth';

type DocumentType = 'time_event' | EmployeeDocumentType;

type DocumentFileRow = {
  id: string;
  fileName: string;
  mimeType: string | null;
  sizeBytes: number;
  createdAt: string;
};

type DocumentListRow = {
  source: 'employee_document' | 'time_event';
  id: string;
  employeeId: string;
  documentType: DocumentType;
  title: string;
  isConfidential: boolean;
  createdAt: string;
  relatedStartDate: string | null;
  relatedEndDate: string | null;
  files: DocumentFileRow[];
  canDelete: boolean;
};

type SortKey = 'date_desc' | 'date_asc' | 'title_asc' | 'title_desc';

const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  time_event: 'Робочий календар',
  employment: 'Працевлаштування',
  questionnaire: 'Анкета',
  identity: 'Ідентифікація',
  education: 'Освіта',
  certificate: 'Сертифікат',
  medical: 'Медичні',
  consent: 'Згода',
  other: 'Інше',
};

const TIME_EVENT_TYPE_LABELS: Record<AbsenceType, string> = {
  day_off: 'Відгул',
  vacation: 'Відпустка',
  sick_leave: 'Лікарняний',
  part_time: 'Неповний день',
  overtime: 'Понаднормові',
  business_trip: 'Відрядження',
  extra_work_day: 'Робочий день поза графіком',
};

@Component({
  selector: 'app-employee-documents-panel',
  standalone: true,
  imports: [FormsModule, RouterLink, EmployeeDocumentUploadDialogComponent],
  template: `
    <div class="panel">
      @if (canUpload()) {
        <div class="toolbar">
          <button type="button" class="btn primary" (click)="openUploadDialog()">
            Додати документи
          </button>
          @if (uploadSuccess()) {
            <span class="ok">Завантажено</span>
          }
        </div>
      }

      <div class="filters">
        <label>
          Тип
          <select [(ngModel)]="filterType" (ngModelChange)="applyFilters()">
            <option value="">Усі типи</option>
            @for (t of allFilterTypes; track t) {
              <option [value]="t">{{ typeLabel(t) }}</option>
            }
          </select>
        </label>
        <label>
          Пошук
          <input
            type="search"
            [(ngModel)]="filterQuery"
            (ngModelChange)="applyFilters()"
            placeholder="Заголовок або файл"
          />
        </label>
        <label>
          Від
          <input type="date" [(ngModel)]="filterFrom" (ngModelChange)="applyFilters()" />
        </label>
        <label>
          До
          <input type="date" [(ngModel)]="filterTo" (ngModelChange)="applyFilters()" />
        </label>
        <label>
          Сортування
          <select [(ngModel)]="sortKey" (ngModelChange)="applyFilters()">
            <option value="date_desc">Дата (новіші)</option>
            <option value="date_asc">Дата (старіші)</option>
            <option value="title_asc">Заголовок А→Я</option>
            <option value="title_desc">Заголовок Я→А</option>
          </select>
        </label>
      </div>

      @if (loading()) {
        <p class="muted">Завантаження документів…</p>
      } @else {
        @if (documentsFailed()) {
          <p class="warn">Не вдалося завантажити документи профілю.</p>
        }
        @if (absencesFailed()) {
          <p class="warn">Не вдалося завантажити вкладення заявок на відсутність.</p>
        }

        @if (!visibleRows().length) {
          <p class="muted">Документів ще немає.</p>
        } @else {
          <ul class="doc-list">
            @for (row of visibleRows(); track row.source + ':' + row.id) {
              <li class="doc-row">
                <div class="doc-head">
                  <div class="doc-title">
                    <strong>{{ row.title }}</strong>
                    <span class="badge">{{ typeLabel(row.documentType) }}</span>
                    @if (row.isConfidential) {
                      <span class="badge confidential">Конфіденційно</span>
                    }
                    @if (row.source === 'time_event') {
                      <a
                        class="icon-btn"
                        [routerLink]="['/absences/requests', row.id]"
                        title="Відкрити заявку на відсутність"
                        aria-label="Відкрити заявку на відсутність"
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path
                            fill="currentColor"
                            d="M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42 9.3-9.29H14V3zM5 5h6v2H7v10h10v-4h2v6H5V5z"
                          />
                        </svg>
                      </a>
                    }
                  </div>
                  <div class="doc-head-actions">
                    <span class="muted">{{ formatDate(row.createdAt) }}</span>
                    @if (row.canDelete) {
                      <button
                        type="button"
                        class="icon-btn danger"
                        title="Видалити подання"
                        aria-label="Видалити подання документів"
                        [disabled]="deleteBusyId() === row.id"
                        (click)="deleteRow(row)"
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path
                            fill="currentColor"
                            d="M9 3h6l1 2h5v2H3V5h5l1-2zm1 6h2v9h-2V9zm4 0h2v9h-2V9zM7 9h2v9H7V9zm-1 12h12a1 1 0 0 0 1-1V8H5v12a1 1 0 0 0 1 1z"
                          />
                        </svg>
                      </button>
                    }
                  </div>
                </div>
                <ul class="files">
                  @for (file of row.files; track file.id) {
                    <li>
                      <div class="file-main">
                        <span class="file-name" [title]="file.fileName">{{ file.fileName }}</span>
                        <span class="muted">{{ formatSize(file.sizeBytes) }}</span>
                      </div>
                      <div class="file-actions">
                        <button
                          type="button"
                          class="icon-btn"
                          title="Переглянути"
                          [attr.aria-label]="'Переглянути ' + file.fileName"
                          (click)="preview(row, file)"
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
                          class="icon-btn"
                          title="Завантажити"
                          [attr.aria-label]="'Завантажити ' + file.fileName"
                          (click)="download(row, file)"
                        >
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path
                              fill="currentColor"
                              d="M12 3v10.17l3.59-3.58L17 11l-5 5-5-5 1.41-1.41L11 13.17V3h2zm-7 14h14v2H5v-2z"
                            />
                          </svg>
                        </button>
                      </div>
                    </li>
                  }
                </ul>
              </li>
            }
          </ul>
        }
      }
    </div>

    @if (uploadDialogOpen()) {
      <loom-employee-document-upload-dialog
        [busy]="uploadBusy()"
        [error]="uploadError()"
        [canMarkConfidential]="canMarkConfidential()"
        (closed)="closeUploadDialog()"
        (submitted)="submitUpload($event)"
      />
    }
  `,
  styles: [
    `
      .panel { display: grid; gap: 1rem; }
      .toolbar {
        display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center;
        justify-content: flex-end;
      }
      .filters, .doc-row {
        display: grid; gap: 0.6rem;
        padding: 0.85rem; border: 1px solid var(--pw-border);
        border-radius: 10px; background: var(--pw-surface);
      }
      .filters {
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        align-items: end;
      }
      label { display: grid; gap: 0.25rem; font-size: 0.85rem; }
      input, select {
        padding: 0.45rem 0.55rem; border: 1px solid var(--pw-border);
        border-radius: 8px; background: var(--pw-bg); color: inherit;
      }
      .doc-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.75rem; }
      .doc-head { display: flex; justify-content: space-between; gap: 0.75rem; flex-wrap: wrap; align-items: center; }
      .doc-head-actions { display: flex; gap: 0.35rem; align-items: center; flex-shrink: 0; }
      .doc-title { display: flex; flex-wrap: wrap; gap: 0.35rem; align-items: center; min-width: 0; }
      .badge {
        display: inline-block; padding: 0.1rem 0.45rem;
        border-radius: 999px; font-size: 0.75rem;
        background: color-mix(in srgb, var(--pw-accent) 15%, transparent);
      }
      .badge.confidential {
        background: color-mix(in srgb, #b42318 18%, transparent);
        color: #912018;
      }
      .files { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.35rem; }
      .files li {
        display: flex; gap: 0.75rem; align-items: center; justify-content: space-between;
        flex-wrap: wrap;
      }
      .file-main { display: flex; gap: 0.5rem; align-items: baseline; flex-wrap: wrap; min-width: 0; }
      .file-name { overflow-wrap: anywhere; }
      .file-actions { display: flex; gap: 0.25rem; align-items: center; flex-shrink: 0; }
      .icon-btn {
        display: inline-grid; place-items: center;
        width: 2rem; height: 2rem; padding: 0;
        border: 1px solid var(--pw-border); border-radius: 8px;
        background: var(--pw-bg); color: var(--pw-accent);
        cursor: pointer; text-decoration: none;
      }
      .icon-btn:hover { background: color-mix(in srgb, var(--pw-accent) 12%, var(--pw-bg)); }
      .icon-btn:disabled { opacity: 0.5; cursor: not-allowed; }
      .icon-btn.danger { color: #b42318; }
      .icon-btn svg { width: 1.05rem; height: 1.05rem; }
      .btn {
        border: 1px solid var(--pw-border); border-radius: 8px; padding: 0.4rem 0.75rem;
        background: var(--pw-bg); color: var(--pw-text); cursor: pointer; width: fit-content;
      }
      .btn.primary {
        background: var(--pw-accent);
        color: var(--pw-on-accent);
        border-color: transparent;
        font-weight: 600;
      }
      .muted { color: var(--pw-muted); margin: 0; }
      .warn { color: #b54708; margin: 0; }
      .ok { color: #067647; }
    `,
  ],
})
export class EmployeeDocumentsPanelComponent implements OnChanges {
  private readonly documentsApi = inject(DocumentsApiService);
  private readonly absenceDocsApi = inject(EmployeeAbsenceDocumentsService);
  private readonly session = inject(SessionStore);

  @Input({ required: true }) employeeId!: string;

  readonly allFilterTypes: DocumentType[] = ['time_event', ...EMPLOYEE_DOCUMENT_TYPES];

  readonly loading = signal(false);
  readonly documentsFailed = signal(false);
  readonly absencesFailed = signal(false);
  readonly canUpload = signal(false);
  readonly visibleRows = signal<DocumentListRow[]>([]);
  readonly uploadDialogOpen = signal(false);
  readonly uploadBusy = signal(false);
  readonly uploadSuccess = signal(false);
  readonly uploadError = signal<string | null>(null);
  readonly deleteBusyId = signal<string | null>(null);

  canMarkConfidential(): boolean {
    return (
      this.session.isAdminEquivalent() ||
      this.session.hasPermission(Permission.ConfidentialView)
    );
  }

  private allRows: DocumentListRow[] = [];

  filterType = '';
  filterQuery = '';
  filterFrom = '';
  filterTo = '';
  sortKey: SortKey = 'date_desc';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['employeeId'] && this.employeeId) {
      this.closeUploadDialog();
      this.reload();
    }
  }

  typeLabel(type: DocumentType | string): string {
    return DOCUMENT_TYPE_LABELS[type as DocumentType] ?? type;
  }

  openUploadDialog(): void {
    this.uploadError.set(null);
    this.uploadSuccess.set(false);
    this.uploadDialogOpen.set(true);
  }

  closeUploadDialog(): void {
    if (this.uploadBusy()) return;
    this.uploadDialogOpen.set(false);
    this.uploadError.set(null);
  }

  reload(): void {
    if (!this.employeeId) return;
    this.loading.set(true);
    forkJoin({
      documents: this.documentsApi.getEmployeeDocuments(this.employeeId).pipe(
        map((res) => ({ items: res.items, canUpload: res.capabilities.canUpload, failed: false })),
        catchError(() => of({ items: [], canUpload: false, failed: true })),
      ),
      absences: this.absenceDocsApi.getEmployeeDocumentItems(this.employeeId).pipe(
        map((items) => ({ items, failed: false })),
        catchError(() => of({ items: [], failed: true })),
      ),
    }).subscribe({
      next: ({ documents, absences }) => {
        this.documentsFailed.set(documents.failed);
        this.absencesFailed.set(absences.failed);
        this.canUpload.set(documents.canUpload);
        const docRows: DocumentListRow[] = documents.items.map((item) => ({
          source: 'employee_document',
          id: item.id,
          employeeId: item.employeeId,
          documentType: item.documentType,
          title: item.title,
          isConfidential: item.isConfidential === true,
          createdAt: item.createdAt,
          relatedStartDate: null,
          relatedEndDate: null,
          files: [...item.files],
          canDelete: item.permissions.canDelete,
        }));
        const absRows: DocumentListRow[] = absences.items.map((item) => ({
          source: 'time_event',
          id: item.id,
          employeeId: item.employeeId,
          documentType: 'time_event',
          title: formatTimeEventTitle(item.eventType, item.relatedStartDate, item.relatedEndDate),
          isConfidential: false,
          createdAt: item.createdAt,
          relatedStartDate: item.relatedStartDate,
          relatedEndDate: item.relatedEndDate,
          files: item.files.map((f) => ({ ...f })),
          canDelete: false,
        }));
        this.allRows = [...docRows, ...absRows];
        this.applyFilters();
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.documentsFailed.set(true);
        this.absencesFailed.set(true);
        this.allRows = [];
        this.visibleRows.set([]);
      },
    });
  }

  reloadDocumentsOnly(): void {
    this.documentsApi.getEmployeeDocuments(this.employeeId).subscribe({
      next: (res) => {
        this.canUpload.set(res.capabilities.canUpload);
        const docRows: DocumentListRow[] = res.items.map((item) => ({
          source: 'employee_document' as const,
          id: item.id,
          employeeId: item.employeeId,
          documentType: item.documentType,
          title: item.title,
          isConfidential: item.isConfidential === true,
          createdAt: item.createdAt,
          relatedStartDate: null,
          relatedEndDate: null,
          files: [...item.files],
          canDelete: item.permissions.canDelete,
        }));
        this.allRows = [
          ...docRows,
          ...this.allRows.filter((r) => r.source === 'time_event'),
        ];
        this.applyFilters();
        this.documentsFailed.set(false);
      },
      error: () => {
        this.documentsFailed.set(true);
      },
    });
  }

  applyFilters(): void {
    const q = this.filterQuery.trim().toLocaleLowerCase('uk-UA');
    let rows = this.allRows.filter((row) => {
      if (this.filterType && row.documentType !== this.filterType) return false;
      if (q) {
        const haystack = [row.title, ...row.files.map((f) => f.fileName)]
          .join(' ')
          .toLocaleLowerCase('uk-UA');
        if (!haystack.includes(q)) return false;
      }
      const day = row.createdAt.slice(0, 10);
      if (this.filterFrom && day < this.filterFrom) return false;
      if (this.filterTo && day > this.filterTo) return false;
      return true;
    });

    rows = [...rows].sort((a, b) => {
      switch (this.sortKey) {
        case 'date_asc':
          return a.createdAt.localeCompare(b.createdAt);
        case 'title_asc':
          return a.title.localeCompare(b.title, 'uk-UA', { sensitivity: 'base' });
        case 'title_desc':
          return b.title.localeCompare(a.title, 'uk-UA', { sensitivity: 'base' });
        case 'date_desc':
        default:
          return b.createdAt.localeCompare(a.createdAt);
      }
    });

    this.visibleRows.set(rows);
  }

  submitUpload(input: {
    title: string;
    documentType: EmployeeDocumentType;
    isConfidential: boolean;
    files: File[];
  }): void {
    if (!input.files.length || !input.title.trim()) {
      this.uploadError.set('Вкажіть заголовок і хоча б один файл');
      return;
    }
    this.uploadBusy.set(true);
    this.uploadError.set(null);
    this.uploadSuccess.set(false);

    this.documentsApi
      .uploadEmployeeDocument(this.employeeId, {
        title: input.title.trim(),
        documentType: input.documentType,
        isConfidential: input.isConfidential,
        files: input.files,
      })
      .subscribe({
        next: () => {
          this.uploadBusy.set(false);
          this.uploadSuccess.set(true);
          this.uploadDialogOpen.set(false);
          this.reloadDocumentsOnly();
        },
        error: (err) => {
          this.uploadBusy.set(false);
          this.uploadError.set(
            err?.error?.message ?? 'Не вдалося завантажити документ(и)',
          );
        },
      });
  }

  preview(row: DocumentListRow, file: DocumentFileRow): void {
    const previewWindow = window.open('about:blank', '_blank');
    if (!previewWindow) {
      this.uploadError.set('Дозвольте спливаючі вікна, щоб переглянути файл');
      return;
    }
    try {
      previewWindow.document.write(
        '<!doctype html><title>Завантаження…</title><p style="font-family:sans-serif;padding:1rem">Завантаження файлу…</p>',
      );
      previewWindow.document.close();
    } catch {
      /* ignore */
    }

    this.fetchBlob(row, file).subscribe({
      next: (blob) => {
        if (isErrorBlob(blob)) {
          try {
            previewWindow.close();
          } catch {
            /* ignore */
          }
          return;
        }
        const typed = typedBlob(blob, file.mimeType);
        const url = URL.createObjectURL(typed);
        try {
          previewWindow.location.replace(url);
        } catch {
          previewWindow.location.href = url;
        }
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      },
      error: () => {
        try {
          previewWindow.close();
        } catch {
          /* ignore */
        }
      },
    });
  }

  download(row: DocumentListRow, file: DocumentFileRow): void {
    this.fetchBlob(row, file).subscribe({
      next: (blob) => {
        if (isErrorBlob(blob)) return;
        triggerBlobDownload(typedBlob(blob, file.mimeType), file.fileName);
      },
    });
  }

  deleteRow(row: DocumentListRow): void {
    if (row.source !== 'employee_document' || !row.canDelete) return;
    this.deleteBusyId.set(row.id);
    this.documentsApi.deleteDocument(row.id).subscribe({
      next: () => {
        this.deleteBusyId.set(null);
        this.reloadDocumentsOnly();
      },
      error: () => {
        this.deleteBusyId.set(null);
      },
    });
  }

  formatDate(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('uk-UA');
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  private fetchBlob(row: DocumentListRow, file: DocumentFileRow) {
    return row.source === 'employee_document'
      ? this.documentsApi.downloadDocumentFile(row.id, file.id)
      : this.absenceDocsApi.downloadAttachment(row.id, file.id);
  }
}

function formatTimeEventTitle(
  eventType: AbsenceType | string,
  start: string,
  end: string | null,
): string {
  const label =
    TIME_EVENT_TYPE_LABELS[eventType as AbsenceType] ?? String(eventType);
  const startFmt = formatUaDate(start);
  if (!end || end === start) {
    return `${label} · ${startFmt}`;
  }
  return `${label} · ${startFmt}–${formatUaDate(end)}`;
}

function formatUaDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  if (!y || !m || !d) return isoDate;
  return `${d}.${m}.${y}`;
}

function typedBlob(blob: Blob, mimeType: string | null): Blob {
  return blob.type
    ? blob
    : new Blob([blob], { type: mimeType || 'application/octet-stream' });
}

function isErrorBlob(blob: Blob): boolean {
  return blob.type.includes('application/json') || blob.type.includes('text/plain');
}

function triggerBlobDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
