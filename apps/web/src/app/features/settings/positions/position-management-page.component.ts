import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Permission } from '@loom/contracts-auth';
import { SessionStore } from '../../../core/auth/session.store';
import {
  GoalKind,
  OrgDepartment,
  OrgDirection,
  OrgPosition,
  OrgPositionDuty,
  OrgPositionGoalTemplate,
  OrgPositionSkillRequirement,
  OrgSkill,
  OrgSkillGroup,
  SettingsOrgApiService,
} from '../settings-org-api.service';

type CatalogTab = 'skills' | 'goals' | 'duties';
type CatalogPanel = 'directions' | 'departments' | 'positions';

const GOAL_KIND_LABELS: Record<GoalKind, string> = {
  career: 'Карʼєра',
  probation: 'Випробувальний',
  quarterly: 'Квартальна',
};

@Component({
  selector: 'loom-position-management-page',
  standalone: true,
  imports: [FormsModule],
  template: `
    <section class="section">
      <h2>Керування посадами</h2>
      <p class="lead">Напрямки, відділи та посади організації</p>

      @if (error()) {
        <p class="error">{{ error() }}</p>
      }

      @if (!canManage()) {
        <p class="muted">Керувати довідниками може лише адміністратор або користувач з відповідними правами.</p>
      }

      <div class="catalog-rail">
        <article
          class="card panel"
          [class.collapsed]="!panelOpen().directions"
          [attr.aria-expanded]="panelOpen().directions"
        >
          <button
            type="button"
            class="panel-toggle"
            [attr.title]="panelOpen().directions ? 'Згорнути: Напрямки' : 'Напрямки'"
            [attr.aria-label]="panelOpen().directions ? 'Згорнути напрямки' : 'Розгорнути напрямки'"
            (click)="togglePanel('directions')"
          >
            @if (panelOpen().directions) {
              <h3>Напрямки</h3>
              <span class="panel-caret" aria-hidden="true"></span>
            } @else {
              <svg class="panel-icon" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z"
                />
              </svg>
            }
          </button>
          <div class="panel-body">
          @if (canManageDirections()) {
            <form class="inline" novalidate (submit)="$event.preventDefault()">
              <input
                [(ngModel)]="newDirection"
                name="newDirection"
                placeholder="Назва напрямку"
              />
              <button type="button" (click)="saveDirection()">
                {{ editingDirectionId() ? 'Зберегти' : 'Додати' }}
              </button>
              @if (editingDirectionId()) {
                <button type="button" class="ghost-neutral" (click)="cancelEditDirection()">
                  Скасувати
                </button>
              }
            </form>
          }
          <ul>
            @for (d of directions(); track d.id) {
              <li>
                <span>
                  {{ d.name }}
                  @if (!d.isActive) {
                    <small class="badge">вимкнено</small>
                  }
                </span>
                @if (canManageDirections()) {
                  <span class="row-actions">
                    <label class="toggle" [title]="d.isActive ? 'Увімкнено' : 'Вимкнено'">
                      <input
                        type="checkbox"
                        [checked]="d.isActive"
                        (change)="setDirectionActive(d, $any($event.target).checked)"
                      />
                    </label>
                    <button
                      type="button"
                      class="icon-btn"
                      title="Редагувати"
                      aria-label="Редагувати напрямок"
                      (click)="startEditDirection(d)"
                    >
                      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                        <path
                          fill="currentColor"
                          d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"
                        />
                      </svg>
                    </button>
                    <button
                      type="button"
                      class="icon-btn danger"
                      title="Видалити назавжди"
                      aria-label="Видалити напрямок назавжди"
                      (click)="hardDeleteDirection(d)"
                    >
                      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                        <path
                          fill="currentColor"
                          d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"
                        />
                      </svg>
                    </button>
                  </span>
                }
              </li>
            }
          </ul>
          </div>
        </article>

        <article
          class="card panel"
          [class.collapsed]="!panelOpen().departments"
          [attr.aria-expanded]="panelOpen().departments"
        >
          <button
            type="button"
            class="panel-toggle"
            [attr.title]="panelOpen().departments ? 'Згорнути: Відділи' : 'Відділи'"
            [attr.aria-label]="panelOpen().departments ? 'Згорнути відділи' : 'Розгорнути відділи'"
            (click)="togglePanel('departments')"
          >
            @if (panelOpen().departments) {
              <h3>Відділи</h3>
              <span class="panel-caret" aria-hidden="true"></span>
            } @else {
              <svg class="panel-icon" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M12 2 4.5 20.3l1.8.7L12 6.2l5.7 14.8 1.8-.7L12 2zm0 8.5-2.2 5.7h4.4L12 10.5z"
                />
              </svg>
            }
          </button>
          <div class="panel-body">
          @if (canManageDepartments()) {
            <form class="dept-form" novalidate (submit)="$event.preventDefault()">
              <input
                [(ngModel)]="newDepartment"
                name="newDepartment"
                placeholder="Назва відділу"
              />
              <select [(ngModel)]="newDepartmentDirectionId" name="newDepartmentDirectionId">
                <option value="">Без напрямку</option>
                @for (dir of formDirectionOptions(); track dir.id) {
                  <option [value]="dir.id">{{ dir.name }}</option>
                }
              </select>
              <div class="form-actions">
                <button type="button" (click)="saveDepartment()">
                  {{ editingDepartmentId() ? 'Зберегти' : 'Додати' }}
                </button>
                @if (editingDepartmentId()) {
                  <button type="button" class="ghost-neutral" (click)="cancelEditDepartment()">
                    Скасувати
                  </button>
                }
              </div>
            </form>
          }
          <ul>
            @for (d of departments(); track d.id) {
              <li>
                <span>
                  {{ d.name }}
                  @if (departmentDirectionLabel(d)) {
                    <small>· {{ departmentDirectionLabel(d) }}</small>
                  }
                  @if (!d.isActive || d.isHidden) {
                    <small class="badge">приховано</small>
                  }
                </span>
                @if (canManageDepartments()) {
                  <span class="row-actions">
                    <label
                      class="toggle"
                      [title]="d.isActive && !d.isHidden ? 'Увімкнено' : 'Вимкнено'"
                    >
                      <input
                        type="checkbox"
                        [checked]="d.isActive && !d.isHidden"
                        (change)="setDepartmentActive(d, $any($event.target).checked)"
                      />
                    </label>
                    <button
                      type="button"
                      class="icon-btn"
                      title="Редагувати"
                      aria-label="Редагувати відділ"
                      (click)="startEditDepartment(d)"
                    >
                      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                        <path
                          fill="currentColor"
                          d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"
                        />
                      </svg>
                    </button>
                    <button
                      type="button"
                      class="icon-btn danger"
                      title="Видалити назавжди"
                      aria-label="Видалити відділ назавжди"
                      (click)="hardDeleteDepartment(d)"
                    >
                      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                        <path
                          fill="currentColor"
                          d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"
                        />
                      </svg>
                    </button>
                  </span>
                }
              </li>
            }
          </ul>
          </div>
        </article>

        <article
          class="card panel card-positions"
          [class.collapsed]="!panelOpen().positions"
          [attr.aria-expanded]="panelOpen().positions"
        >
          <button
            type="button"
            class="panel-toggle"
            [attr.title]="panelOpen().positions ? 'Згорнути: Посади' : 'Посади'"
            [attr.aria-label]="panelOpen().positions ? 'Згорнути посади' : 'Розгорнути посади'"
            (click)="togglePanel('positions')"
          >
            @if (panelOpen().positions) {
              <h3>Посади</h3>
              <span class="panel-caret" aria-hidden="true"></span>
            } @else {
              <svg class="panel-icon" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M20 6h-4V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2H4a2 2 0 0 0-2 2v11a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3V8a2 2 0 0 0-2-2zM10 4h4v2h-4V4zm10 15a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V8h16v11z"
                />
              </svg>
            }
          </button>
          <div class="panel-body">
          @if (canManagePositions()) {
            <form class="position-form" novalidate (submit)="$event.preventDefault()">
              <label>
                Назва
                <input
                  [(ngModel)]="formName"
                  name="formName"
                  placeholder="Назва посади"
                />
              </label>
              <label>
                Відділ
                <select
                  [(ngModel)]="formDepartmentId"
                  name="formDepartmentId"
                  (ngModelChange)="onFormDepartmentChange()"
                >
                  <option value="">Без відділу</option>
                  @for (d of formDepartmentOptions(); track d.id) {
                    <option [value]="d.id">{{ d.name }}</option>
                  }
                </select>
              </label>
              @if (formDepartmentId) {
                <p class="hint">
                  @if (inheritedDirectionLabel()) {
                    Напрямок від відділу: {{ inheritedDirectionLabel() }}
                  } @else {
                    Відділ без напрямку — посада успадковує відсутність напрямку.
                  }
                </p>
              } @else {
                <label>
                  Напрямок
                  <select [(ngModel)]="formDirectionId" name="formDirectionId">
                    <option value="">Без напрямку</option>
                    @for (dir of formPositionDirectionOptions(); track dir.id) {
                      <option [value]="dir.id">{{ dir.name }}</option>
                    }
                  </select>
                </label>
              }
              <label>
                Опис
                <textarea
                  [(ngModel)]="formDescription"
                  name="formDescription"
                  rows="2"
                  placeholder="Опис посади (необовʼязково)"
                ></textarea>
              </label>
              @if (editingId()) {
                <label class="check">
                  <input type="checkbox" [(ngModel)]="formIsActive" name="formIsActive" />
                  Увімкнено
                </label>
              }
              <div class="form-actions">
                <button type="button" (click)="savePosition()">
                  {{ editingId() ? 'Зберегти' : 'Додати' }}
                </button>
                @if (editingId()) {
                  <button type="button" class="ghost-neutral" (click)="cancelEdit()">Скасувати</button>
                }
              </div>
            </form>
          }
          <ul>
            @for (p of positions(); track p.id) {
              <li
                class="position-row"
                [class.selected]="selectedPositionId() === p.id"
              >
                <button type="button" class="select-pos" (click)="selectPosition(p)">
                  <strong>{{ p.name }}</strong>
                  <small>
                    {{ departmentLabel(p) }}
                    @if (directionLabel(p)) {
                      · {{ directionLabel(p) }}
                    }
                  </small>
                  @if (p.description) {
                    <small class="desc">{{ p.description }}</small>
                  }
                  @if (!p.isActive) {
                    <small class="badge">вимкнено</small>
                  }
                </button>
                @if (canManagePositions()) {
                  <span class="row-actions">
                    <label class="toggle" [title]="p.isActive ? 'Увімкнено' : 'Вимкнено'">
                      <input
                        type="checkbox"
                        [checked]="p.isActive"
                        (click)="$event.stopPropagation()"
                        (change)="setPositionActive(p, $any($event.target).checked)"
                      />
                    </label>
                    <button
                      type="button"
                      class="icon-btn"
                      title="Редагувати"
                      aria-label="Редагувати посаду"
                      (click)="startEdit(p)"
                    >
                      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                        <path
                          fill="currentColor"
                          d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"
                        />
                      </svg>
                    </button>
                    <button
                      type="button"
                      class="icon-btn danger"
                      title="Видалити назавжди"
                      aria-label="Видалити посаду назавжди"
                      (click)="hardDeletePosition(p)"
                    >
                      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                        <path
                          fill="currentColor"
                          d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"
                        />
                      </svg>
                    </button>
                  </span>
                }
              </li>
            }
          </ul>
          </div>
        </article>
      </div>

      @if (selectedPosition(); as pos) {
        <article class="card catalog-panel">
          <div class="panel-head">
            <h3>Каталог посади: {{ pos.name }}</h3>
            <button type="button" class="ghost-neutral" (click)="clearSelection()">Закрити</button>
          </div>
          <div class="tabs" role="tablist">
            <button
              type="button"
              role="tab"
              [class.active]="catalogTab() === 'skills'"
              (click)="catalogTab.set('skills')"
            >
              Навички
            </button>
            <button
              type="button"
              role="tab"
              [class.active]="catalogTab() === 'goals'"
              (click)="catalogTab.set('goals')"
            >
              Цілі
            </button>
            <button
              type="button"
              role="tab"
              [class.active]="catalogTab() === 'duties'"
              (click)="catalogTab.set('duties')"
            >
              Обовʼязки
            </button>
          </div>

          @if (catalogTab() === 'skills') {
            <div class="tab-body">
              @if (canManagePositions()) {
                <form class="inline add-row" (ngSubmit)="addSkillRequirement()">
                  <select [(ngModel)]="reqSkillId" name="reqSkillId">
                    <option value="">Оберіть навичку</option>
                    @for (s of availableSkills(); track s.id) {
                      <option [value]="s.id">{{ s.group?.name || '' }} — {{ s.name }}</option>
                    }
                  </select>
                  <label class="level">
                    Рівень
                    <input
                      type="number"
                      min="0"
                      max="5"
                      [(ngModel)]="reqTargetLevel"
                      name="reqTargetLevel"
                    />
                  </label>
                  <label class="check">
                    <input type="checkbox" [(ngModel)]="reqRequired" name="reqRequired" />
                    Обовʼязкова
                  </label>
                  <button type="submit">Додати</button>
                </form>
              }
              <ul>
                @for (r of skillRequirements(); track r.id) {
                  <li>
                    <span>
                      <strong>{{ r.skillName || r.skillCode }}</strong>
                      <small>ціль {{ r.targetLevel }}/{{ r.skillScaleMax ?? 5 }}</small>
                      @if (r.required) {
                        <small class="badge">обовʼязкова</small>
                      }
                    </span>
                    @if (canManagePositions()) {
                      <span class="row-actions">
                        <button
                          type="button"
                          class="ghost-neutral"
                          (click)="bumpRequirementLevel(r, -1)"
                          [disabled]="r.targetLevel <= 0"
                        >
                          −
                        </button>
                        <button
                          type="button"
                          class="ghost-neutral"
                          (click)="bumpRequirementLevel(r, 1)"
                          [disabled]="r.targetLevel >= (r.skillScaleMax ?? 5)"
                        >
                          +
                        </button>
                        <button type="button" class="ghost" (click)="removeSkillRequirement(r)">
                          Прибрати
                        </button>
                      </span>
                    }
                  </li>
                } @empty {
                  <li class="muted-row">Немає вимог до навичок</li>
                }
              </ul>
            </div>
          }

          @if (catalogTab() === 'goals') {
            <div class="tab-body">
              @if (canManagePositions()) {
                <form class="position-form" (ngSubmit)="addGoalTemplate()">
                  <label>
                    Тип
                    <select [(ngModel)]="goalKind" name="goalKind">
                      <option value="career">Карʼєра</option>
                      <option value="probation">Випробувальний</option>
                      <option value="quarterly">Квартальна</option>
                    </select>
                  </label>
                  <label>
                    Назва
                    <input [(ngModel)]="goalTitle" name="goalTitle" placeholder="Назва цілі" />
                  </label>
                  <label>
                    Опис
                    <textarea
                      [(ngModel)]="goalDescription"
                      name="goalDescription"
                      rows="2"
                      placeholder="Опис (необовʼязково)"
                    ></textarea>
                  </label>
                  <button type="submit">Додати шаблон</button>
                </form>
              }
              <ul>
                @for (g of goalTemplates(); track g.id) {
                  <li>
                    <span>
                      <strong>{{ g.title }}</strong>
                      <small class="badge">{{ goalKindLabel(g.goalKind) }}</small>
                      @if (g.description) {
                        <small class="desc">{{ g.description }}</small>
                      }
                    </span>
                    @if (canManagePositions()) {
                      <button type="button" class="ghost" (click)="removeGoalTemplate(g)">
                        Прибрати
                      </button>
                    }
                  </li>
                } @empty {
                  <li class="muted-row">Немає шаблонів цілей</li>
                }
              </ul>
            </div>
          }

          @if (catalogTab() === 'duties') {
            <div class="tab-body">
              @if (canManagePositions()) {
                <form class="position-form" (ngSubmit)="addDuty()">
                  <label>
                    Назва
                    <input [(ngModel)]="dutyTitle" name="dutyTitle" placeholder="Обовʼязок" />
                  </label>
                  <label>
                    Опис
                    <textarea
                      [(ngModel)]="dutyDescription"
                      name="dutyDescription"
                      rows="2"
                      placeholder="Опис (необовʼязково)"
                    ></textarea>
                  </label>
                  <label>
                    Порядок
                    <input
                      type="number"
                      [(ngModel)]="dutySortOrder"
                      name="dutySortOrder"
                      min="0"
                    />
                  </label>
                  <button type="submit">Додати</button>
                </form>
              }
              <ul>
                @for (d of duties(); track d.id) {
                  <li>
                    <span>
                      <strong>{{ d.title }}</strong>
                      <small>порядок {{ d.sortOrder }}</small>
                      @if (d.description) {
                        <small class="desc">{{ d.description }}</small>
                      }
                    </span>
                    @if (canManagePositions()) {
                      <span class="row-actions">
                        <button
                          type="button"
                          class="ghost-neutral"
                          (click)="moveDuty(d, -1)"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          class="ghost-neutral"
                          (click)="moveDuty(d, 1)"
                        >
                          ↓
                        </button>
                        <button type="button" class="ghost" (click)="removeDuty(d)">Прибрати</button>
                      </span>
                    }
                  </li>
                } @empty {
                  <li class="muted-row">Немає обовʼязків</li>
                }
              </ul>
            </div>
          }
        </article>
      }

      <article class="card">
        <h3>Каталог навичок</h3>
        <p class="muted">Довідник груп і навичок (seed з реєстру Track B)</p>
        @for (g of skillGroups(); track g.id) {
          <div class="catalog-group">
            <strong>{{ g.name }}</strong>
            <small class="code">{{ g.code }}</small>
            <ul class="flat">
              @for (s of skillsForGroup(g.id); track s.id) {
                <li>
                  <span>{{ s.name }}</span>
                  <small class="code">{{ s.code }}</small>
                </li>
              }
            </ul>
          </div>
        }
      </article>
    </section>
  `,
  styles: [
    `
      .section {
        display: grid;
        gap: 1rem;
      }
      h2 {
        margin: 0;
        font-size: 1.35rem;
        color: var(--pw-text-strong);
      }
      h3 {
        margin: 0;
        font-size: 1.05rem;
      }
      .lead,
      .muted {
        color: var(--pw-muted);
        margin: 0;
      }
      .catalog-rail {
        display: flex;
        flex-wrap: nowrap;
        gap: 1rem;
        align-items: stretch;
        min-width: 0;
        overflow-x: auto;
      }
      .card {
        background: var(--pw-surface);
        border: 1px solid var(--pw-border);
        border-radius: 12px;
        padding: 1rem;
        display: grid;
        gap: 0.75rem;
        align-content: start;
        min-width: 0;
      }
      .card.panel {
        flex: 1 1 0;
        min-width: 14rem;
        max-width: 100%;
        transition:
          flex-basis 0.22s ease,
          min-width 0.22s ease,
          max-width 0.22s ease,
          padding 0.22s ease;
      }
      .card.panel.card-positions {
        flex-grow: 1.35;
      }
      .card.panel.collapsed {
        flex: 0 0 3.25rem;
        min-width: 3.25rem;
        max-width: 3.25rem;
        padding: 0.65rem 0.35rem;
        overflow: hidden;
      }
      .panel-toggle {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
        width: 100%;
        margin: 0;
        padding: 0;
        border: 0;
        background: transparent;
        color: inherit;
        cursor: pointer;
        text-align: left;
        min-height: 2rem;
      }
      .panel-toggle h3 {
        margin: 0;
        font-size: 1.05rem;
      }
      .panel-toggle .panel-caret {
        flex: 0 0 auto;
        width: 1.6rem;
        height: 1.6rem;
        display: grid;
        place-items: center;
        border-radius: 6px;
        border: 1px solid color-mix(in srgb, var(--pw-muted) 55%, transparent);
        background: var(--pw-surface-2, color-mix(in srgb, var(--pw-muted) 8%, var(--pw-surface)));
        color: var(--pw-text-strong, inherit);
        font-size: 1.05rem;
        line-height: 1;
        transform: rotate(90deg);
        transition:
          transform 0.15s ease,
          background 0.15s ease,
          border-color 0.15s ease,
          color 0.15s ease;
      }
      .panel-toggle .panel-caret::before {
        content: '▾';
      }
      .panel-toggle:hover .panel-caret {
        background: var(--pw-accent-soft);
        border-color: var(--pw-accent);
        color: var(--pw-accent);
      }
      .card.panel.collapsed .panel-toggle {
        justify-content: center;
        padding: 0.25rem 0;
      }
      .panel-icon {
        display: block;
        color: var(--pw-accent);
      }
      .panel-body {
        display: grid;
        gap: 0.75rem;
        min-width: 0;
        overflow: hidden;
      }
      .card.panel.collapsed .panel-body {
        display: none;
      }
      @media (prefers-reduced-motion: reduce) {
        .card.panel {
          transition: none;
        }
      }
      @media (max-width: 640px) {
        .catalog-rail {
          flex-wrap: wrap;
        }
        .card.panel,
        .card.panel.collapsed {
          flex: 1 1 100%;
          min-width: 0;
          max-width: none;
        }
        .card.panel.collapsed {
          flex-basis: 3.25rem;
          max-width: 3.25rem;
          min-width: 3.25rem;
        }
      }
      .inline {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        align-items: center;
      }
      .dept-form {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        align-items: center;
        margin-bottom: 0.5rem;
      }
      .dept-form input,
      .dept-form select {
        flex: 1 1 120px;
        min-width: 0;
      }
      .hint {
        margin: 0;
        font-size: 0.85rem;
        opacity: 0.75;
      }
      .inline input,
      .inline select {
        flex: 1 1 120px;
        min-width: 0;
      }
      .inline button {
        flex: 0 0 auto;
        white-space: nowrap;
      }
      .add-row .level {
        display: flex;
        gap: 0.35rem;
        align-items: center;
        font-size: 0.9rem;
      }
      .add-row .level input {
        width: 3.5rem;
        flex: 0 0 auto;
      }
      .position-form {
        display: grid;
        gap: 0.55rem;
      }
      .position-form label {
        display: grid;
        gap: 0.3rem;
        font-size: 0.9rem;
      }
      .position-form label.check {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 0.5rem;
      }
      .position-form label.check input[type='checkbox'] {
        width: 1rem;
        height: 1rem;
        margin: 0;
        padding: 0;
        border: none;
        border-radius: 2px;
        flex: 0 0 auto;
      }
      .form-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
      }
      input,
      select,
      textarea,
      button {
        padding: 0.5rem 0.7rem;
        border-radius: 8px;
        border: 1px solid var(--pw-border-strong);
        box-sizing: border-box;
        font: inherit;
      }
      textarea {
        resize: vertical;
        min-height: 2.5rem;
      }
      button {
        background: var(--pw-accent);
        color: var(--pw-on-accent);
        border: 0;
        cursor: pointer;
      }
      button:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }
      .ghost {
        background: transparent;
        color: var(--pw-danger);
        border: 1px solid #f3d1d1;
      }
      .ghost-neutral {
        background: transparent;
        color: var(--pw-text);
        border: 1px solid var(--pw-border-strong);
      }
      .ok-btn {
        background: transparent;
        color: #027a48;
        border: 1px solid #abefc6;
      }
      ul {
        list-style: none;
        padding: 0;
        margin: 0;
        display: grid;
        gap: 0.45rem;
      }
      li {
        display: flex;
        justify-content: space-between;
        gap: 0.75rem;
        align-items: center;
        padding: 0.35rem 0;
        border-bottom: 1px solid #eef2f7;
      }
      .position-row {
        align-items: flex-start;
      }
      .position-row.selected {
        background: #f0f7ff;
        margin: 0 -0.5rem;
        padding-left: 0.5rem;
        padding-right: 0.5rem;
        border-radius: 8px;
      }
      .select-pos {
        display: grid;
        gap: 0.15rem;
        min-width: 0;
        flex: 1 1 auto;
        text-align: left;
        background: transparent;
        color: inherit;
        border: 0;
        padding: 0.15rem 0;
        cursor: pointer;
      }
      .row-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.25rem;
        flex-shrink: 0;
        align-items: center;
      }
      .icon-btn {
        display: inline-grid;
        place-items: center;
        width: 2rem;
        height: 2rem;
        padding: 0;
        border-radius: 8px;
        background: transparent;
        color: var(--pw-text);
        border: 1px solid var(--pw-border-strong);
      }
      .icon-btn:hover {
        background: color-mix(in srgb, var(--pw-accent) 10%, transparent);
      }
      .icon-btn.danger {
        color: var(--pw-danger);
        border-color: #f3d1d1;
      }
      .icon-btn.danger:hover {
        background: color-mix(in srgb, var(--pw-danger) 12%, transparent);
      }
      .toggle {
        display: inline-grid;
        place-items: center;
        margin: 0;
        cursor: pointer;
        min-height: 2rem;
        padding: 0 0.2rem;
      }
      .toggle input {
        width: 1.05rem;
        height: 1.05rem;
        accent-color: var(--pw-accent);
        cursor: pointer;
      }
      small {
        color: var(--pw-muted);
      }
      .desc {
        display: block;
        margin-top: 0.15rem;
      }
      .badge {
        background: #fef3c7;
        color: #92400e;
        padding: 0.1rem 0.4rem;
        border-radius: 999px;
        margin-left: 0.35rem;
      }
      .check {
        display: flex;
        gap: 0.5rem;
        align-items: center;
      }
      .check input[type='checkbox'] {
        width: 1rem;
        height: 1rem;
        margin: 0;
        padding: 0;
        border: none;
        flex: 0 0 auto;
      }
      .error {
        color: var(--pw-danger);
        margin: 0;
      }
      .panel-head {
        display: flex;
        justify-content: space-between;
        gap: 0.75rem;
        align-items: center;
      }
      .tabs {
        display: flex;
        flex-wrap: wrap;
        gap: 0.35rem;
      }
      .tabs button {
        background: transparent;
        color: var(--pw-text);
        border: 1px solid var(--pw-border-strong);
      }
      .tabs button.active {
        background: var(--pw-accent);
        color: var(--pw-on-accent);
        border-color: transparent;
      }
      .tab-body {
        display: grid;
        gap: 0.75rem;
      }
      .muted-row {
        color: var(--pw-muted);
        border: 0;
      }
      .catalog-group {
        display: grid;
        gap: 0.35rem;
        padding-top: 0.5rem;
        border-top: 1px solid #eef2f7;
      }
      .catalog-group:first-of-type {
        border-top: 0;
        padding-top: 0;
      }
      .flat li {
        border: 0;
        padding: 0.2rem 0;
      }
      .code {
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        font-size: 0.8rem;
      }
    `,
  ],
})
export class PositionManagementPageComponent implements OnInit {
  private readonly api = inject(SettingsOrgApiService);
  private readonly session = inject(SessionStore);

