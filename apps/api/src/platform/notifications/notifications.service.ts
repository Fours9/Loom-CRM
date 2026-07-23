import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Notification } from './notification.entity';

export type CreateNotificationInput = {
  recipientId: string;
  type: string;
  title: string;
  body: string;
  payload?: Record<string, unknown> | null;
};

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notifications: Repository<Notification>,
  ) {}

  async create(
    input: CreateNotificationInput,
    manager?: EntityManager,
  ): Promise<Notification> {
    const repo = manager
      ? manager.getRepository(Notification)
      : this.notifications;
    const row = repo.create({
      recipientUserId: input.recipientId,
      type: input.type,
      title: input.title,
      body: input.body,
      payload: input.payload ?? null,
      isRead: false,
    });
    return repo.save(row);
  }

  listForUser(userId: string): Promise<Notification[]> {
    return this.notifications.find({
      where: { recipientUserId: userId },
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  async unreadCount(userId: string): Promise<number> {
    return this.notifications.count({
      where: { recipientUserId: userId, isRead: false },
    });
  }

  async markRead(userId: string, id: string): Promise<void> {
    await this.notifications.update(
      { id, recipientUserId: userId },
      { isRead: true },
    );
  }

  async markAllRead(userId: string): Promise<void> {
    await this.notifications.update(
      { recipientUserId: userId, isRead: false },
      { isRead: true },
    );
  }
}
