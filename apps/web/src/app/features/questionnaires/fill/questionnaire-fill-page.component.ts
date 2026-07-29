import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { QuestionnaireProfileMirrorService } from '../core/questionnaire-profile-mirror.service';
import { parseQuestionnaireStepQuery } from '../navigation/questionnaire-navigation';
import { QUESTIONNAIRE_ASSIGNMENT_NAVIGATION } from '../navigation/questionnaire-navigation';
import { buildQuestionnaireAssignmentLink } from '../navigation/questionnaire-navigation';
import { QuestionnaireAutosaveCoordinator } from './questionnaire-autosave.coordinator';
import { QuestionnaireDraftStore } from './questionnaire-draft.store';
import { QuestionnaireWizardShellComponent } from './questionnaire-wizard-shell.component';

@Component({
  selector: 'loom-questionnaire-fill-page',
  standalone: true,
  imports: [RouterLink, QuestionnaireWizardShellComponent],
  providers: [
    QuestionnaireDraftStore,
    QuestionnaireAutosaveCoordinator,
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
            @case ('read_only') {
              <article class="state">
                <h1>{{ store.assignment()?.templateTitle }}</h1>
                <p class="muted">
                  @if (store.assignmentStatus() === 'submitted') {
                    Анкету надіслано. Редагування недоступне.
                  } @else {
                    Анкету переглянуто. Редагування недоступне.
                  }
                </p>
                <loom-questionnaire-wizard-shell />
              </article>
            }
            @default {
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
      h1 {
        margin: 0;
        font-size: 1.35rem;
      }
      .muted {
        color: var(--pw-muted);
      }
      .error {
        color: #b42318;
      }
      .btn {
        display: inline-flex;
        width: fit-content;
        min-height: 44px;
        align-items: center;
        padding: 0.45rem 0.8rem;
        border-radius: 8px;
        border: 1px solid var(--pw-border);
        text-decoration: none;
        color: inherit;
      }
    `,
  ],
})
export class QuestionnaireFillPageComponent implements OnInit, OnDestroy {
  readonly store = inject(QuestionnaireDraftStore);
  private readonly autosave = inject(QuestionnaireAutosaveCoordinator);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private sub?: Subscription;

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

  private async loadAssignment(
    id: string,
    step: string | null,
  ): Promise<void> {
    this.autosave.resetForAssignmentSwitch();
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