  readonly departments = signal<OrgDepartment[]>([]);
  readonly directions = signal<OrgDirection[]>([]);
  readonly positions = signal<OrgPosition[]>([]);
  readonly skillGroups = signal<OrgSkillGroup[]>([]);
  readonly catalogSkills = signal<OrgSkill[]>([]);
  readonly skillRequirements = signal<OrgPositionSkillRequirement[]>([]);
  readonly goalTemplates = signal<OrgPositionGoalTemplate[]>([]);
  readonly duties = signal<OrgPositionDuty[]>([]);
  readonly error = signal('');
  readonly editingId = signal<string | null>(null);
  readonly editingDepartmentId = signal<string | null>(null);
  readonly editingDirectionId = signal<string | null>(null);
  readonly selectedPositionId = signal<string | null>(null);
  readonly catalogTab = signal<CatalogTab>('skills');
  readonly panelOpen = signal<Record<CatalogPanel, boolean>>({
    directions: true,
    departments: true,
    positions: true,
  });

  togglePanel(panel: CatalogPanel): void {
    this.panelOpen.update((state) => ({ ...state, [panel]: !state[panel] }));
  }

  newDepartment = '';
  newDepartmentDirectionId = '';
  newDirection = '';
  formName = '';
  formDepartmentId = '';
  formDirectionId = '';
  formDescription = '';
  formIsActive = true;

