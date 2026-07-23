import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../identity/user.entity';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: User) {
    return this.notifications.listForUser(user.id);
  }

  @Get('unread-count')
  async unreadCount(@CurrentUser() user: User) {
    return { count: await this.notifications.unreadCount(user.id) };
  }

  @Post(':id/read')
  async markRead(@CurrentUser() user: User, @Param('id') id: string) {
    await this.notifications.markRead(user.id, id);
    return { ok: true };
  }

  @Post('read-all')
  async markAll(@CurrentUser() user: User) {
    await this.notifications.markAllRead(user.id);
    return { ok: true };
  }
}
