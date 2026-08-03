import {
  Component,
  ViewChild,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { ThemeService } from '../../../core/theme/theme.service';
import { canBrowseQuestionnaireStep } from '../navigation/questionnaire-step-browse';
import { QuestionnaireDraftStore } from './questionnaire-draft.store';
import { QuestionnaireRevisionCoordinator } from './questionnaire-revision.coordinator';
import { QuestionnaireSectionRailComponent } from './progress/questionnaire-section-rail.component';
import {
  buildProgressSections,
  type ProgressSection,
} from './progress/questionnaire-section-map';

@Component({
  selector: 'loom-questionnaire-fill-chrome',
  standalone: true,
  imports: [QuestionnaireSectionRailComponent],
  template: `
    <header class="step-topbar">
      <button
        type="button"
        class="icon-back"
        title="Назад"
        aria-label="Повернутися назад"
        (click)="back.emit()"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path
            fill="currentColor"
            d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"
          />
        </svg>
        <span class="back-label">Назад</span>
      </button>
      <div class="chrome-titles">
        <h2>{{ store.pageTitle() }}</h2>
        <p class="code-line">
          Код:
          <code>{{ store.assignment()?.templateCode }}</code>
        </p>
      </div>
      <div class="step-topbar-actions">
        <button
          type="button"
          class="theme-toggle"
          (click)="theme.toggle()"
          [attr.aria-label]="
            theme.mode() === 'dark' ? 'Увімкнути світлу тему' : 'Увімкнути темну тему'
          "
          [title]="theme.mode() === 'dark' ? 'Темна тема' : 'Світла тема'"
        >
          @if (theme.mode() === 'dark') {
            <span aria-hidden="true">☾</span>
            <span class="theme-label">Темна</span>
          } @else {
            <span aria-hidden="true">☀</span>
            <span class="theme-label">Світла</span>
          }
        </button>
        @if (store.canShowRequestChangesButton()) {
          <button
            type="button"
            class="btn"
            [disabled]="actionBusy()"
            (click)="requestChanges.emit()"
          >
            {{ actionBusy() ? 'Запит…' : 'Запросити зміни' }}
          </button>
        }
        @if (store.canShowEditButton()) {
          <button
            type="button"
            class="btn primary"
            [disabled]="actionBusy()"
            (click)="edit.emit()"
          >
            {{ actionBusy() ? 'Відкриття…' : 'Редагувати' }}
          </button>
        }
        @if (store.editable() && revision.isRevisionEdit()) {
          <button
            type="button"
            class="btn primary"
            [disabled]="
              actionBusy() || revision.manualSaveBusy() || !revision.canResubmit()
            "
            [attr.aria-busy]="revision.manualSaveBusy()"
            (click)="saveAndClose.emit()"
          >
            {{
              revision.manualSaveBusy() ? 'Збереження…' : 'Зберегти і закрити'
            }}
          </button>
        }
        @if (store.canShowDeleteButton()) {
          <button
            type="button"
            class="btn danger"
            [disabled]="actionBusy() || revision.manualSaveBusy()"
            (click)="deleteAssignment.emit()"
          >
            {{ actionBusy() ? 'Видалення…' : 'Видалити анкету' }}
          </button>
        }
      </div>
    </header>
    <header class="page-chrome">
      <div class="step-main">
        <loom-questionnaire-section-rail
          [sections]="progressSections()"
          [activeStepKey]="store.activeStepKey()"
          [completedStepKeys]="store.completedSteps()"
          [canOpenStep]="canOpenRailStep"
          [canOpenSection]="canOpenRailSection"
          (stepSelect)="stepSelect.emit($event)"
          (sectionSelect)="sectionSelect.emit($event)"
        />
      </div>
      <div class="chrome-actions">
        @if (store.editable() && !revision.isRevisionEdit()) {
          <button
            type="button"
            class="btn primary"
            [disabled]="
              actionBusy() ||
              revision.manualSaveBusy() ||
              store.saveState() === 'saving'
            "
            [attr.aria-busy]="
              revision.manualSaveBusy() || store.saveState() === 'saving'
            "
            (click)="saveDraft.emit()"
          >
            {{
              revision.manualSaveBusy() || store.saveState() === 'saving'
                ? 'Збереження…'
                : 'Зберегти зміни'
            }}
          </button>
        }
        @if (revision.manualSaveMessage(); as msg) {
          <span class="save-msg" aria-live="polite">{{ msg }}</span>
        }
      </div>
    </header>
  `,
  styles: [
    `
      :host {
        display: contents;
      }
      .step-topbar {
        position: sticky;
        top: 0;
        z-index: 5;
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        gap: 0.65rem 1rem;
        align-items: center;
        margin-inline: calc(-1 * var(--page-pad-x, 1rem));
        padding: max(0.65rem, env(safe-area-inset-top, 0px))
          var(--page-pad-x, 1rem) 0.75rem;
        border-bottom: 2px solid
          color-mix(in srgb, var(--pw-border) 80%, #64748b);
        background: var(--pw-bg, #f6f8fb);
      }
      .step-topbar-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        justify-content: flex-end;
        align-items: center;
      }
      .theme-toggle {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.35rem;
        font-weight: 600;
        width: 2.75rem;
        min-width: 2.75rem;
        height: 2.75rem;
        min-height: 2.75rem;
        padding: 0;
        border: 1px solid var(--pw-border-strong);
        background: var(--pw-surface);
        color: var(--pw-text);
        border-radius: 8px;
        cursor: pointer;
      }
      .theme-label {
        display: none;
      }
      .page-chrome {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 0.75rem 1rem;
        align-items: center;
        padding: 0.35rem 0 0.15rem;
      }
      .step-main {
        min-width: 0;
      }
      .icon-back {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.35rem;
        min-width: 2.75rem;
        height: 2.75rem;
        min-height: 2.75rem;
        padding: 0 0.75rem;
        border-radius: 8px;
        border: 1px solid var(--pw-border-strong);
        background: var(--pw-surface);
        color: var(--pw-text);
        font-weight: 600;
        cursor: pointer;
      }
      .icon-back:hover {
        border-color: var(--pw-accent);
        color: var(--pw-accent);
        background: color-mix(in srgb, var(--pw-accent) 12%, var(--pw-surface));
      }
      .icon-back svg {
        display: block;
        flex-shrink: 0;
      }
      .back-label {
        line-height: 1;
      }
      .chrome-titles {
        min-width: 0;
        display: grid;
        gap: 0.15rem;
      }
      .chrome-titles h2 {
        margin: 0;
        font-size: clamp(1rem, 1.2vw + 0.75rem, 1.2rem);
        line-height: 1.3;
        font-weight: 600;
        overflow-wrap: anywhere;
      }
      .code-line {
        margin: 0;
        color: var(--pw-muted);
        font-size: 0.9rem;
      }
      .code-line code {
        font-size: 0.9rem;
        color: inherit;
        overflow-wrap: anywhere;
      }
      .chrome-actions {
        justify-self: end;
        align-self: center;
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        justify-content: flex-end;
        align-items: center;
      }
      .save-msg {
        font-size: 0.85rem;
        color: var(--pw-muted);
        font-weight: 600;
      }
      .btn {
        display: inline-flex;
        width: fit-content;
        min-height: 2.75rem;
        align-items: center;
        justify-content: center;
        padding: 0.45rem 0.8rem;
        border-radius: 8px;
        border: 1px solid var(--pw-border);
        background: var(--pw-surface);
        text-decoration: none;
        color: inherit;
        cursor: pointer;
        text-align: center;
      }
      .btn.primary {
        background: var(--pw-accent);
        border-color: var(--pw-accent);
        color: #fff;
      }
      .btn.danger {
        color: #b42318;
        border-color: color-mix(in srgb, #b42318 40%, var(--pw-border));
        background: color-mix(in srgb, #b42318 8%, var(--pw-surface));
      }
      .btn:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }
      @media (max-width: 640px) {
        .step-topbar {
          grid-template-columns: auto minmax(0, 1fr);
          align-items: start;
        }
        .step-topbar-actions {
          grid-column: 1 / -1;
          width: 100%;
          justify-content: stretch;
        }
        .step-topbar-actions .btn {
          flex: 1 1 calc(50% - 0.25rem);
          min-width: 0;
        }
        .step-topbar-actions .theme-toggle {
          flex: 0 0 auto;
        }
        .page-chrome {
          grid-template-columns: 1fr;
          gap: 0.65rem;
        }
        .chrome-actions {
          justify-self: stretch;
        }
        .chrome-actions .btn {
          flex: 1;
          width: 100%;
        }
        .icon-back {
          padding: 0 0.65rem;
        }
      }
      @media (min-width: 641px) {
        .theme-label {
          display: inline;
        }
        .theme-toggle {
          width: auto;
          min-width: auto;
          height: auto;
          padding: 0.4rem 0.75rem;
        }
      }
      @media (min-width: 1100px) {
        .chrome-titles h2 {
          font-size: 1.2rem;
        }
      }
    `,
  ],
})
export class QuestionnaireFillChromeComponent {
  readonly store = inject(QuestionnaireDraftStore);
  readonly revision = inject(QuestionnaireRevisionCoordinator);
  readonly theme = inject(ThemeService);

  readonly actionBusy = input(false);

  readonly back = output<void>();
  readonly edit = output<void>();
  readonly requestChanges = output<void>();
  readonly saveAndClose = output<void>();
  readonly deleteAssignment = output<void>();
  readonly saveDraft = output<void>();
  readonly stepSelect = output<string>();
  readonly sectionSelect = output<string>();

  @ViewChild(QuestionnaireSectionRailComponent)
  private rail?: QuestionnaireSectionRailComponent;

  readonly progressSections = computed(() =>
    buildProgressSections({
      templateCode: this.store.assignment()?.templateCode ?? '',
      schemaSteps: this.store.schemaSteps(),
    }),
  );

  readonly canOpenRailStep = (stepKey: string): boolean =>
    canBrowseQuestionnaireStep(stepKey, {
      editable: this.store.editable(),
      schemaSteps: this.store.schemaSteps(),
      completedStepKeys: this.store.completedSteps(),
    });

  readonly canOpenRailSection = (sectionId: string): boolean => {
    const section = this.progressSections().find((s) => s.id === sectionId);
    if (!section) return false;
    return section.steps.some((s) => this.canOpenRailStep(s.key));
  };

  focusHeading(): void {
    this.rail?.focusHeading();
  }

  sectionById(sectionId: string): ProgressSection | undefined {
    return this.progressSections().find((s) => s.id === sectionId);
  }
}