  reqSkillId = '';
  reqTargetLevel = 3;
  reqRequired = true;

  goalKind: GoalKind = 'probation';
  goalTitle = '';
  goalDescription = '';

  dutyTitle = '';
  dutyDescription = '';
  dutySortOrder = 0;

  readonly canManage = computed(
    () =>
      this.session.user()?.role === 'admin' ||
      this.session.hasPermission(Permission.DepartmentsManage) ||
      this.session.hasPermission(Permission.PositionsManage) ||
      this.session.hasPermission(Permission.DirectionsManage),
  );

  readonly canManageDepartments = computed(
    () =>
      this.session.user()?.role === 'admin' ||
      this.session.hasPermission(Permission.DepartmentsManage),
  );

  readonly canManageDirections = computed(
    () =>
      this.session.user()?.role === 'admin' ||
      this.session.hasPermission(Permission.DirectionsManage),
  );

  readonly canManagePositions = computed(
    () =>
      this.session.user()?.role === 'admin' ||
      this.session.hasPermission(Permission.PositionsManage),
  );

  readonly activeDepartments = computed(() =>
    this.departments().filter((d) => d.isActive && !d.isHidden),
  );

  readonly activeDirections = computed(() =>
    this.directions().filter((d) => d.isActive),
  );

  readonly selectedPosition = computed(() => {
    const id = this.selectedPositionId();
    if (!id) return null;
    return this.positions().find((p) => p.id === id) ?? null;
  });

