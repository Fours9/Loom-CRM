import {
  Component,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import type {
  CreateQuestionnaireAssignmentRequest,
  QuestionnaireTemplateListItem,
} from '@loom/contracts-questionnaires';
import type { EmployeeListItem } from '@loom/contracts-employees';
import { QuestionnairesApiService } from '../core/questionnaires-api.service';
import { QuestionnaireEmployeeTypeaheadComponent } from '../shared/questionnaire-employee-typeahead.component';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'loom-questionnaire-create-dialog',
  standalone: true,
  imports: [QuestionnaireEmployeeTypeaheadComponent],
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
      >
        <h2>{{ dialogTitle() }}</h2>

        <label class="field">
          Тип / шаблон
          <select
            [value]="selectedTemplateCode()"
            (change)="onTemplateChange($any($event.target).value)"
          >
            @for (t of templates(); track t.code) {
              <option [value]="t.code">{{ t.title }} ({{ t.type }})</option>
            }
          </select>
        </label>

        <label class="field">
          Назва
          <input type="text" [value]="derivedTitle()" readonly />
        </label>

        <loom-questionnaire-employee-typeahead
          [initialEmployee]="prefillEmployee()"
          (employeeChange)="onEmployee($event)"
        />

        <label class="field">
          Службова примітка
          <textarea
            rows="3"
            [value]="comment()"
            (input)="comment.set($any($event.target).value)"
            placeholder="Видно лише з правом читання службової примітки"
          ></textarea>
        </label>

        @if (error()) {
          <p class="error">{{ error() }}</p>
        }

        <div class="actions">
          <button type="button" class="btn" [disabled]="busy()" (click)="close.emit()">
            Скасувати
          </button>
          <button
            type="button"
            class="btn primary"
            [disabled]="busy() || !selectedTemplateCode()"
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
      .backdrop {
        position: fixed;
        inset: 0;
        z-index: 50;
        display: grid;
        place-items: center;
        background: color-mix(in srgb, #0f172a 45%, transparent);
        padding: 1rem;
        overflow-y: auto;
      }
      .modal {
        display: grid;
        gap: 0.75rem;
        width: min(32rem, 100%);
        margin: auto;
        padding: 1.1rem 1.2rem 1.25rem;
        border-radius: 12px;
        background: var(--pw-surface);
        border: 1px solid var(--pw-border);
        box-shadow: 0 12px 32px rgba(0, 0, 0, 0.22);
        overflow: visible;
      }
      h2 {
        margin: 0;
        font-size: 1.1rem;
      }
      .field {
        display: grid;
        gap: 0.3rem;
        font-size: 0.8rem;
        color: var(--pw-muted);
      }
      input,
      select,
      textarea {
        border: 1px solid var(--pw-border);
        border-radius: 8px;
        padding: 0.45rem 0.6rem;
        background: var(--pw-bg, #fff);
        font-size: 0.95rem;
        font-family: inherit;
      }
      input[readonly] {
        opacity: 0.85;
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
      .btn {
        border-radius: 8px;
        border: 1px solid var(--pw-border);
        padding: 0.4rem 0.85rem;
        background: var(--pw-surface);
        cursor: pointer;
      }
      .btn.primary {
        background: var(--pw-accent);
        border-color: var(--pw-accent);
        color: #fff;
      }
      .btn:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }
    `,
  ],
})
export class QuestionnaireCreateDialogComponent implements OnInit {
  private readonly api = inject(QuestionnairesApiService);

  readonly dialogTitle = input('Створити анкету');
  readonly prefillEmployee = input<Pick<
    EmployeeListItem,
    'id' | 'fullName'
  > | null>(null);

  readonly created = output<{ id: string }>();
  readonly close = output<void>();

  readonly templates = signal<QuestionnaireTemplateListItem[]>([]);
  readonly selectedTemplateCode = signal('');
  readonly comment = signal('');
  readonly employeeId = signal<string | null>(null);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  readonly derivedTitle = computed(() => {
    const code = this.selectedTemplateCode();
    return this.templates().find((t) => t.code === code)?.title ?? '';
  });

  private backdropPress = false;

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
    const prefill = this.prefillEmployee();
    if (prefill) this.employeeId.set(prefill.id);

    this.api.listTemplates().subscribe({
      next: (res) => {
        this.templates.set(res.items);
        const preferred =
          res.items.find((t) => t.code === 'employee-360') ?? res.items[0];
        if (preferred) this.selectedTemplateCode.set(preferred.code);
      },
      error: () => this.error.set('Не вдалося завантажити шаблони'),
    });
  }

  onTemplateChange(code: string): void {
    this.selectedTemplateCode.set(code);
  }

  onEmployee(emp: Pick<EmployeeListItem, 'id' | 'fullName'> | null): void {
    this.employeeId.set(emp?.id ?? null);
  }

  async submit(): Promise<void> {
    if (this.busy()) return;
    const templateCode = this.selectedTemplateCode();
    if (!templateCode) return;
    this.busy.set(true);
    this.error.set(null);
    const body: CreateQuestionnaireAssignmentRequest = {
      templateCode,
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
