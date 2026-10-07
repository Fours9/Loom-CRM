import {
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import type {
  CreateQuestionnaireAssignmentRequest,
  QuestionnaireTemplateListItem,
} from '@loom/contracts-questionnaires';
import type { EmployeeListItem } from '@loom/contracts-employees';
import { QuestionnairesApiService } from '../core/questionnaires-api.service';
import { QuestionnaireEmployeeTypeaheadComponent } from './questionnaire-employee-typeahead.component';
import {
  questionnaireTemplateDescription,
} from '../questionnaire-labels';
import { OverlayScrollLockService } from '../../../core/overlay/overlay-scroll-lock.service';
import { attachPwDialogHostToBody } from '../../../shared/ui/pw-dialog-host';
import {
  PwSelectComponent,
  type PwSelectOption,
} from '../../../shared/ui/pw-select.component';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'loom-questionnaire-create-dialog',
  standalone: true,
  imports: [
    FormsModule,
    QuestionnaireEmployeeTypeaheadComponent,
    PwSelectComponent,
  ],
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
          <h2 [id]="headingId">{{ dialogTitle() }}</h2>
          <button
            type="button"
            class="icon-close"
            aria-label="Закрити"
            title="Закрити"
            [disabled]="busy()"
            (click)="close.emit()"
          >
            ×
          </button>
        </div>

        <label class="field">
          Тип / шаблон
          <loom-pw-select
            [value]="selectedTemplateCode()"
            [options]="templateOptions()"
            (valueChange)="onTemplateChange($event)"
          />
        </label>

        @if (selectedTypeDescription()) {
          <p class="type-desc">{{ selectedTypeDescription() }}</p>
        }

        <label class="field">
          Назва
          <input
            type="text"
            [ngModel]="title()"
            (ngModelChange)="onTitleInput($event)"
            name="title"
            placeholder="Назва анкети"
          />
        </label>

        <loom-questionnaire-employee-typeahead
          [initialEmployee]="prefillEmployee()"
          (employeeChange)="onEmployee($event)"
        />

        <label class="field">
          Службова примітка
          <textarea
            rows="3"
            [ngModel]="comment()"
            (ngModelChange)="comment.set($event)"
            name="comment"
            placeholder="Видно лише з правом читання службової примітки"
          ></textarea>
        </label>

        @if (error()) {
          <p class="error">{{ error() }}</p>
        }

        <div class="actions">
          <button
            type="button"
            class="btn pw-btn pw-btn--ghost"
            [disabled]="busy()"
            (click)="close.emit()"
          >
            Скасувати
          </button>
          <button
            type="button"
            class="btn pw-btn"
            [disabled]="busy() || !selectedTemplateCode() || !title().trim()"
            (click)="submit()"
          >
            {{ busy() ? 'Створення…' : 'Створити' }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        z-index: var(--pw-z-modal, 250);
      }
      .backdrop {
        position: fixed;
        inset: 0;
        z-index: var(--pw-z-modal, 250);
        display: grid;
        place-items: center;
        background: color-mix(in srgb, #0f172a 45%, transparent);
        padding: calc(var(--shell-topbar-h, 0px) + 0.75rem) 1rem 0.75rem;
        overflow-y: auto;
      }
      .modal {
        position: relative;
        display: grid;
        gap: 0.75rem;
        width: min(32rem, 100%);
        margin: auto;
        padding: 1.1rem 1.2rem 1.25rem;
        border-radius: 12px;
        background: var(--pw-surface, #1e293b);
        border: 1px solid var(--pw-border, #334155);
        box-shadow: 0 12px 32px rgba(0, 0, 0, 0.22);
        overflow: visible;
      }
      .head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 0.75rem;
        padding-right: 2.5rem;
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
      .field {
        display: grid;
        gap: 0.3rem;
        font-size: 0.8rem;
        color: var(--pw-muted);
      }
      .type-desc {
        margin: -0.35rem 0 0;
        font-size: 0.85rem;
        color: var(--pw-muted);
        line-height: 1.35;
      }
      input,
      textarea {
        border: 1px solid var(--pw-border);
        border-radius: 8px;
        padding: 0.45rem 0.6rem;
        background: var(--pw-bg, #fff);
        font-size: 0.95rem;
        font-family: inherit;
      }
      .error {
        margin: 0;
        color: #b42318;
        font-size: 0.9rem;
      }
      .actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.5rem;
        margin-top: 0.25rem;
      }
      .btn:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }
    `,
  ],
})
export class QuestionnaireCreateDialogComponent implements OnInit, OnDestroy {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly api = inject(QuestionnairesApiService);
  private readonly scrollLock = inject(OverlayScrollLockService);
  readonly headingId = 'questionnaire-create-dialog-title';

  readonly dialogTitle = input('Створити анкету');
  readonly prefillEmployee = input<Pick<
    EmployeeListItem,
    'id' | 'fullName'
  > | null>(null);

  readonly created = output<{ id: string }>();
  readonly close = output<void>();

  readonly templates = signal<QuestionnaireTemplateListItem[]>([]);
  readonly selectedTemplateCode = signal('');
  readonly title = signal('');
  readonly comment = signal('');
  readonly employeeId = signal<string | null>(null);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  /** When false, changing template resets the title to the template default. */
  private titleEdited = false;

  readonly selectedTypeDescription = computed(() => {
    const code = this.selectedTemplateCode();
    const tpl = this.templates().find((t) => t.code === code);
    if (!tpl) return '';
    return questionnaireTemplateDescription(tpl.code, tpl.type);
  });

  readonly templateOptions = computed<PwSelectOption[]>(() =>
    this.templates().map((t) => ({ value: t.code, label: t.title })),
  );

  private backdropPress = false;

  private templateTitleFor(code: string): string {
    return this.templates().find((t) => t.code === code)?.title ?? '';
  }

  /** Close only on a full click that both starts and ends on the backdrop. */
  onBackdropPointerDown(event: MouseEvent): void {
    this.backdropPress = event.target === event.currentTarget;
  }

  onBackdropClick(event: MouseEvent): void {
    if (this.backdropPress && event.target === event.currentTarget) {
      this.close.emit();
    }
    this.backdropPress = false;
  }

  ngOnInit(): void {
    attachPwDialogHostToBody(this.host);
    this.scrollLock.acquire();
    const prefill = this.prefillEmployee();
    if (prefill) this.employeeId.set(prefill.id);

    this.api.listTemplates().subscribe({
      next: (res) => {
        this.templates.set(res.items);
        const preferred =
          res.items.find((t) => t.code === 'employee-360') ?? res.items[0];
        if (preferred) {
          this.selectedTemplateCode.set(preferred.code);
          this.title.set(preferred.title);
          this.titleEdited = false;
        }
      },
      error: () => this.error.set('Не вдалося завантажити шаблони'),
    });
  }

  ngOnDestroy(): void {
    this.scrollLock.release();
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscape(event: Event): void {
    if (this.busy()) return;
    event.preventDefault();
    this.close.emit();
  }

  onTemplateChange(code: string): void {
    const previousCode = this.selectedTemplateCode();
    const previousDefault = this.templateTitleFor(previousCode);
    this.selectedTemplateCode.set(code);
    // Reset title when user hasn't customized it, or it still matches the previous template default.
    if (!this.titleEdited || this.title().trim() === previousDefault) {
      this.title.set(this.templateTitleFor(code));
      this.titleEdited = false;
    }
  }

  onTitleInput(value: string): void {
    this.title.set(value);
    this.titleEdited = true;
  }

  onEmployee(emp: Pick<EmployeeListItem, 'id' | 'fullName'> | null): void {
    this.employeeId.set(emp?.id ?? null);
  }

  async submit(): Promise<void> {
    if (this.busy()) return;
    const templateCode = this.selectedTemplateCode().trim();
    const title = this.title().trim();
    if (!templateCode || !title) {
      this.error.set('Оберіть шаблон і вкажіть назву');
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    const body: CreateQuestionnaireAssignmentRequest = {
      templateCode,
      title,
      employeeId: this.employeeId() ?? undefined,
      comment: this.comment().trim() || undefined,
    };
    try {
      const detail = await firstValueFrom(this.api.createAssignment(body));
      this.created.emit({ id: detail.id });
    } catch (err: unknown) {
      this.error.set(
        (err as { error?: { message?: string } })?.error?.message ||
          'Не вдалося створити анкету',
      );
    } finally {
      this.busy.set(false);
    }
  }
}