  readonly availableSkills = computed(() => {
    const used = new Set(this.skillRequirements().map((r) => r.skillId));
    return this.catalogSkills().filter((s) => s.isActive && !used.has(s.id));
  });

  /** Active options plus the currently selected row when editing a legacy value. */
  formDepartmentOptions(): OrgDepartment[] {
    const active = this.activeDepartments();
    const id = this.formDepartmentId;
    if (!id || active.some((d) => d.id === id)) return active;
    const current = this.departments().find((d) => d.id === id);
    return current ? [current, ...active] : active;
  }

  formDirectionOptions(): OrgDirection[] {
    const active = this.activeDirections();
    const id = this.newDepartmentDirectionId;
    if (!id || active.some((d) => d.id === id)) return active;
    const current = this.directions().find((d) => d.id === id);
    return current ? [current, ...active] : active;
  }

  /** Direction options for a position without a department. */
  formPositionDirectionOptions(): OrgDirection[] {
    const active = this.activeDirections();
    const id = this.formDirectionId;
    if (!id || active.some((d) => d.id === id)) return active;
    const current = this.directions().find((d) => d.id === id);
    return current ? [current, ...active] : active;
  }

  onFormDepartmentChange(): void {
    if (!this.formDepartmentId) return;
    const dept = this.departments().find((d) => d.id === this.formDepartmentId);
    this.formDirectionId = dept?.directionId || '';
  }

