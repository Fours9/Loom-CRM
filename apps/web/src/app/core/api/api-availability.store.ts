import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export type ApiAvailabilityStatus = 'unknown' | 'ok' | 'unreachable';

/**
 * Tracks whether the Nest API is reachable from the browser.
 * Network / proxy failure → full-screen lock (not silent empty shell).
 */
@Injectable({ providedIn: 'root' })
export class ApiAvailabilityStore {
  private readonly http = inject(HttpClient);

  readonly status = signal<ApiAvailabilityStatus>('unknown');

  markOk(): void {
    this.status.set('ok');
  }

  markUnreachable(): void {
    this.status.set('unreachable');
  }

  /** GET /health/live. Success → ok via interceptor + return true. */
  async probe(): Promise<boolean> {
    try {
      await firstValueFrom(
        this.http.get<{ status: string }>(
          `${environment.apiBaseUrl}/health/live`,
        ),
      );
      this.markOk();
      return true;
    } catch {
      this.markUnreachable();
      return false;
    }
  }
}
