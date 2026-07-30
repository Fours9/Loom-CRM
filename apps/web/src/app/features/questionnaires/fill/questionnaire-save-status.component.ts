import { Component, Input } from '@angular/core';

export type SaveStatusVisual =
  | 'idle'
  | 'dirty'
  | 'saving'
  | 'saved'
  | 'error'
  | 'blocked';

@Component({
  selector: 'loom-questionnaire-save-status',
  standalone: true,
  template: `
    <div
      class="save"
      aria-live="polite"
      [class.saving]="visual === 'saving'"
      [class.ok]="visual === 'saved'"
      [class.err]="visual === 'error'"
      [class.dirty]="visual === 'dirty'"
    >
      {{ text }}
    </div>
  `,
  styles: [
    `
      .save {
        font-size: 0.9rem;
        color: var(--pw-muted);
        font-weight: 500;
        transition: color 0.15s ease;
      }
      .save.dirty {
        color: #9a6700;
      }
      .save.saving {
        color: #0b57d0;
        font-weight: 600;
      }
      .save.ok {
        color: #0f7b3a;
        font-weight: 600;
      }
      .save.err {
        color: #b42318;
        font-weight: 600;
      }
    `,
  ],
})
export class QuestionnaireSaveStatusComponent {
  @Input() text = '';
  @Input() visual: SaveStatusVisual = 'idle';
}