  inheritedDirectionLabel(): string {
    const deptId = this.formDepartmentId;
    if (!deptId) return '';
    const dept = this.departments().find((d) => d.id === deptId);
    if (!dept) return '';
    return dept.directionName || dept.direction?.name || '';
  }

  departmentDirectionLabel(d: OrgDepartment): string {
    return d.directionName || d.direction?.name || '';
  }

  skillsForGroup(groupId: string): OrgSkill[] {
    return this.catalogSkills().filter((s) => s.groupId === groupId);
  }

  goalKindLabel(kind: string): string {
    return GOAL_KIND_LABELS[kind as GoalKind] || kind;
  }

  ngOnInit(): void {
    this.reload();
  }

  departmentLabel(p: OrgPosition): string {
    return p.departmentName || p.department?.name || 'Без відділу';
  }

  directionLabel(p: OrgPosition): string {
    return p.directionName || '';
  }

  reload(): void {
    this.api.getDepartments().subscribe({
      next: (d) => this.departments.set(d),
      error: () => this.error.set('Не вдалося завантажити відділи'),
    });
    this.api.getDirections().subscribe({
      next: (d) => this.directions.set(d),
      error: () => this.error.set('Не вдалося завантажити напрямки'),
    });
    this.api.getPositions(true).subscribe({
      next: (p) => this.positions.set(p),
      error: () => this.error.set('Не вдалося завантажити посади'),
    });
    this.api.getSkillGroups().subscribe({
      next: (g) => this.skillGroups.set(g),
      error: () => this.error.set('Не вдалося завантажити групи навичок'),
    });
    this.api.getSkills().subscribe({
      next: (s) => this.catalogSkills.set(s),
      error: () => this.error.set('Не вдалося завантажити навички'),
    });
    const selected = this.selectedPositionId();
    if (selected) this.loadPositionCatalog(selected);
  }

