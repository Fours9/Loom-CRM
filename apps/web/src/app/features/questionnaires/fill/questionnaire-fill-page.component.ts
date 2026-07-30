import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom, Subscription } from 'rxjs';
import { QuestionnaireProfileMirrorService } from '../core/questionnaire-profile-mirror.service';
import { QuestionnairesApiService } from '../core/questionnaires-api.service';
import { parseQuestionnaireStepQuery } from '../navigation/questionnaire-navigation';
import { QUESTIONNAIRE_ASSIGNMENT_NAVIGATION } from '../navigation/questionnaire-navigation';
import { buildQuestionnaireAssignmentLink } from '../navigation/questionnaire-navigation';
import { QuestionnaireAutosaveCoordinator } from './questionnaire-autosave.coordinator';
import { QuestionnaireDraftStore } from './questionnaire-draft.store';
import { QuestionnaireRevisionCoordinator } from './questionnaire-revision.coordinator';
import { QuestionnaireWizardShellComponent } from './questionnaire-wizard-shell.component';

@Component({
  selector: 'loom-questionnaire-fill-page',
  standalone: true,
  imports: [RouterLink, QuestionnaireWizardShellComponent],
  providers: [
    QuestionnaireDraftStore,
    QuestionnaireAutosaveCoordinator,
    QuestionnaireRevisionCoordinator,
    QuestionnaireProfileMirrorService,
  ],
  template: `
    <div class="page">
      @switch (store.loadState()) {
        @case ('loading') {
          <p class="muted">Завантаження анкети…</p>
        }
        @case ('not_found') {
          <article class="state">
            <h1>Анкету не знайдено</h1>
            <p class="muted">{{ store.loadError() }}</p>
            <a class="btn" routerLink="/people">До працівників</a>
          </article>
        }
        @case ('error') {
          <article class="state">
            <h1>Помилка</h1>
            <p class="error">{{ store.loadError() }}</p>
            <a class="btn" routerLink="/people">До працівників</a>
          </article>
        }
        @case ('ready') {
          @switch (store.uiMode()) {
            @case ('owner_only') {
              <article class="state">
                <h1>{{ store.assignment()?.templateTitle }}</h1>
                <p>Анкета доступна лише працівнику</p>
                <a class="btn" routerLink="/people">До працівників</a>
              </article>
            }
            @case ('unavailable') {
              <article class="state">
                <h1>Анкета недоступна</h1>
                <p class="muted">Призначення скасовано.</p>
                <a class="btn" routerLink="/people">До працівників</a>
              </article>
            }
            @default {
              @if (store.uiMode() === 'read_only') {
                <div class="view-banner" role="status">
                  <div class="view-banner-text">
                    <p class="view-title">
                      {{ store.assignment()?.templateTitle }}
                    </p>
                    <p class="muted">
                      @if (store.assignmentStatus() === 'submitted') {
                        Анкету надіслано. Перегляд відповідей.
                      } @else {
                        Анкету переглянуто. Перегляд відповідей.
                      }
                    </p>
                    @if (actionError()) {
                      <p class="error">{{ actionError() }}</p>
                    }
                  </div>
                  <div class="view-banner-actions">
                    @if (store.assignment()?.capabilities?.canReopenSelf) {
                      <button
                        type="button"
                        class="btn primary"
                        [disabled]="actionBusy()"
                        (click)="reopenSelf()"
                      >
                        {{ actionBusy() ? 'Відкриття…' : 'Редагувати' }}
                      </button>
                    }
                    @if (store.assignment()?.capabilities?.canRequestChanges) {
                      <button
                        type="button"
                        class="btn"
                        [disabled]="actionBusy()"
                        (click)="requestChanges()"
                      >
                        {{ actionBusy() ? 'Запит…' : 'Запросити зміни' }}
                      </button>
                    }
                  </div>
                </div>
              }
              <loom-questionnaire-wizard-shell />
            }
          }
        }
      }
    </div>
  `,
  styles: [
    `
      .page {
        max-width: 960px;
        margin: 0 auto;
        padding: 1rem 1rem 2rem;
      }
      .state {
        display: grid;
        gap: 0.75rem;
        padding: 1rem;
        border: 1px solid var(--pw-border);
        border-radius: 12px;
        background: var(--pw-surface);
      }
      .view-banner {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-start;
        justify-content: space-between;
        gap: 0.75rem 1rem;
        margin-bottom: 0.75rem;
        padding: 0.75rem 0;
        border-bottom: 1px solid var(--pw-border);
      }
      .view-banner-text {
        display: grid;
        gap: 0.25rem;
        min-width: min(100%, 16rem);
        flex: 1;
      }
      .view-title {
        margin: 0;
        font-size: 1.05rem;
        font-weight: 600;
      }
      .view-banner-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
      }
      h1 {
        margin: 0;
        font-size: 1.35rem;
      }
      .muted {
        margin: 0;
        color: var(--pw-muted);
      }
      .error {
        margin: 0;
        color: #b42318;
      }
      .btn {
        display: inline-flex;
        width: fit-content;
        min-height: 44px;
        align-items: center;
        justify-content: center;
        padding: 0.45rem 0.8rem;
        border-radius: 8px;
        border: 1px solid var(--pw-border);
        background: var(--pw-surface);
        text-decoration: none;
        color: inherit;
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
export class QuestionnaireFillPageComponent implements OnInit, OnDestroy {
  readonly store = inject(QuestionnaireDraftStore);
  private readonly autosave = inject(QuestionnaireAutosaveCoordinator);
  private readonly revision = inject(QuestionnaireRevisionCoordinator);
  private readonly api = inject(QuestionnairesApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private sub?: Subscription;

  readonly actionBusy = signal(false);
  readonly actionError = signal<string | null>(null);

  ngOnInit(): void {
    this.sub = this.route.paramMap.subscribe((params) => {
      const id = params.get('id')?.trim() ?? '';
      const step = parseQuestionnaireStepQuery(this.route.snapshot.queryParamMap);
      void this.loadAssignment(id, step);
    });

    this.route.queryParamMap.subscribe((q) => {
      if (this.store.loadState() !== 'ready') return;
      const step = parseQuestionnaireStepQuery(q);
      this.store.applyRequestedStep(step);
      this.syncStepQuery(this.store.activeStepKey());
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.autosave.resetForAssignmentSwitch();
    this.store.clear();
  }

  async reopenSelf(): Promise<void> {
    if (this.actionBusy()) return;
    this.actionBusy.set(true);
    this.actionError.set(null);
    try {
      await this.revision.reopenSelf();
      this.syncStepQuery(this.store.activeStepKey());
    } catch (err: unknown) {
      this.actionError.set(
        (err as { error?: { message?: string } })?.error?.message ||
          'Не вдалося відкрити анкету для редагування',
      );
    } finally {
      this.actionBusy.set(false);
    }
  }

  async requestChanges(): Promise<void> {
    const id = this.store.assignment()?.id;
    if (!id || this.actionBusy()) return;
    this.actionBusy.set(true);
    this.actionError.set(null);
    try {
      await firstValueFrom(
        this.api.requestChanges(id, {
          reviewComment: 'Потрібні зміни',
        }),
      );
      this.autosave.resetForAssignmentSwitch();
      const step = parseQuestionnaireStepQuery(
        this.route.snapshot.queryParamMap,
      );
      await this.store.load(id, step);
      if (this.store.loadState() === 'ready') {
        this.syncStepQuery(this.store.activeStepKey());
      }
    } catch (err: unknown) {
      this.actionError.set(
        (err as { error?: { message?: string } })?.error?.message ||
          'Не вдалося запросити зміни',
      );
    } finally {
      this.actionBusy.set(false);
    }
  }

  private async loadAssignment(
    id: string,
    step: string | null,
  ): Promise<void> {
    this.autosave.resetForAssignmentSwitch();
    this.actionError.set(null);
    if (!id) {
      this.store.clear();
      return;
    }
    await this.store.load(id, step);
    if (this.store.loadState() === 'ready') {
      this.syncStepQuery(this.store.activeStepKey());
    }
  }

  private syncStepQuery(stepKey: string): void {
    const id = this.store.assignment()?.id;
    if (!id) return;
    const current =
      this.route.snapshot.queryParamMap.get(
        QUESTIONNAIRE_ASSIGNMENT_NAVIGATION.query.step,
      ) ?? null;
    if (current === stepKey) return;
    const link = buildQuestionnaireAssignmentLink({
      assignmentId: id,
      stepKey,
    });
    void this.router.navigate([link.routerLink], {
      queryParams: link.queryParams,
      replaceUrl: true,
    });
  }
}
