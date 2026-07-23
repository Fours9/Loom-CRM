import { Component, Input } from '@angular/core';
import { requestStatusLabel } from '../core/api/request-view.util';

/**
 * Shared status badge for absence requests.
 * Presentation styling lives in global `.pw-request-badge` (styles.scss).
 */
@Component({
  selector: 'app-request-status-badge',
  standalone: true,
  template: `
    <span class="pw-request-badge" [attr.data-status]="status">{{ label }}</span>
  `,
})
export class RequestStatusBadgeComponent {
  @Input({ required: true }) status!: string;

  get label(): string {
    return requestStatusLabel(this.status);
  }
}
