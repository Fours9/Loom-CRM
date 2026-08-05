export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  relatedRequestId: string | null;
  relatedAssignmentId: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface PaginatedNotifications {
  items: AppNotification[];
  page: number;
  pageSize: number;
  total: number;
}
