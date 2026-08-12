import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  emptyEmployeeContactsBundle,
  normalizeEmployeeContactsBundle,
  employeeContactsBundlesEqual,
  type EmployeeContactsBundle,
  type EmployeeContactsEmergencyItem,
  type EmployeeContactsPersonalItem,
  type PersonalContactType,
} from '@loom/employee-contacts';
import type { EmployeeContactsEditorAccess } from './employee-contacts.mappers';

let rowSeq = 0;

type PersonalDraft = EmployeeContactsPersonalItem & { key: string };
type EmergencyDraft = EmployeeContactsEmergencyItem & { key: string };

@Component({
  selector: 'loom-employee-contacts-editor',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="contacts-stack">
      @if (access.work.visible) {
        <details class="section-block disclose" open>
          <summary>Робочі контакти</summary>
          <div class="disclose-body">
            @if (editing && access.work.editable) {
              <div class="field-list">
                <label class="contact-field-row">
                  <span class="field-label">Email</span>
                  <input
                    [(ngModel)]="draft.work.email"
                    name="workEmail"
                    type="email"
                    maxlength="320"
                    (ngModelChange)="emitDraft()"
                  />
                </label>
                <label class="contact-field-row">
                  <span class="field-label">Телефон</span>
                  <input
                    [(ngModel)]="draft.work.phone"
                    name="workPhone"
                    inputmode="tel"
                    maxlength="64"
                    (ngModelChange)="emitDraft()"
                  />
                </label>
                <label class="contact-field-row">
                  <span class="field-label">Telegram</span>
                  <input
                    [(ngModel)]="draft.work.telegram"
                    name="workTelegram"
                    maxlength="120"
                    (ngModelChange)="emitDraft()"
                  />
                </label>
              </div>
            } @else {
              <div class="field-list">
                <div class="contact-field-row view">
                  <span class="field-label">Email</span>
                  <div class="value">{{ display.work.email || '—' }}</div>
                </div>
                <div class="contact-field-row view">
                  <span class="field-label">Телефон</span>
                  <div class="value">{{ display.work.phone || '—' }}</div>
                </div>
                <div class="contact-field-row view">
                  <span class="field-label">Telegram</span>
                  <div class="value">{{ display.work.telegram || '—' }}</div>
                </div>
              </div>
            }
          </div>
        </details>
      }

      @if (access.personal.visible) {
        <details class="section-block disclose" open>
          <summary>Особисті контакти</summary>
          <div class="disclose-body">
            @if (editing && access.personal.editable) {
              <div class="personal-contact-groups">
                @for (group of personalGroups; track group.type) {
                  <div class="personal-contact-group">
                    <h4>{{ group.label }}</h4>
                    <div class="field-list">
                      @for (contact of personalOfType(group.type); track contact.key) {
                        <div class="personal-item">
                          <span class="field-label">{{ group.label }}</span>
                          <input
                            [(ngModel)]="contact.value"
                            [name]="'p_' + contact.key"
                            [attr.inputmode]="group.inputMode"
                            maxlength="320"
                            (ngModelChange)="emitDraft()"
                          />
                          <label class="primary-toggle-control">
                            <input
                              type="radio"
                              [name]="'primary_' + group.type"
                              [checked]="contact.isPrimary"
                              (change)="setPrimary(group.type, contact.key)"
                            />
                            Основний
                          </label>
                          <button
                            type="button"
                            class="icon-btn danger personal-remove"
                            title="Прибрати"
                            [attr.aria-label]="'Прибрати ' + group.label"
                            (click)="removePersonal(contact.key)"
                          >
                            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                              <path
                                fill="currentColor"
                                d="M9 3a1 1 0 0 0-1 1v1H5a1 1 0 1 0 0 2h1v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7h1a1 1 0 1 0 0-2h-3V4a1 1 0 0 0-1-1H9zm2 2h2v1h-2V5zm-2 4a1 1 0 0 1 1 1v7a1 1 0 1 1-2 0v-7a1 1 0 0 1 1-1zm6 0a1 1 0 0 1 1 1v7a1 1 0 1 1-2 0v-7a1 1 0 0 1 1-1z"
                              />
                            </svg>
                          </button>
                        </div>
                      }
                    </div>
                    <button
                      type="button"
                      class="btn ghost"
                      [disabled]="personalOfType(group.type).length >= 10"
                      (click)="addPersonal(group.type)"
                    >
                      + Додати {{ group.addLabel }}
                    </button>
                  </div>
                }
              </div>
            } @else {
              @for (group of personalGroups; track group.type) {
                @if (personalOfType(group.type, true).length > 0) {
                  <div class="personal-contact-group view">
                    <h4>{{ group.label }}</h4>
                    @for (contact of personalOfType(group.type, true); track contact.key) {
                      <div class="contact-field-row view">
                        <span class="field-label">
                          {{ group.label }}
                          @if (contact.isPrimary) {
                            <span class="primary-badge">основний</span>
                          }
                        </span>
                        <div class="value">{{ contact.value || '—' }}</div>
                      </div>
                    }
                  </div>
                }
              }
              @if (!hasVisiblePersonal()) {
                <p class="muted">Не вказано.</p>
              }
            }
          </div>
        </details>
      }

      @if (access.emergency.visible) {
        <details class="section-block disclose" open>
          <summary>Екстрені контакти</summary>
          <div class="disclose-body">
            @if (editing && access.emergency.editable) {
              <div class="emergency-list">
                @for (contact of emergencyDrafts; track contact.key; let index = $index) {
                  <div class="emergency-row">
                    <div class="emergency-row-head">
                      <h4>Екстрений контакт {{ index + 1 }}</h4>
                      <button
                        type="button"
                        class="icon-btn danger emergency-remove"
                        title="Прибрати"
                        [attr.aria-label]="'Прибрати екстрений контакт ' + (index + 1)"
                        (click)="removeEmergency(contact.key)"
                      >
                        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                          <path
                            fill="currentColor"
                            d="M9 3a1 1 0 0 0-1 1v1H5a1 1 0 1 0 0 2h1v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7h1a1 1 0 1 0 0-2h-3V4a1 1 0 0 0-1-1H9zm2 2h2v1h-2V5zm-2 4a1 1 0 0 1 1 1v7a1 1 0 1 1-2 0v-7a1 1 0 0 1 1-1zm6 0a1 1 0 0 1 1 1v7a1 1 0 1 1-2 0v-7a1 1 0 0 1 1-1z"
                          />
                        </svg>
                      </button>
                    </div>
                    <div class="emergency-fields">
                      <label class="contact-field-row">
                        <span class="field-label">ПІБ</span>
                        <input
                          [(ngModel)]="contact.fullName"
                          [name]="'e_fn_' + contact.key"
                          maxlength="255"
                          (ngModelChange)="emitDraft()"
                        />
                      </label>
                      <label class="contact-field-row">
                        <span class="field-label">Зв'язок</span>
                        <input
                          [(ngModel)]="contact.relationship"
                          [name]="'e_rel_' + contact.key"
                          maxlength="120"
                          (ngModelChange)="emitDraft()"
                        />
                      </label>
                      <label class="contact-field-row">
                        <span class="field-label">Основний телефон</span>
                        <input
                          [(ngModel)]="contact.primaryPhone"
                          [name]="'e_pp_' + contact.key"
                          inputmode="tel"
                          maxlength="64"
                          (ngModelChange)="emitDraft()"
                        />
                      </label>
                      <label class="contact-field-row">
                        <span class="field-label">Додатковий телефон</span>
                        <input
                          [(ngModel)]="contact.secondaryPhone"
                          [name]="'e_sp_' + contact.key"
                          inputmode="tel"
                          maxlength="64"
                          (ngModelChange)="emitDraft()"
                        />
                      </label>
                      <label class="contact-field-row field-area">
                        <span class="field-label">Примітки</span>
                        <textarea
                          [(ngModel)]="contact.notes"
                          [name]="'e_no_' + contact.key"
                          rows="2"
                          maxlength="5000"
                          (ngModelChange)="emitDraft()"
                        ></textarea>
                      </label>
                    </div>
                  </div>
                }
              </div>
              <button
                type="button"
                class="btn ghost"
                [disabled]="emergencyDrafts.length >= 5"
                (click)="addEmergency()"
              >
                + Додати контакт
              </button>
            } @else {
              @if (display.emergency.length > 0) {
                @for (e of display.emergency; track $index; let index = $index) {
                  <div class="emergency-row view">
                    <h4>Екстрений контакт {{ index + 1 }}</h4>
                    <div class="contact-field-row view">
                      <span class="field-label">ПІБ</span>
                      <div class="value">{{ e.fullName || '—' }}</div>
                    </div>
                    <div class="contact-field-row view">
                      <span class="field-label">Зв'язок</span>
                      <div class="value">{{ e.relationship || '—' }}</div>
                    </div>
                    <div class="contact-field-row view">
                      <span class="field-label">Основний телефон</span>
                      <div class="value">{{ e.primaryPhone || '—' }}</div>
                    </div>
                    @if (e.secondaryPhone) {
                      <div class="contact-field-row view">
                        <span class="field-label">Додатковий телефон</span>
                        <div class="value">{{ e.secondaryPhone }}</div>
                      </div>
                    }
                    @if (e.notes) {
                      <div class="contact-field-row view field-area">
                        <span class="field-label">Примітки</span>
                        <div class="value">{{ e.notes }}</div>
                      </div>
                    }
                  </div>
                }
              } @else {
                <p class="muted">Не вказано.</p>
              }
            }
          </div>
        </details>
      }
    </div>
  `,
  styles: [
    `
      .contacts-stack { display: grid; gap: 0.85rem; }
      .section-block {
        margin: 0;
        padding: 0.85rem 0.9rem;
        border: var(--q-panel-border, 1px solid color-mix(in srgb, var(--pw-muted) 40%, transparent));
        border-radius: 10px;
        background: var(--q-panel-bg, var(--pw-surface));
        display: grid;
        gap: 0.6rem;
      }
      .section-block.disclose {
        padding: 0;
        gap: 0;
        overflow: hidden;
      }
      .disclose > summary {
        list-style: none;
        cursor: pointer;
        margin: 0;
        padding: 0.75rem 0.9rem;
        font-size: 0.8rem;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--pw-accent);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        user-select: none;
        border-radius: 10px;
        background: var(--q-panel-bg, var(--pw-surface));
      }
      .disclose > summary:hover {
        background: var(--pw-accent-soft);
      }
      .disclose > summary::-webkit-details-marker { display: none; }
      .disclose > summary::after {
        content: '▾';
        flex: 0 0 auto;
        width: 1.6rem;
        height: 1.6rem;
        display: grid;
        place-items: center;
        border-radius: 6px;
        border: var(--q-input-border, 1px solid color-mix(in srgb, var(--pw-muted) 55%, transparent));
        background: var(--q-panel-bg-alt, var(--pw-surface-2, color-mix(in srgb, var(--pw-muted) 8%, var(--pw-surface))));
        color: var(--pw-text-strong, inherit);
        font-size: 1.05rem;
        line-height: 1;
        transform: rotate(-90deg);
        transition: transform 0.15s ease, background 0.15s ease;
      }
      .disclose[open] > summary {
        border-radius: 10px 10px 0 0;
        border-bottom: var(--q-divider, 1px solid color-mix(in srgb, var(--pw-muted) 35%, transparent));
      }
      .disclose[open] > summary::after {
        transform: rotate(0deg);
        background: var(--pw-accent-soft);
        border-color: var(--pw-accent);
        color: var(--pw-accent);
      }
      .disclose-body {
        display: grid;
        gap: 0.6rem;
        margin: 0;
        padding: 0.75rem 0.9rem 0.85rem;
        background: var(--q-panel-bg-alt, var(--pw-surface-2, color-mix(in srgb, var(--pw-muted) 8%, var(--pw-surface))));
        border-radius: 0 0 10px 10px;
      }
      .field-list { display: grid; gap: 0.55rem; }
      .contact-field-row {
        display: grid;
        grid-template-columns: minmax(8rem, 11rem) minmax(0, 1fr);
        align-items: center;
        gap: 0.65rem 1rem;
        margin: 0;
        min-width: 0;
      }
      .contact-field-row.field-area {
        align-items: start;
      }
      .field-label {
        font-size: 0.9rem;
        color: var(--pw-muted);
        line-height: 1.3;
      }
      .emergency-list { display: grid; gap: 0.65rem; }
      .emergency-row {
        border: var(--q-panel-border, 1px solid var(--pw-border));
        border-radius: 10px;
        padding: 0.75rem;
        display: grid;
        gap: 0.5rem;
        margin: 0;
        background: var(--q-panel-bg, var(--pw-surface));
      }
      .emergency-row-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.65rem;
      }
      .emergency-row-head h4 {
        margin: 0;
        font-size: 0.85rem;
        font-weight: 700;
        color: var(--pw-accent);
      }
      .emergency-row.view {
        border: none;
        padding: 0;
        gap: 0.45rem;
      }
      .emergency-row.view h4 {
        margin: 0 0 0.15rem;
        font-size: 0.95rem;
      }
      .emergency-fields { display: grid; gap: 0.5rem; }
      .value {
        color: var(--pw-text);
        font-weight: 600;
        overflow-wrap: anywhere;
      }
      .contact-field-row input:not([type='radio']):not([type='checkbox']),
      .contact-field-row textarea,
      .personal-item > input:not([type='radio']):not([type='checkbox']) {
        width: 100%;
        box-sizing: border-box;
        padding: 0.55rem 0.65rem;
        border-radius: 8px;
        border: var(--q-input-border, 1px solid var(--pw-border));
        background: var(--q-input-bg, var(--pw-surface));
        min-height: 44px;
        font: inherit;
        color: inherit;
      }
      textarea { min-height: 4rem; resize: vertical; }
      .btn.ghost {
        min-height: 44px;
        padding: 0.45rem 0.8rem;
        border-radius: 8px;
        border: 1px solid var(--pw-border);
        background: transparent;
        cursor: pointer;
      }
      .btn.ghost:disabled { opacity: 0.55; cursor: not-allowed; }
      .icon-btn.danger {
        width: 2.25rem;
        height: 2.25rem;
        display: grid;
        place-items: center;
        padding: 0;
        border: none;
        border-radius: 8px;
        background: #b42318;
        color: #fff;
        cursor: pointer;
        flex-shrink: 0;
      }
      .icon-btn.danger:hover {
        background: #912018;
      }
      .icon-btn.danger svg {
        display: block;
      }
      .emergency-remove {
        position: static;
        flex-shrink: 0;
      }
      .personal-item {
        display: grid;
        grid-template-columns:
          minmax(5.5rem, 7.5rem) minmax(0, 1fr) auto auto;
        align-items: center;
        gap: 0.55rem 0.65rem;
        padding: 0.55rem 0.65rem;
        border: var(--q-panel-border, 1px solid var(--pw-border));
        border-radius: 10px;
        background: var(--q-panel-bg, var(--pw-surface));
        min-width: 0;
      }
      .personal-item > .field-label {
        min-width: 0;
      }
      .personal-remove {
        position: static;
      }
      .primary-toggle-control {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        margin: 0;
        white-space: nowrap;
        font-size: 0.85rem;
        color: var(--pw-muted);
        cursor: pointer;
      }
      .primary-toggle-control input[type='radio'] {
        width: 1rem;
        height: 1rem;
        min-height: 0;
        margin: 0;
        flex: 0 0 auto;
        accent-color: var(--pw-accent);
        cursor: pointer;
      }
      @media (max-width: 640px) {
        .personal-item {
          grid-template-columns: minmax(5rem, 6.5rem) minmax(0, 1fr) auto;
          grid-template-areas:
            'label value remove'
            'label primary remove';
        }
        .personal-item > .field-label { grid-area: label; }
        .personal-item > input { grid-area: value; }
        .personal-item > .primary-toggle-control { grid-area: primary; }
        .personal-item > .personal-remove { grid-area: remove; align-self: start; }
      }
      .primary-badge {
        font-size: 0.75rem;
        color: var(--pw-accent);
        margin-left: 0.35rem;
      }
      .muted { color: var(--pw-muted); margin: 0; }
      .personal-contact-group h4 { margin: 0 0 0.35rem; font-size: 0.95rem; }
      .personal-contact-groups { display: grid; gap: 0.75rem; }
    `,
  ],
})
export class EmployeeContactsEditorComponent implements OnChanges {
  @Input({ required: true }) bundle!: EmployeeContactsBundle;
  @Input({ required: true }) access!: EmployeeContactsEditorAccess;
  @Input() editing = true;
  @Output() readonly bundleChange = new EventEmitter<EmployeeContactsBundle>();

  display = emptyEmployeeContactsBundle();
  draft = {
    work: { email: '', phone: '', telegram: '' },
  };
  personalDrafts: PersonalDraft[] = [];
  emergencyDrafts: EmergencyDraft[] = [];

  readonly personalGroups: Array<{
    type: PersonalContactType;
    label: string;
    addLabel: string;
    inputMode?: string;
  }> = [
    { type: 'personal_email', label: 'Email', addLabel: 'email', inputMode: 'email' },
    { type: 'personal_phone', label: 'Телефон', addLabel: 'телефон', inputMode: 'tel' },
    { type: 'personal_telegram', label: 'Telegram', addLabel: 'telegram' },
  ];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['bundle']) {
      const next = normalizeEmployeeContactsBundle(this.bundle);
      if (employeeContactsBundlesEqual(next, this.display)) {
        return;
      }
      this.display = next;
      this.syncDraftFromBundle(this.display);
    }
  }

  personalOfType(type: PersonalContactType, viewOnly = false): PersonalDraft[] {
    const source = viewOnly ? this.display.personal : this.personalDrafts;
    return source.filter((c) => c.type === type).map((c) =>
      'key' in c ? (c as PersonalDraft) : { ...c, key: nextKey() },
    );
  }

  hasVisiblePersonal(): boolean {
    return this.personalGroups.some(
      (g) => this.personalOfType(g.type, true).length > 0,
    );
  }

  addPersonal(type: PersonalContactType): void {
    if (this.personalOfType(type).length >= 10) return;
    this.personalDrafts = [
      ...this.personalDrafts,
      { key: nextKey(), type, value: '', isPrimary: false },
    ];
    this.emitDraft();
  }

  removePersonal(key: string): void {
    this.personalDrafts = this.personalDrafts.filter((c) => c.key !== key);
    this.emitDraft();
  }

  setPrimary(type: PersonalContactType, key: string): void {
    this.personalDrafts = this.personalDrafts.map((c) => ({
      ...c,
      isPrimary: c.type === type ? c.key === key : c.isPrimary,
    }));
    this.emitDraft();
  }

  addEmergency(): void {
    if (this.emergencyDrafts.length >= 5) return;
    this.emergencyDrafts = [
      ...this.emergencyDrafts,
      {
        key: nextKey(),
        fullName: '',
        relationship: '',
        primaryPhone: '',
        secondaryPhone: '',
        notes: '',
      },
    ];
    this.emitDraft();
  }

  removeEmergency(key: string): void {
    this.emergencyDrafts = this.emergencyDrafts.filter((c) => c.key !== key);
    this.emitDraft();
  }

  emitDraft(): void {
    const bundle = normalizeEmployeeContactsBundle({
      work: {
        email: this.draft.work.email || null,
        phone: this.draft.work.phone || null,
        telegram: this.draft.work.telegram || null,
      },
      personal: this.personalDrafts.map(({ key: _k, ...rest }) => rest),
      emergency: this.emergencyDrafts.map(({ key: _k, ...rest }) => rest),
    });
    if (employeeContactsBundlesEqual(bundle, this.display)) {
      return;
    }
    this.display = bundle;
    this.bundleChange.emit(bundle);
  }

  private syncDraftFromBundle(bundle: EmployeeContactsBundle): void {
    this.draft = {
      work: {
        email: bundle.work.email ?? '',
        phone: bundle.work.phone ?? '',
        telegram: bundle.work.telegram ?? '',
      },
    };
    this.personalDrafts = bundle.personal.map((c) => ({
      ...c,
      key: nextKey(),
    }));
    this.emergencyDrafts = bundle.emergency.map((c) => ({
      ...c,
      key: nextKey(),
    }));
  }
}

function nextKey(): string {
  rowSeq += 1;
  return `row-${rowSeq}`;
}
