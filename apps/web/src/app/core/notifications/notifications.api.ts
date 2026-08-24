import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AppNotification,
  PaginatedNotifications,
} from './notification.models';
import {
  mapRawNotification,
  type RawNotification,
} from './notification-mapper';

@Injectable({ providedIn: 'root' })
export class NotificationsApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/notifications`;

  getNotifications(filters?: {
    page?: number;
    pageSize?: number;
    unreadOnly?: boolean;
  }): Observable<PaginatedNotifications> {
    let params = new HttpParams();
    if (filters?.page) params = params.set('page', String(filters.page));
    if (filters?.pageSize)
      params = params.set('pageSize', String(filters.pageSize));
    if (filters?.unreadOnly) params = params.set('unreadOnly', '1');
    return this.http
      .get<RawNotification[] | { items: RawNotification[]; page?: number; pageSize?: number; total?: number }>(
        this.base,
        { params },
      )
      .pipe(
        map((res) => {
          if (Array.isArray(res)) {
            const items = res.map(mapRawNotification);
            return {
              items,
              page: 1,
              pageSize: items.length,
              total: items.length,
            };
          }
          const items = (res.items ?? []).map(mapRawNotification);
          return {
            items,
            page: res.page ?? 1,
            pageSize: res.pageSize ?? items.length,
            total: res.total ?? items.length,
          };
        }),
      );
  }

  getUnreadCount(): Observable<{ count: number }> {
    return this.http.get<{ count: number }>(`${this.base}/unread-count`);
  }

  markRead(id: string) {
    return this.http.post(`${this.base}/${id}/read`, {});
  }

  markAllRead() {
    return this.http.post(`${this.base}/read-all`, {});
  }

  /** Soft-hide from inbox; row stays in DB. */
  dismiss(id: string) {
    return this.http.post(`${this.base}/${id}/dismiss`, {});
  }
}
