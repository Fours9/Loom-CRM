import { Component, computed, input, output } from '@angular/core';
import type { QuestionnaireSchemaStep } from '@loom/contracts-questionnaires';
import {
  buildProgressSections,
  findProgressSection,
} from './questionnaire-section-map';

@Component({
  selector: 'loom-questionnaire-section-rail',
  standalone: true,
  template: `
    <nav class="rail" aria-label="Прогрес анкети">
      <h1 class="sr-only" tabindex="-1">{{ heading() }}</h1>

      <div
        class="band"
        [style.--count]="sectionCount()"
        [style.--mark]="'var(--dot)'"
      >
        <div class="dots-row">
          <div
            class="spine"
            [style.--progress]="sectionProgress()"
            aria-hidden="true"
          ></div>
          <ol class="marks">
            @for (section of sections(); track section.id) {
              <li
                class="mark"
                [class.current]="section.id === activeSection()?.id"
                [class.done]="isSectionDone(section.id)"
              >
                <button
                  type="button"
                  class="dot"
                  [disabled]="!canOpenSection()(section.id)"
                  [attr.aria-current]="
                    section.id === activeSection()?.id ? 'step' : null
                  "
                  [attr.aria-label]="section.label"
                  (click)="onSectionClick(section.id)"
                ></button>
              </li>
            }
          </ol>
        </div>
        <ol class="captions" aria-hidden="true">
          @for (section of sections(); track section.id) {
            <li
              class="caption"
              [class.current]="section.id === activeSection()?.id"
            >
              {{ section.label }}
            </li>
          }
        </ol>
      </div>

      @if (showSubsteps()) {
        <div
          class="band sub-band"
          [style.--count]="subCount()"
          [style.--mark]="'var(--sub-dot)'"
        >
          <div class="dots-row">
            <div
              class="spine"
              [style.--progress]="subProgress()"
              aria-hidden="true"
            ></div>
            <ol
              class="marks"
              [attr.aria-label]="'Підпункти: ' + (activeSection()?.label ?? '')"
            >
              @for (sub of activeSection()!.steps; track sub.key) {
                <li
                  class="mark"
                  [class.current]="sub.key === activeStepKey()"
                  [class.done]="isStepDone(sub.key)"
                >
                  <button
                    type="button"
                    class="dot sub-dot"
                    [disabled]="!canOpenStep()(sub.key)"
                    [attr.aria-current]="
                      sub.key === activeStepKey() ? 'step' : null
                    "
                    [attr.aria-label]="sub.label"
                    (click)="stepSelect.emit(sub.key)"
                  ></button>
                </li>
              }
            </ol>
          </div>
          <ol class="captions" aria-hidden="true">
            @for (sub of activeSection()!.steps; track sub.key) {
              <li
                class="caption sub-caption"
                [class.current]="sub.key === activeStepKey()"
              >
                {{ sub.label }}
              </li>
            }
          </ol>
        </div>
      }
    </nav>
  `,
  styles: [
    `
      .rail {
        --dot: 1.8rem;
        --sub-dot: 1.4rem;
        --spine-h: 3px;
        display: grid;
        gap: 0.85rem;
        min-width: 0;
        width: 100%;
      }
      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      }
      .band {
        display: grid;
        gap: 0.4rem;
        width: 100%;
        min-width: 0;
      }
      .sub-band {
        margin-top: 0.15rem;
        padding-top: 0.55rem;
        border-top: 1px dashed
          color-mix(in srgb, var(--pw-border) 85%, transparent);
      }
      .dots-row {
        position: relative;
        height: var(--mark, var(--dot));
        width: 100%;
      }
      .spine {
        position: absolute;
        left: calc(100% / var(--count, 5) / 2);
        right: calc(100% / var(--count, 5) / 2);
        top: 50%;
        translate: 0 -50%;
        height: var(--spine-h);
        border-radius: 999px;
        background: var(--pw-border);
        pointer-events: none;
        z-index: 0;
      }
      .spine::before {
        content: '';
        position: absolute;
        inset: 0 auto 0 0;
        width: var(--progress, 0%);
        border-radius: inherit;
        background: color-mix(in srgb, var(--pw-accent) 70%, var(--pw-border));
      }
      .marks,
      .captions {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        grid-template-columns: repeat(var(--count, 5), minmax(0, 1fr));
        width: 100%;
      }
      .marks {
        position: relative;
        z-index: 1;
        height: 100%;
        align-items: center;
      }
      .mark {
        display: flex;
        align-items: center;
        justify-content: center;
        min-width: 0;
        height: 100%;
      }
      .dot {
        box-sizing: border-box;
        display: block;
        width: var(--dot);
        height: var(--dot);
        margin: 0;
        padding: 0;
        border-radius: 999px;
        border: 3px solid var(--pw-border-strong);
        background: var(--pw-surface);
        cursor: pointer;
        line-height: 0;
        flex: none;
        appearance: none;
        -webkit-appearance: none;
      }
      .sub-dot {
        width: var(--sub-dot);
        height: var(--sub-dot);
        border-width: 2px;
      }
      .dot:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }
      .mark.current .dot {
        border-color: var(--pw-accent);
        background: var(--pw-accent);
        box-shadow: 0 0 0 4px
          color-mix(in srgb, var(--pw-accent) 28%, transparent);
      }
      .mark.done .dot {
        border-color: var(--pw-accent);
        background: color-mix(in srgb, var(--pw-accent) 55%, var(--pw-surface));
      }
      .mark.done.current .dot {
        background: var(--pw-accent);
      }
      .captions {
        align-items: start;
      }
      .caption {
        text-align: center;
        font-size: clamp(0.65rem, 1.1vw + 0.45rem, 0.82rem);
        line-height: 1.2;
        color: var(--pw-muted);
        padding: 0 0.2rem;
        overflow-wrap: anywhere;
        max-width: 100%;
        min-width: 0;
      }
      .sub-caption {
        font-size: clamp(0.6rem, 1vw + 0.4rem, 0.75rem);
      }
      .caption.current {
        color: var(--pw-text);
        font-weight: 600;
      }
    `,
  ],
})
export class QuestionnaireSectionRailComponent {
  readonly schemaSteps = input.required<QuestionnaireSchemaStep[]>();
  readonly activeStepKey = input.required<string>();
  readonly completedStepKeys = input<ReadonlySet<string>>(new Set());
  readonly canOpenStep = input<(stepKey: string) => boolean>((_k) => true);
  readonly canOpenSection = input<(sectionId: string) => boolean>((_id) => true);

