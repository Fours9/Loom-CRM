import {
  Component,
  HostListener,
  OnDestroy,
  ViewChild,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { ThemeService } from '../../../core/theme/theme.service';
import {
  claimPwOverlay,
  releasePwOverlay,
  type PwOverlayHandle,
} from '../../../shared/ui/pw-overlay-session';
import { canBrowseQuestionnaireStep } from '../navigation/questionnaire-step-browse';
import { questionnaireTypeLabel } from '../questionnaire-labels';
import { QuestionnairesApiService } from '../core/questionnaires-api.service';
import { downloadBlob } from '../core/download-blob';
import { QuestionnaireDraftStore } from './questionnaire-draft.store';
import { QuestionnaireAutosaveCoordinator } from './questionnaire-autosave.coordinator';
import { QuestionnaireRevisionCoordinator } from './questionnaire-revision.coordinator';
import { QuestionnaireSectionRailComponent } from './progress/questionnaire-section-rail.component';
import { QuestionnaireRequestChangesPopoverComponent } from './questionnaire-request-changes-popover.component';
import { shouldShowRevisionSaveAndClose } from './questionnaire-fill-session.policy';
import {
  buildProgressSections,
  type ProgressSection,
} from './progress/questionnaire-section-map';
import { firstValueFrom } from 'rxjs';
import { HelpMenuComponent } from '../../../core/help';

@Component({
  selector: 'loom-questionnaire-fill-chrome',
  standalone: true,
  imports: [
    QuestionnaireSectionRailComponent,
    QuestionnaireRequestChangesPopoverComponent,
    HelpMenuComponent,
  ],
  template: `
    <header class="step-topbar" [class.overlay-open]="moreMenuOpen()">
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
          Тип: {{ templateTypeLabel() }} · Код:
          <code>{{ store.assignment()?.code || store.assignment()?.templateCode }}</code>
        </p>
        @if (
          store.assignment()?.capabilities?.canViewAssignmentComment &&
          store.assignment()?.comment
        ) {
          <p class="service-note">
            <span class="service-note-label">Службова примітка:</span>
            {{ store.assignment()?.comment }}
          </p>
        }
      </div>
      <div class="step-topbar-actions">
        <loom-help-menu [showMain]="false" />
        @if (printError()) {
          <span class="print-error" role="alert">{{ printError() }}</span>
        }
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
          <span data-help-id="q.request-changes">
            <loom-questionnaire-request-changes-popover
              #requestPopover
              [busy]="actionBusy()"
              (submitComment)="onRequestChangesSubmit($event)"
            />
          </span>
        }
        @if (store.canShowEditButton()) {
          <button
            type="button"
            class="btn primary"
            data-help-id="q.edit"
            [disabled]="actionBusy()"
            (click)="edit.emit()"
          >
            {{ actionBusy() ? 'Відкриття…' : 'Редагувати' }}
          </button>
        }
        @if (showRevisionSaveAndClose()) {
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
        <div class="more-menu-wrap">
          <button
            type="button"
            class="btn ghost more-btn"
            title="Додаткові дії"
            aria-label="Додаткові дії"
            data-help-id="q.more"
            [attr.aria-expanded]="moreMenuOpen()"
            [attr.aria-haspopup]="'menu'"
            [disabled]="actionBusy() || revision.manualSaveBusy() || printBusy()"
            (click)="toggleMoreMenu($event)"
          >
            <span class="more-icon" aria-hidden="true">⋮</span>
          </button>
          @if (moreMenuOpen()) {
            <div
              class="more-menu pw-menu"
              role="menu"
              (click)="$event.stopPropagation()"
            >
              <button
                type="button"
                role="menuitem"
                class="menu-row"
                [disabled]="printBusy() || actionBusy()"
                (click)="onPrintFromMenu()"
              >
                @if (printBusy()) {
                  <span class="busy-label">Формування…</span>
                } @else {
                  <svg
                    viewBox="0 0 24 24"
                    width="18"
                    height="18"
                    aria-hidden="true"
                  >
                    <path
                      fill="currentColor"
                      d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z"
                    />
                  </svg>
                  <span>Роздрукувати</span>
                }
              </button>
              @if (store.canShowDeleteButton()) {
                <button
                  type="button"
                  role="menuitem"
                  class="menu-row danger-item"
                  [disabled]="actionBusy() || revision.manualSaveBusy()"
                  (click)="onDeleteFromMenu()"
                >
                  @if (actionBusy()) {
                    <span class="busy-label">Видалення…</span>
                  } @else {
                    <svg
                      viewBox="0 0 24 24"
                      width="18"
                      height="18"
                      aria-hidden="true"
                    >
                      <path
                        fill="currentColor"
                        d="M9 3a1 1 0 0 0-1 1v1H5a1 1 0 1 0 0 2h1v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7h1a1 1 0 1 0 0-2h-3V4a1 1 0 0 0-1-1H9zm2 2h2v1h-2V5zm-2 4a1 1 0 0 1 1 1v7a1 1 0 1 1-2 0v-7a1 1 0 0 1 1-1zm6 0a1 1 0 0 1 1 1v7a1 1 0 1 1-2 0v-7a1 1 0 0 1 1-1z"
                      />
                    </svg>
                    <span>Видалити</span>
                  }
                </button>
              }
            </div>
          }
        </div>
      </div>
    </header>
    <header class="page-chrome">
      <div class="step-main">
        <loom-questionnaire-section-rail
          [sections]="progressSections()"
          [activeStepKey]="store.activeStepKey()"
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
      /* More-actions menu must clear anything below the sticky topbar. */
      .step-topbar.overlay-open {
        z-index: 25;
      }
      .step-topbar-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        justify-content: flex-end;
        align-items: center;
      }
      .more-menu-wrap {
        position: relative;
      }
      .more-btn {
        min-width: 2.25rem;
        padding-inline: 0.45rem;
      }
      .more-icon {
        font-size: 1.25rem;
        line-height: 1;
        font-weight: 700;
      }
      .more-menu {
        position: absolute;
        right: 0;
        top: calc(100% + 0.25rem);
        z-index: 20;
        min-width: 11rem;
        /* .pw-menu supplies panel chrome (border/radius/background/shadow/scrollbar). */
      }
      .more-menu button {
        display: block;
        width: 100%;
        text-align: left;
        border: 0;
        background: transparent;
        padding: 0.45rem 0.6rem;
        border-radius: 0.35rem;
        cursor: pointer;
        color: inherit;
        font: inherit;
      }
      .more-menu .menu-row {
        display: flex;
        align-items: center;
        gap: 0.55rem;
      }
      .more-menu .menu-row svg {
        flex: none;
      }
      .more-menu button:hover:not(:disabled) {
        background: color-mix(in srgb, var(--pw-border, #d0d7e2) 45%, transparent);
      }
      .more-menu button:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }
      .more-menu .danger-item {
        color: #fff;
        background: #b91c1c;
      }
      .more-menu .danger-item:hover:not(:disabled) {
        background: #991b1b;
        color: #fff;
      }
      .more-menu .busy-label {
        font-size: 0.95rem;
        line-height: 1;
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
      .print-error {
        color: var(--pw-danger, #b42318);
        font-size: 0.8rem;
        max-width: 12rem;
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
      .service-note {
        margin: 0.35rem 0 0;
        font-size: 0.85rem;
        color: var(--pw-muted);
        max-width: 40rem;
      }
      .service-note-label {
        font-weight: 600;
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
export class QuestionnaireFillChromeComponent
  implements OnDestroy, PwOverlayHandle
{
  readonly store = inject(QuestionnaireDraftStore);
  readonly revision = inject(QuestionnaireRevisionCoordinator);
  readonly theme = inject(ThemeService);
  private readonly autosave = inject(QuestionnaireAutosaveCoordinator);
  private readonly api = inject(QuestionnairesApiService);

  readonly actionBusy = input(false);
  readonly moreMenuOpen = signal(false);
  readonly printBusy = signal(false);
  readonly printError = signal('');

  readonly back = output<void>();
  readonly edit = output<void>();
  readonly requestChanges = output<string>();
  readonly saveAndClose = output<void>();
  readonly deleteAssignment = output<void>();
  readonly saveDraft = output<void>();
  readonly stepSelect = output<string>();
  readonly sectionSelect = output<string>();

  @ViewChild(QuestionnaireSectionRailComponent)
  private rail?: QuestionnaireSectionRailComponent;

  @ViewChild('requestPopover')
  private requestPopover?: QuestionnaireRequestChangesPopoverComponent;

  @HostListener('document:click')
  onDocumentClick(): void {
    this.closeMoreMenu();
  }

  ngOnDestroy(): void {
    releasePwOverlay(this);
  }

  closeFromOverlaySession(): void {
    this.moreMenuOpen.set(false);
  }

  toggleMoreMenu(event: Event): void {
    event.stopPropagation();
    if (this.moreMenuOpen()) {
      this.closeMoreMenu();
      return;
    }
    this.openMoreMenu();
  }

  onDeleteFromMenu(): void {
    this.closeMoreMenu();
    this.deleteAssignment.emit();
  }

  onPrintFromMenu(): void {
    this.closeMoreMenu();
    void this.onPrint();
  }

  private openMoreMenu(): void {
    claimPwOverlay(this);
    this.moreMenuOpen.set(true);
  }

  private closeMoreMenu(): void {
    this.moreMenuOpen.set(false);
    releasePwOverlay(this);
  }

  onRequestChangesSubmit(comment: string): void {
    this.requestChanges.emit(comment);
  }

  showRevisionSaveAndClose(): boolean {
    return shouldShowRevisionSaveAndClose({
      stepKey: this.store.activeStepKey(),
      editable: this.store.editable(),
      isRevisionEdit: this.revision.isRevisionEdit(),
    });
  }

  markRequestChangesSuccess(): void {
    this.requestPopover?.closeAfterSuccess();
  }

  markRequestChangesError(message: string): void {
    this.requestPopover?.setError(message);
  }

  async onPrint(): Promise<void> {
    if (this.printBusy() || this.actionBusy()) return;
    const assignmentId = this.store.assignment()?.id;
    if (!assignmentId) return;

    this.printError.set('');
    this.printBusy.set(true);
    try {
      const flushed = await this.autosave.flush();
      if (!flushed || this.store.saveState() === 'error') {
        this.printError.set('Не вдалося зберегти чернетку перед друком');
        return;
      }
      const revision = this.store.revision();
      const { blob, filename } = await firstValueFrom(
        this.api.exportAssignmentPdf(assignmentId, revision),
      );
      downloadBlob(blob, filename);
    } catch {
      this.printError.set('Не вдалося сформувати PDF');
    } finally {
      this.printBusy.set(false);
    }
  }

  readonly progressSections = computed(() =>
    buildProgressSections({
      templateCode: this.store.assignment()?.templateCode ?? '',
      schemaSteps: this.store.schemaSteps(),
    }),
  );

  readonly templateTypeLabel = computed(() =>
    questionnaireTypeLabel(this.store.assignment()?.templateType ?? 'full'),
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
