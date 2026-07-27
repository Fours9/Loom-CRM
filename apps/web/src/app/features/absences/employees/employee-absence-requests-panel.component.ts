import { Component, Input, OnChanges, SimpleChanges, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api/api.service';
import { AbsenceRequestListItem } from '../core/api/models';
import {
  requestEventLabel,
  requestPeriod,
  requestTypeLabel,
} from '../core/api/request-view.util';
import { RequestStatusBadgeComponent } from '../shared/request-status-badge.component';
import { requestFrameTone } from '../shared/request-status-presentation';

@Component({
  selector: 'app-employee-absence-requests-panel',
  standalone: true,
  imports: [RouterLink, RequestStatusBadgeComponent],
  template: `
    <div class="panel">
      <div class="card-head req-actions">
        <a class="new-link" routerLink="/absences/requests/new">Нова</a>
      </div>

      @if (loading) {
        <p class="muted">Завантаження заявок…</p>
      } @else if (error) {
        <p class="error">{{ error }}</p>
      } @else if (requests.length === 0) {
        <p class="muted">Заявок ще немає</p>
      } @else {
        <div class="req-scroll">
          <ul class="req-list">
            @for (r of requests; track r.id) {
              <li
                [routerLink]="['/absences/requests', r.id]"
                class="req-row pw-request-frame"
                [attr.data-frame]="frameTone(r.statusGroup)"
              >
                <div class="req-main">
                  <strong class="req-type">{{ requestTypeLabel(r.type) }}</strong>
                  <span class="muted req-event">{{ requestEventLabel(r) }}</span>
                </div>
                <div class="req-meta">
                  <span class="req-period">{{ requestPeriod(r) }}</span>
                  <app-request-status-badge [status]="r.statusGroup" />
                </div>
              </li>
            }
          </ul>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .panel {
        display: grid;
        gap: 0.6rem;
      }
      .card-head {
        display: flex;
        justify-content: flex-end;
        gap: 0.75rem;
        align-items: center;
      }
      .new-link {
        color: var(--pw-accent);
        text-decoration: none;
        font-weight: 600;
        font-size: 0.9rem;
      }
      .req-scroll {
        min-height: 0;
        overflow-x: hidden;
        overflow-y: auto;
      }
      .req-list {
        list-style: none;
        padding: 0;
        margin: 0;
        display: grid;
        gap: 0.55rem;
      }
      .req-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 1rem;
        padding: 0.55rem 0.65rem;
        cursor: pointer;
        min-width: 0;
      }
      .req-row:hover .req-type {
        color: var(--pw-accent);
      }
      .req-main {
        display: grid;
        gap: 0.15rem;
        min-width: 0;
        flex: 1 1 auto;
        overflow: hidden;
      }
      .req-type {
        min-width: 0;
        color: var(--pw-text);
        font-weight: 700;
        overflow-wrap: anywhere;
      }
      .req-event {
        font-size: 0.82rem;
        line-height: 1.25;
        overflow-wrap: anywhere;
      }
      .req-meta {
        display: grid;
        justify-items: end;
        gap: 0.25rem;
        text-align: right;
        flex: 0 0 auto;
      }
      .req-period {
        color: var(--pw-text);
        font-size: 0.95rem;
        white-space: nowrap;
      }
      .muted {
        color: var(--pw-muted);
        margin: 0;
      }
      .error {
        color: var(--pw-danger);
        margin: 0;
      }
      @media (max-width: 640px) {
        .req-row {
          flex-direction: column;
          align-items: stretch;
          gap: 0.55rem;
        }
        .req-meta {
          width: 100%;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          justify-items: initial;
          gap: 0.5rem;
          text-align: left;
        }
        .req-period {
          white-space: normal;
        }
      }
    `,
  ],
})
export class EmployeeAbsenceRequestsPanelComponent implements OnChanges {
  private readonly api = inject(ApiService);

  @Input({ required: true }) employeeId!: string;

  readonly requestTypeLabel = requestTypeLabel;
  readonly requestEventLabel = requestEventLabel;
  readonly requestPeriod = requestPeriod;
  readonly frameTone = requestFrameTone;

  requests: AbsenceRequestListItem[] = [];
  loading = false;
  error = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['employeeId'] && this.employeeId) {
      this.load();
    }
  }

  private load(): void {
    this.loading = true;
    this.error = '';
    this.api.getEmployeeRequests(this.employeeId).subscribe({
      next: ({ items }) => {
        this.requests = items.slice(0, 8);
        this.loading = false;
      },
      error: () => {
        this.requests = [];
        this.error = 'Не вдалося завантажити заявки';
        this.loading = false;
      },
    });
  }
}