  selectPosition(p: OrgPosition): void {
    this.selectedPositionId.set(p.id);
    this.catalogTab.set('skills');
    this.loadPositionCatalog(p.id);
  }

  clearSelection(): void {
    this.selectedPositionId.set(null);
    this.skillRequirements.set([]);
    this.goalTemplates.set([]);
    this.duties.set([]);
  }

  private loadPositionCatalog(positionId: string): void {
    this.api.getPositionSkillRequirements(positionId).subscribe({
      next: (rows) => this.skillRequirements.set(rows),
      error: () => this.error.set('Не вдалося завантажити вимоги навичок'),
    });
    this.api.getPositionGoalTemplates(positionId, true).subscribe({
      next: (rows) => this.goalTemplates.set(rows.filter((r) => r.isActive)),
      error: () => this.error.set('Не вдалося завантажити шаблони цілей'),
    });
    this.api.getPositionDuties(positionId, true).subscribe({
      next: (rows) => this.duties.set(rows.filter((r) => r.isActive)),
      error: () => this.error.set('Не вдалося завантажити обовʼязки'),
    });
  }

  private apiError(err: unknown, fallback: string): string {
    const msg = (err as { error?: { message?: string | string[] } })?.error?.message;
    if (Array.isArray(msg)) return msg.join(', ');
    return msg || fallback;
  }