  readonly stepSelect = output<string>();
  readonly sectionSelect = output<string>();

  readonly sections = computed(() => buildProgressSections(this.schemaSteps()));

  readonly activeSection = computed(() =>
    findProgressSection(this.sections(), this.activeStepKey()),
  );

  readonly sectionCount = computed(() => Math.max(this.sections().length, 1));

  readonly subCount = computed(
    () => Math.max(this.activeSection()?.steps.length ?? 1, 1),
  );

  readonly heading = computed(() => {
    const key = this.activeStepKey();
    const section = this.activeSection();
    const sub = section?.steps.find((s) => s.key === key);
    if (sub && section && section.steps.length > 1) {
      return `${section.label}: ${sub.label}`;
    }
    return sub?.label ?? section?.label ?? 'Анкета';
  });

  readonly showSubsteps = computed(() => {
    const section = this.activeSection();
    return !!section && section.steps.length > 1;
  });

  sectionProgress(): string {
    const sections = this.sections();
    const active = this.activeSection();
    if (!sections.length || !active) return '0%';
    const idx = sections.findIndex((s) => s.id === active.id);
    if (idx <= 0) return '0%';
    return `${(idx / (sections.length - 1)) * 100}%`;
  }

  subProgress(): string {
    const section = this.activeSection();
    if (!section || section.steps.length <= 1) return '0%';
    const idx = section.steps.findIndex((s) => s.key === this.activeStepKey());
    if (idx <= 0) return '0%';
    return `${(idx / (section.steps.length - 1)) * 100}%`;
  }

  isSectionDone(sectionId: string): boolean {
    const activeSection = this.activeSection();
    if (!activeSection) return false;
    const ids = this.sections().map((s) => s.id);
    const activeIdx = ids.indexOf(activeSection.id);
    const thisIdx = ids.indexOf(sectionId);
    return thisIdx >= 0 && activeIdx >= 0 && thisIdx < activeIdx;
  }

  isStepDone(stepKey: string): boolean {
    if (stepKey === this.activeStepKey()) return false;
    const section = this.activeSection();
    if (section) {
      const idx = section.steps.findIndex((s) => s.key === stepKey);
      const activeIdx = section.steps.findIndex(
        (s) => s.key === this.activeStepKey(),
      );
      if (idx >= 0 && activeIdx >= 0 && idx < activeIdx) return true;
    }
    return this.completedStepKeys().has(stepKey);
  }

  onSectionClick(sectionId: string): void {
    this.sectionSelect.emit(sectionId);
  }
}
