import { Component, inject } from '@angular/core';
import { PositionManagementFacade } from './position-management.facade';

@Component({
  selector: 'loom-organization-catalog-column',
  standalone: true,
  template: `
    <div class="catalog-layout">
      <div class="catalog-rail">
        <article
          class="card panel"
          [class.collapsed]="!vm.panelOpen().directions"
          [attr.aria-expanded]="vm.panelOpen().directions"
        >
        <button
          type="button"
          class="panel-toggle"
          [attr.title]="vm.panelOpen().directions ? 'Згорнути: Напрямки' : 'Напрямки'"
          [attr.aria-label]="vm.panelOpen().directions ? 'Згорнути напрямки' : 'Розгорнути напрямки'"
          (click)="vm.togglePanel('directions')"
        >
          @if (vm.panelOpen().directions) {
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
          @if (vm.canManageDirections()) {
            <button type="button" (click)="vm.startCreateDirection()">Додати напрямок</button>
          }
          <ul>
            @for (d of vm.directions(); track d.id) {
              <li>
                <span>
                  {{ d.name }}
                  @if (!d.isActive) {
                    <small class="badge">вимкнено</small>
                  }
                </span>
                @if (vm.canManageDirections()) {
                  <span class="row-actions">
                    <label class="toggle" [title]="d.isActive ? 'Увімкнено' : 'Вимкнено'">
                      <input
                        type="checkbox"
                        [checked]="d.isActive"
                        (change)="vm.setDirectionActive(d, $any($event.target).checked)"
                      />
                    </label>
                    <button
                      type="button"
                      class="icon-btn"
                      title="Редагувати"
                      aria-label="Редагувати напрямок"
                      (click)="vm.startEditDirection(d)"
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
                      (click)="vm.hardDeleteDirection(d)"
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
        [class.collapsed]="!vm.panelOpen().departments"
        [attr.aria-expanded]="vm.panelOpen().departments"
      >
        <button
          type="button"
          class="panel-toggle"
          [attr.title]="vm.panelOpen().departments ? 'Згорнути: Відділи' : 'Відділи'"
          [attr.aria-label]="vm.panelOpen().departments ? 'Згорнути відділи' : 'Розгорнути відділи'"
          (click)="vm.togglePanel('departments')"
        >
          @if (vm.panelOpen().departments) {
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
          @if (vm.canManageDepartments()) {
            <button type="button" (click)="vm.startCreateDepartment()">Додати відділ</button>
          }
          <ul>
            @for (d of vm.departments(); track d.id) {
              <li>
                <span>
                  {{ d.name }}
                  @if (vm.departmentDirectionLabel(d)) {
                    <small>· {{ vm.departmentDirectionLabel(d) }}</small>
                  }
                  @if (!d.isActive || d.isHidden) {
                    <small class="badge">приховано</small>
                  }
                </span>
                @if (vm.canManageDepartments()) {
                  <span class="row-actions">
                    <label
                      class="toggle"
                      [title]="d.isActive && !d.isHidden ? 'Увімкнено' : 'Вимкнено'"
                    >
                      <input
                        type="checkbox"
                        [checked]="d.isActive && !d.isHidden"
                        (change)="vm.setDepartmentActive(d, $any($event.target).checked)"
                      />
                    </label>
                    <button
                      type="button"
                      class="icon-btn"
                      title="Редагувати"
                      aria-label="Редагувати відділ"
                      (click)="vm.startEditDepartment(d)"
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
                      (click)="vm.hardDeleteDepartment(d)"
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
        [class.collapsed]="!vm.panelOpen().positions"
        [attr.aria-expanded]="vm.panelOpen().positions"
      >
        <button
          type="button"
          class="panel-toggle"
          [attr.title]="vm.panelOpen().positions ? 'Згорнути: Посади' : 'Посади'"
          [attr.aria-label]="vm.panelOpen().positions ? 'Згорнути посади' : 'Розгорнути посади'"
          (click)="vm.togglePanel('positions')"
        >
          @if (vm.panelOpen().positions) {
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
          @if (vm.canManagePositions()) {
            <button type="button" (click)="vm.startCreatePosition()">Додати посаду</button>
          }
          <ul>
            @for (p of vm.positions(); track p.id) {
              <li class="position-row">
                <button type="button" class="select-pos" (click)="vm.selectPosition(p)">
                  <strong>{{ p.name }}</strong>
                  <small>
                    {{ vm.departmentLabel(p) }}
                    @if (vm.directionLabel(p)) {
                      · {{ vm.directionLabel(p) }}
                    }
                  </small>
                  @if (p.description) {
                    <small class="desc">{{ p.description }}</small>
                  }
                  @if (!p.isActive) {
                    <small class="badge">вимкнено</small>
                  }
                </button>
                <span class="row-actions">
                  <button
                    type="button"
                    class="icon-btn"
                    title="Каталог посади"
                    aria-label="Відкрити каталог посади"
                    (click)="vm.openPositionCatalogPage(p)"
                  >
                    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                      <path
                        fill="currentColor"
                        d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9H9V9h10v2zm-4 4H9v-2h6v2zm4-8H9V5h10v2z"
                      />
                    </svg>
                  </button>
                @if (vm.canManagePositions()) {
                    <label class="toggle" [title]="p.isActive ? 'Увімкнено' : 'Вимкнено'">
                      <input
                        type="checkbox"
                        [checked]="p.isActive"
                        (click)="$event.stopPropagation()"
                        (change)="vm.setPositionActive(p, $any($event.target).checked)"
                      />
                    </label>
                    <button
                      type="button"
                      class="icon-btn"
                      title="Редагувати"
                      aria-label="Редагувати посаду"
                      (click)="vm.startEdit(p)"
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
                      (click)="vm.hardDeletePosition(p)"
                    >
                      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                        <path
                          fill="currentColor"
                          d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"
                        />
                      </svg>
                    </button>
                }
                </span>
              </li>
            }
          </ul>
        </div>
      </article>
      </div>

      <article
        class="card skills-block"
        [class.collapsed]="!vm.panelOpen().skills"
        [attr.aria-expanded]="vm.panelOpen().skills"
      >
        <button
          type="button"
          class="panel-toggle"
          [attr.title]="vm.panelOpen().skills ? 'Згорнути групи та навички' : 'Групи та навички'"
          [attr.aria-label]="
            vm.panelOpen().skills ? 'Згорнути групи та навички' : 'Розгорнути групи та навички'
          "
          (click)="vm.togglePanel('skills')"
        >
          @if (vm.panelOpen().skills) {
            <span class="panel-caret" aria-hidden="true"></span>
          } @else {
            <svg class="panel-icon" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path
                fill="currentColor"
                d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"
              />
            </svg>
          }
        </button>
        <div class="panel-body">
          <div class="skills-split">
            <div class="skills-col groups-col">
              <div class="col-toolbar">
                <h4>Групи</h4>
                @if (vm.canManagePositions()) {
                  <button type="button" (click)="vm.startCreateGroup()">Додати групу</button>
                }
              </div>
              <div class="groups-table">
                <div class="groups-head">
                  <button
                    type="button"
                    class="th"
                    [class.active]="true"
                    (click)="vm.toggleGroupNameSort()"
                  >
                    Назва
                    <span class="dir" aria-hidden="true">{{ vm.groupSortMark() }}</span>
                  </button>
                  <span class="th-actions"></span>
                </div>
                <ul>
                  <li
                    class="group-row pinned"
                    [class.selected]="vm.selectedSkillGroupId() === null"
                  >
                    <button type="button" class="select-group" (click)="vm.selectAllSkills()">
                      Усі навички
                    </button>
                    <span class="th-actions"></span>
                  </li>
                  <li
                    class="group-row pinned"
                    [class.selected]="vm.selectedSkillGroupId() === vm.ungroupedGroupId"
                  >
                    <button type="button" class="select-group" (click)="vm.selectUngrouped()">
                      Без групи
                    </button>
                    <span class="th-actions"></span>
                  </li>
                  @for (g of vm.sortedSkillGroups(); track g.id) {
                    <li
                      class="group-row"
                      [class.selected]="vm.selectedSkillGroupId() === g.id"
                    >
                      <button type="button" class="select-group" (click)="vm.selectSkillGroup(g)">
                        {{ g.name }}
                        @if (!g.isActive) {
                          <small class="badge">вимкнено</small>
                        }
                      </button>
                      @if (vm.canManagePositions()) {
                        <span class="row-actions">
                          <label class="toggle" [title]="g.isActive ? 'Увімкнено' : 'Вимкнено'">
                            <input
                              type="checkbox"
                              [checked]="g.isActive"
                              (change)="vm.setGroupActive(g, $any($event.target).checked)"
                            />
                          </label>
                          <button
                            type="button"
                            class="icon-btn"
                            title="Редагувати"
                            (click)="vm.startEditGroup(g)"
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
                            aria-label="Видалити групу назавжди"
                            (click)="vm.hardDeleteGroup(g)"
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
            </div>
            <div class="skills-col skills-list-col">
              <div class="col-toolbar">
                <h4>Навички</h4>
                @if (vm.canManagePositions()) {
                  <button type="button" (click)="vm.startCreateSkill()">Додати навичку</button>
                }
              </div>
              <div class="skills-table">
                <div class="skills-head">
                  <button
                    type="button"
                    class="th"
                    [class.active]="vm.skillSort().key === 'name'"
                    (click)="vm.toggleSkillSort('name')"
                  >
                    Назва
                    <span class="dir" aria-hidden="true">{{ vm.skillSortMark('name') }}</span>
                  </button>
                  <button
                    type="button"
                    class="th"
                    [class.active]="vm.skillSort().key === 'scale'"
                    (click)="vm.toggleSkillSort('scale')"
                  >
                    Тип шкали
                    <span class="dir" aria-hidden="true">{{ vm.skillSortMark('scale') }}</span>
                  </button>
                  <span class="th-actions"></span>
                </div>
                <ul>
                  @for (s of vm.skillsForSelectedGroup(); track s.id) {
                    <li class="skill-row">
                      <span class="skill-name">
                        {{ s.name }}
                        @if (!s.isActive) {
                          <small class="badge">вимкнено</small>
                        }
                        @if (vm.selectedSkillGroupId() === null && s.groupId == null) {
                          <small class="badge">Без групи</small>
                        }
                      </span>
                      <span class="skill-scale">
                        {{ vm.scaleKindLabel(s.scaleKind) }}
                        ·
                        @if (s.scaleKind === 'percent') {
                          {{ s.scaleMin }}–{{ s.scaleMax }}%
                        } @else {
                          {{ s.scaleMin }}–{{ s.scaleMax }}
                        }
                      </span>
                      @if (vm.canManagePositions()) {
                        <span class="row-actions">
                          <label class="toggle" [title]="s.isActive ? 'Увімкнено' : 'Вимкнено'">
                            <input
                              type="checkbox"
                              [checked]="s.isActive"
                              (change)="vm.setSkillActive(s, $any($event.target).checked)"
                            />
                          </label>
                          <button
                            type="button"
                            class="icon-btn"
                            title="Редагувати"
                            (click)="vm.startEditSkill(s)"
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
                            aria-label="Видалити навичку назавжди"
                            (click)="vm.hardDeleteSkill(s)"
                          >
                            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                              <path
                                fill="currentColor"
                                d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"
                              />
                            </svg>
                          </button>
                        </span>
                      } @else {
                        <span class="th-actions"></span>
                      }
                    </li>
                  }
                </ul>
              </div>
            </div>
          </div>
        </div>
      </article>
    </div>
  `,
  styles: [
    `
      :host {
        display: contents;
      }
      h3 {
        margin: 0;
        font-size: 1.05rem;
      }
      .catalog-layout {
        display: grid;
        gap: 1rem;
        min-width: 0;
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
        flex-grow: 1.08;
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
      .skills-block {
        min-width: 0;
      }
      .skills-block:not(.collapsed) {
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: start;
        column-gap: 0.5rem;
      }
      .skills-block:not(.collapsed) .panel-body {
        grid-column: 1;
        grid-row: 1;
      }
      .skills-block:not(.collapsed) .panel-toggle {
        grid-column: 2;
        grid-row: 1;
        width: auto;
        justify-content: center;
        align-self: start;
        margin-top: 0.1rem;
      }
      .skills-block.collapsed {
        padding-bottom: 0.65rem;
      }
      .skills-block .panel-body {
        display: grid;
        gap: 0.75rem;
      }
      .skills-block.collapsed .panel-body {
        display: none;
      }
      .skills-split {
        display: grid;
        grid-template-columns: minmax(14rem, 1fr) minmax(16rem, 1.35fr);
        gap: 0;
        align-items: stretch;
        min-width: 0;
      }
      .skills-col {
        display: grid;
        grid-template-rows: auto minmax(0, 1fr);
        align-content: stretch;
        justify-items: stretch;
        gap: 0.65rem;
        min-width: 0;
      }
      .groups-col {
        padding-right: 1.1rem;
        border-right: 1px solid color-mix(in srgb, var(--pw-text) 38%, var(--pw-border-strong));
      }
      .skills-list-col {
        padding-left: 1.1rem;
      }
      .skills-col h4 {
        margin: 0;
        font-size: 0.95rem;
      }
      .col-toolbar {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        align-items: center;
        justify-content: space-between;
      }
      .groups-table,
      .skills-table {
        --table-line: color-mix(in srgb, var(--pw-text) 38%, var(--pw-border-strong));
        display: grid;
        grid-template-rows: auto;
        grid-auto-rows: min-content;
        align-content: start;
        align-items: stretch;
        min-width: 0;
        width: 100%;
        height: 100%;
        max-height: min(24rem, 50vh);
        overflow-y: auto;
        border: 1px solid var(--table-line);
        border-radius: 8px;
        background: var(--pw-surface);
      }
      .groups-table {
        grid-template-columns: minmax(0, 1fr) 7.25rem;
      }
      .skills-table {
        grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr) 7.25rem;
      }
      .groups-table ul,
      .skills-table ul {
        display: contents;
      }
      .groups-head,
      .skills-head,
      .group-row,
      .skill-row {
        display: grid;
        grid-template-columns: subgrid;
        grid-column: 1 / -1;
        gap: 0;
        margin: 0;
        padding: 0;
        border: 0;
        border-radius: 0;
        background: transparent;
      }
      .groups-head,
      .skills-head {
        position: sticky;
        top: 0;
        z-index: 1;
        height: auto;
        background: var(--pw-surface-2, #f8fafc);
        border-bottom: 1px solid var(--table-line);
      }
      .groups-head > *,
      .skills-head > *,
      .group-row > *,
      .skill-row > * {
        display: flex;
        align-items: center;
        min-width: 0;
        min-height: 0;
        margin: 0;
        padding: 0.2rem 0.5rem;
        border: 0;
        border-right: 1px solid var(--table-line);
        border-radius: 0;
        box-sizing: border-box;
        background: transparent;
      }
      .groups-head > *:last-child,
      .skills-head > *:last-child,
      .group-row > *:last-child,
      .skill-row > *:last-child {
        border-right: 0;
      }
      .groups-head .th,
      .skills-head .th {
        gap: 0.3rem;
        color: var(--pw-muted);
        font: inherit;
        font-size: 0.8rem;
        font-weight: 600;
        letter-spacing: 0.01em;
        text-align: left;
        cursor: pointer;
      }
      .groups-head .th:hover,
      .groups-head .th.active,
      .skills-head .th:hover,
      .skills-head .th.active {
        color: var(--pw-text);
      }
      .groups-head .th .dir,
      .skills-head .th .dir {
        font-size: 0.65rem;
        min-width: 0.7rem;
      }
      .groups-head .th-actions,
      .skills-head .th-actions,
      .group-row .row-actions,
      .skill-row .row-actions {
        justify-content: flex-end;
      }
      .group-row,
      .skill-row {
        border-bottom: 1px solid var(--table-line);
      }
      .group-row:last-child,
      .skill-row:last-child {
        border-bottom: 0;
      }
      .skill-name {
        flex-wrap: wrap;
        gap: 0.35rem;
      }
      .skill-scale {
        color: var(--pw-muted);
        font-size: 0.85rem;
      }
      .group-row .select-group {
        flex-wrap: wrap;
        gap: 0.35rem;
        width: auto;
        height: auto;
        text-align: left;
        color: inherit;
        font: inherit;
        cursor: pointer;
      }
      .groups-table .icon-btn,
      .skills-table .icon-btn {
        width: 1.7rem;
        height: 1.7rem;
      }
      .groups-table .toggle,
      .skills-table .toggle {
        min-height: 1.7rem;
        padding: 0;
      }
      .group-row.selected {
        background: color-mix(in srgb, var(--pw-accent) 12%, var(--pw-surface));
      }
      .group-row.selected .select-group {
        color: var(--pw-text);
        font-weight: 600;
      }
      .group-row.pinned .select-group {
        font-weight: 600;
      }
      .group-row:hover:not(.selected),
      .skill-row:hover {
        background: color-mix(in srgb, var(--pw-muted) 8%, var(--pw-surface));
      }
      @media (max-width: 860px) {
        .skills-split {
          grid-template-columns: 1fr;
        }
        .groups-col {
          padding-right: 0;
          padding-bottom: 1rem;
          border-right: 0;
          border-bottom: 1px solid var(--pw-border);
        }
        .skills-list-col {
          padding-left: 0;
          padding-top: 1rem;
        }
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
      .ghost-neutral {
        background: transparent;
        color: var(--pw-text);
        border: 1px solid var(--pw-border-strong);
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
        border-bottom: 1px solid var(--pw-border);
      }
      .position-row {
        align-items: flex-start;
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
      .code {
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        font-size: 0.8rem;
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
    `,
  ],
})
export class OrganizationCatalogColumnComponent {
  readonly vm = inject(PositionManagementFacade);
}
