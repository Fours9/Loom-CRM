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
        border: 1px solid color-mix(in srgb, var(--pw-accent) 12%, var(--pw-border));
        border-radius: 16px;
        background: color-mix(in srgb, var(--pw-surface) 94%, transparent);
        padding: 1rem 1.1rem;
        box-shadow: 0 2px 10px var(--pw-shadow);
        transition:
          border-color 0.18s ease,
          box-shadow 0.18s ease,
          transform 0.18s ease,
          background 0.18s ease;
        animation: pw-rise 0.5s ease both;
      }
      .employee-card:nth-child(1) { animation-delay: 40ms; }
      .employee-card:nth-child(2) { animation-delay: 80ms; }
      .employee-card:nth-child(3) { animation-delay: 120ms; }
      .employee-card:nth-child(4) { animation-delay: 160ms; }
      .employee-card:nth-child(5) { animation-delay: 200ms; }
      .employee-card:nth-child(6) { animation-delay: 240ms; }
      .employee-card:nth-child(n + 7) { animation-delay: 280ms; }
      .employee-card:hover {
        border-color: var(--pw-accent);
        box-shadow: 0 10px 28px var(--pw-shadow);
        transform: translateY(-2px);
        background: var(--pw-surface);
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
        font-size: 1.02rem;
      }
      .card-meta {
        color: var(--pw-muted);
        font-size: 0.88rem;
        overflow-wrap: anywhere;
      }
      .table-wrap {
        display: none;
        position: relative;
        z-index: 0;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        background: var(--pw-surface);
      }
      th,
      td {
        text-align: left;
        padding: 0.85rem 0.8rem;
        border-bottom: 1px solid var(--pw-border);
      }
      thead th {
        background: color-mix(in srgb, var(--pw-surface-2) 88%, var(--pw-accent-soft));
        font-size: 0.78rem;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--pw-muted);
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
        font-weight: 700;
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
        transition: background 0.14s ease;
      }
      .row-link:hover {
        background: color-mix(in srgb, var(--pw-accent-soft) 70%, transparent);
      }
      .row-name {
        color: inherit;
        text-decoration: none;
        font-weight: 700;
      }
      .row-name:hover {
        color: var(--pw-accent);
        text-decoration: underline;
      }
      .empty {
        padding: 1.15rem 1rem;
        color: var(--pw-muted);
        border: 1px dashed color-mix(in srgb, var(--pw-border) 90%, var(--pw-accent));
        border-radius: 14px;
        background:
          repeating-linear-gradient(
            -45deg,
            color-mix(in srgb, var(--pw-border) 35%, transparent) 0 8px,
            transparent 8px 16px
          ),
          var(--pw-surface-2);
      }
      @media (min-width: 641px) {
        .card-list {
          display: none;
        }
        .table-wrap {
          display: block;
          border: 1px solid color-mix(in srgb, var(--pw-accent) 12%, var(--pw-border));
          border-radius: 16px;
          overflow: hidden;
          background: color-mix(in srgb, var(--pw-surface) 94%, transparent);
          box-shadow: 0 8px 28px var(--pw-shadow);
          animation: pw-rise 0.55s ease both;
          animation-delay: 120ms;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .employee-card,
        .table-wrap,
        .row-link {
          animation: none !important;
          transition: none !important;
        }
        .employee-card:hover {
          transform: none;
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