  saveDepartment(): void {
    this.error.set('');
    if (!this.newDepartment.trim()) {
      this.error.set('Вкажіть назву відділу');
      return;
    }
    const body = {
      name: this.newDepartment.trim(),
      directionId: this.newDepartmentDirectionId || null,
    };
    const id = this.editingDepartmentId();
    if (id) {
      this.api.updateDepartment(id, body).subscribe({
        next: () => {
          this.cancelEditDepartment();
          this.reload();
        },
        error: (err) => this.error.set(this.apiError(err, 'Не вдалося зберегти відділ')),
      });
      return;
    }
    this.api.createDepartment(body).subscribe({
      next: () => {
        this.cancelEditDepartment();
        this.reload();
      },
      error: (err) => this.error.set(this.apiError(err, 'Не вдалося додати відділ')),
    });
  }

  startEditDepartment(d: OrgDepartment): void {
    this.panelOpen.update((state) => ({ ...state, departments: true }));
    this.editingDepartmentId.set(d.id);
    this.newDepartment = d.name;
    this.newDepartmentDirectionId = d.directionId || '';
    this.error.set('');
  }

  cancelEditDepartment(): void {
    this.editingDepartmentId.set(null);
    this.newDepartment = '';
    this.newDepartmentDirectionId = '';
  }

  hardDeleteDepartment(d: OrgDepartment): void {
    if (!confirm(`Видалити відділ «${d.name}» назавжди?`)) return;
    this.api.deleteDepartment(d.id).subscribe({
      next: () => {
        if (this.editingDepartmentId() === d.id) this.cancelEditDepartment();
        this.reload();
      },
      error: (err) => this.error.set(this.apiError(err, 'Не вдалося видалити відділ')),
    });
  }

  setDepartmentActive(d: OrgDepartment, active: boolean): void {
    this.api
      .updateDepartment(d.id, {
        isActive: active,
        isHidden: !active,
      })
      .subscribe({
        next: () => this.reload(),
        error: () => this.error.set('Не вдалося змінити стан відділу'),
      });
  }

  saveDirection(): void {
    this.error.set('');
    if (!this.newDirection.trim()) {
      this.error.set('Вкажіть назву напрямку');
      return;
    }
    const name = this.newDirection.trim();
    const id = this.editingDirectionId();
    if (id) {
      this.api.updateDirection(id, { name }).subscribe({
        next: () => {
          this.cancelEditDirection();
          this.reload();
        },
        error: (err) => this.error.set(this.apiError(err, 'Не вдалося зберегти напрямок')),
      });
      return;
    }
    this.api.createDirection({ name }).subscribe({
      next: () => {
        this.cancelEditDirection();
        this.reload();
      },
      error: (err) => this.error.set(this.apiError(err, 'Не вдалося додати напрямок')),
    });
  }

  startEditDirection(d: OrgDirection): void {
    this.panelOpen.update((state) => ({ ...state, directions: true }));
    this.editingDirectionId.set(d.id);
    this.newDirection = d.name;
    this.error.set('');
  }

  cancelEditDirection(): void {
    this.editingDirectionId.set(null);
    this.newDirection = '';
  }

  hardDeleteDirection(d: OrgDirection): void {
    if (!confirm(`Видалити напрямок «${d.name}» назавжди?`)) return;
    this.api.deleteDirection(d.id).subscribe({
      next: () => {
        if (this.editingDirectionId() === d.id) this.cancelEditDirection();
        this.reload();
      },
      error: (err) => this.error.set(this.apiError(err, 'Не вдалося видалити напрямок')),
    });
  }

  setDirectionActive(d: OrgDirection, active: boolean): void {
    this.api.updateDirection(d.id, { isActive: active }).subscribe({
      next: () => this.reload(),
      error: () => this.error.set('Не вдалося змінити стан напрямку'),
    });
  }

  startEdit(p: OrgPosition): void {
    this.panelOpen.update((state) => ({ ...state, positions: true }));
    this.editingId.set(p.id);
    this.formName = p.name;
    this.formDepartmentId = p.departmentId || '';
    this.formDirectionId = p.directionId || '';
    this.formDescription = p.description || '';
    this.formIsActive = p.isActive;
    this.error.set('');
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.formName = '';
    this.formDepartmentId = '';
    this.formDirectionId = '';
    this.formDescription = '';
    this.formIsActive = true;
  }

