import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import type { EmployeeDirectoryItemVm } from './employee-directory-item.vm';
import {
  directorySortIndicator,
  type EmployeeDirectorySortDir,
  type EmployeeDirectorySortKey,
} from './employee-directory-sort';

@Component({
  selector: 'loom-employee-directory-table',
  standalone: true,
  imports: [RouterLink],
  template: `
    <ul class="card-list" aria-label="Працівники">
      @for (e of items; track e.id) {
        <li class="employee-card">
          <a class="card-link" [routerLink]="e.detailLink">
            <span class="card-body">
              <strong class="card-title">{{ e.fullName }}</strong>
              <span class="card-meta">{{ e.employeeNumber }} · {{ e.statusLabel }}</span>
              <span class="card-meta"
                >{{ e.directionName || '—' }} · {{ e.departmentName || '—' }} ·
                {{ e.positionName || '—' }}</span
              >
              <span class="card-meta">{{ e.roleLabel }}</span>
            </span>
          </a>
        </li>
      }
    </ul>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>
              <button type="button" class="sort-btn" (click)="toggle('fullName')">
                ПІБ
                <span class="sort-ind" [class.active]="sortBy === 'fullName'">{{
                  indicator('fullName')
                }}</span>
              </button>
            </th>
            <th>
              <button
                type="button"
                class="sort-btn"
                (click)="toggle('employeeNumber')"
              >
                Номер
                <span
                  class="sort-ind"
                  [class.active]="sortBy === 'employeeNumber'"
                  >{{ indicator('employeeNumber') }}</span
                >
              </button>
            </th>
            <th>
              <button type="button" class="sort-btn" (click)="toggle('direction')">
                Напрямок
                <span class="sort-ind" [class.active]="sortBy === 'direction'">{{
                  indicator('direction')
                }}</span>
              </button>
            </th>
            <th>
              <button
                type="button"
                class="sort-btn"
                (click)="toggle('department')"
              >
                Відділ
                <span class="sort-ind" [class.active]="sortBy === 'department'">{{
                  indicator('department')
                }}</span>
              </button>
            </th>
            <th>
              <button type="button" class="sort-btn" (click)="toggle('position')">
                Посада
                <span class="sort-ind" [class.active]="sortBy === 'position'">{{
                  indicator('position')
                }}</span>
              </button>
            </th>
            <th>
              <button type="button" class="sort-btn" (click)="toggle('role')">
                Роль
                <span class="sort-ind" [class.active]="sortBy === 'role'">{{
                  indicator('role')
                }}</span>
              </button>
            </th>
            <th>
              <button type="button" class="sort-btn" (click)="toggle('status')">
                Статус
                <span class="sort-ind" [class.active]="sortBy === 'status'">{{
                  indicator('status')
                }}</span>
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          @for (e of items; track e.id) {
            <tr
              class="row-link"
              tabindex="0"
              role="link"
              [attr.aria-label]="e.fullName"
              (click)="open(e)"
              (keydown.enter)="open(e)"
              (keydown.space)="$event.preventDefault(); open(e)"
            >
              <td>
                <a class="row-name" [routerLink]="e.detailLink" (click)="$event.stopPropagation()">{{
                  e.fullName
                }}</a>
              </td>
              <td>{{ e.employeeNumber }}</td>
              <td>{{ e.directionName || '—' }}</td>
              <td>{{ e.departmentName || '—' }}</td>
              <td>{{ e.positionName || '—' }}</td>
              <td>{{ e.roleLabel }}</td>
              <td>{{ e.statusLabel }}</td>
            </tr>
          }
        </tbody>
      </table>
    </div>

    @if (!loading && items.length === 0) {
      <p class="empty">Працівників не знайдено</p>
    }
  `,
  styles: [
    `
      .card-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 0.75rem;
      }
      .employee-card {
        border: 1px solid var(--pw-border);
        border-radius: 12px;
        background: var(--pw-surface);
        padding: 0.85rem 1rem;
      }
      .card-link {
        text-decoration: none;
        color: inherit;
        display: block;
      }
      .card-body {
        display: grid;
        gap: 0.25rem;
      }
      .card-title {
        color: var(--pw-text-strong);
      }
      .card-meta {
        color: var(--pw-muted);
        font-size: 0.9rem;
        overflow-wrap: anywhere;
      }
      .table-wrap {
        display: none;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        background: var(--pw-surface);
      }
      th,
      td {
        text-align: left;
        padding: 0.75rem;
        border-bottom: 1px solid var(--pw-border);
      }
      .sort-btn {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        margin: 0;
        padding: 0;
        border: 0;
        background: transparent;
        color: inherit;
        font: inherit;
        font-weight: 600;
        cursor: pointer;
        min-height: auto;
      }
      .sort-btn:hover {
        color: var(--pw-accent);
      }
      .sort-ind {
        min-width: 1rem;
        color: var(--pw-muted);
        font-weight: 500;
      }
      .sort-btn:hover .sort-ind,
      .sort-ind.active {
        color: var(--pw-accent);
      }
      .row-link {
        cursor: pointer;
      }
      .row-link:hover {
        background: var(--pw-surface-2);
      }
      .row-name {
        color: inherit;
        text-decoration: none;
        font-weight: 600;
      }
      .row-name:hover {
        color: var(--pw-accent);
        text-decoration: underline;
      }
      .empty {
        padding: 1rem;
        color: var(--pw-muted);
        border: 1px dashed var(--pw-border);
        border-radius: 12px;
        background: var(--pw-surface-2);
      }
      @media (min-width: 641px) {
        .card-list {
          display: none;
        }
        .table-wrap {
          display: block;
          border: 1px solid var(--pw-border);
          border-radius: 12px;
          overflow: hidden;
          background: var(--pw-surface);
        }
      }
    `,
  ],
})
export class EmployeeDirectoryTableComponent {
  private readonly router = inject(Router);

  @Input() items: EmployeeDirectoryItemVm[] = [];
  @Input() loading = false;
  @Input() sortBy: EmployeeDirectorySortKey = 'fullName';
  @Input() sortDir: EmployeeDirectorySortDir = 'asc';
  @Output() readonly sortToggle = new EventEmitter<EmployeeDirectorySortKey>();

  toggle(key: EmployeeDirectorySortKey): void {
    this.sortToggle.emit(key);
  }

  indicator(column: EmployeeDirectorySortKey): string {
    return directorySortIndicator(this.sortBy, this.sortDir, column);
  }

  open(e: EmployeeDirectoryItemVm): void {
    void this.router.navigate(e.detailLink);
  }
}