  savePosition(): void {
    this.error.set('');
    if (!this.formName.trim()) {
      this.error.set('Вкажіть назву посади');
      return;
    }

    const departmentId = this.formDepartmentId || null;
    const body = {
      name: this.formName.trim(),
      departmentId,
      directionId: departmentId ? null : this.formDirectionId || null,
      description: this.formDescription.trim() || null,
    };

    const id = this.editingId();
    if (id) {
      this.api
        .updatePosition(id, {
          ...body,
          isActive: this.formIsActive,
        })
        .subscribe({
          next: () => {
            this.cancelEdit();
            this.reload();
          },
          error: (err) => this.error.set(this.apiError(err, 'Не вдалося зберегти посаду')),
        });
      return;
    }

    this.api.createPosition(body).subscribe({
      next: (created) => {
        this.cancelEdit();
        this.reload();
        this.selectPosition(created);
      },
      error: (err) => this.error.set(this.apiError(err, 'Не вдалося додати посаду')),
    });
  }

  hardDeletePosition(p: OrgPosition): void {
    if (!confirm(`Видалити посаду «${p.name}» назавжди?`)) return;
    this.api.deletePosition(p.id).subscribe({
      next: () => {
        if (this.selectedPositionId() === p.id) this.clearSelection();
        if (this.editingId() === p.id) this.cancelEdit();
        this.reload();
      },
      error: (err) => this.error.set(this.apiError(err, 'Не вдалося видалити посаду')),
    });
  }

  setPositionActive(p: OrgPosition, active: boolean): void {
    this.api.updatePosition(p.id, { isActive: active }).subscribe({
      next: () => this.reload(),
      error: () => this.error.set('Не вдалося змінити стан посади'),
    });
  }

  addSkillRequirement(): void {
    const positionId = this.selectedPositionId();
    if (!positionId) return;
    this.error.set('');
    if (!this.reqSkillId) {
      this.error.set('Оберіть навичку');
      return;
    }
    this.api
      .createPositionSkillRequirement(positionId, {
        skillId: this.reqSkillId,
        targetLevel: this.reqTargetLevel,
        required: this.reqRequired,
      })
      .subscribe({
        next: () => {
          this.reqSkillId = '';
          this.reqTargetLevel = 3;
          this.reqRequired = true;
          this.loadPositionCatalog(positionId);
        },
        error: (err) =>
          this.error.set(this.apiError(err, 'Не вдалося додати вимогу')),
      });
  }

  bumpRequirementLevel(r: OrgPositionSkillRequirement, delta: number): void {
    const positionId = this.selectedPositionId();
    if (!positionId) return;
    const next = Math.max(0, Math.min(r.skillScaleMax ?? 5, r.targetLevel + delta));
    if (next === r.targetLevel) return;
    this.api
      .updatePositionSkillRequirement(positionId, r.id, { targetLevel: next })
      .subscribe({
        next: () => this.loadPositionCatalog(positionId),
        error: () => this.error.set('Не вдалося оновити рівень'),
      });
  }

  removeSkillRequirement(r: OrgPositionSkillRequirement): void {
    const positionId = this.selectedPositionId();
    if (!positionId) return;
    this.api.deletePositionSkillRequirement(positionId, r.id).subscribe({
      next: () => this.loadPositionCatalog(positionId),
      error: () => this.error.set('Не вдалося прибрати вимогу'),
    });
  }

  addGoalTemplate(): void {
    const positionId = this.selectedPositionId();
    if (!positionId) return;
    this.error.set('');
    if (!this.goalTitle.trim()) {
      this.error.set('Вкажіть назву цілі');
      return;
    }
    this.api
      .createPositionGoalTemplate(positionId, {
        goalKind: this.goalKind,
        title: this.goalTitle.trim(),
        description: this.goalDescription.trim() || null,
      })
      .subscribe({
        next: () => {
          this.goalTitle = '';
          this.goalDescription = '';
          this.loadPositionCatalog(positionId);
        },
        error: (err) =>
          this.error.set(this.apiError(err, 'Не вдалося додати шаблон цілі')),
      });
  }

  removeGoalTemplate(g: OrgPositionGoalTemplate): void {
    const positionId = this.selectedPositionId();
    if (!positionId) return;
    this.api.deletePositionGoalTemplate(positionId, g.id).subscribe({
      next: () => this.loadPositionCatalog(positionId),
      error: () => this.error.set('Не вдалося прибрати шаблон цілі'),
    });
  }

  addDuty(): void {
    const positionId = this.selectedPositionId();
    if (!positionId) return;
    this.error.set('');
    if (!this.dutyTitle.trim()) {
      this.error.set('Вкажіть назву обовʼязку');
      return;
    }
    this.api
      .createPositionDuty(positionId, {
        title: this.dutyTitle.trim(),
        description: this.dutyDescription.trim() || null,
        sortOrder: this.dutySortOrder,
      })
      .subscribe({
        next: () => {
          this.dutyTitle = '';
          this.dutyDescription = '';
          this.dutySortOrder = this.duties().length;
          this.loadPositionCatalog(positionId);
        },
        error: (err) =>
          this.error.set(this.apiError(err, 'Не вдалося додати обовʼязок')),
      });
  }

  moveDuty(d: OrgPositionDuty, delta: number): void {
    const positionId = this.selectedPositionId();
    if (!positionId) return;
    const next = Math.max(0, d.sortOrder + delta);
    if (next === d.sortOrder) return;
    this.api.updatePositionDuty(positionId, d.id, { sortOrder: next }).subscribe({
      next: () => this.loadPositionCatalog(positionId),
      error: () => this.error.set('Не вдалося змінити порядок'),
    });
  }

  removeDuty(d: OrgPositionDuty): void {
    const positionId = this.selectedPositionId();
    if (!positionId) return;
    this.api.deletePositionDuty(positionId, d.id).subscribe({
      next: () => this.loadPositionCatalog(positionId),
      error: () => this.error.set('Не вдалося прибрати обовʼязок'),
    });
  }
}
