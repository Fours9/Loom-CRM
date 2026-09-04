import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../identity/users.service';
import { UserRole } from '../identity/user.enums';
import { ApplicationSettingsService } from '../settings/application-settings.service';
import { resolveSystemAccountRoleId } from '../access-control/resolve-system-account-role-id';
import { SystemAccountRoleCode } from '../access-control/system-account-role-codes';

@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    private readonly users: UsersService,
    private readonly settings: ApplicationSettingsService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureAdmin();
    await this.ensureDefaults();
  }

  private async ensureAdmin(): Promise<void> {
    const total = await this.users.count();
    if (total > 0) {
      return;
    }
    const email = (
      process.env.SEED_ADMIN_EMAIL || 'admin@loom.local'
    ).toLowerCase();
    const password = process.env.SEED_ADMIN_PASSWORD || 'Admin123!';
    const passwordHash = await bcrypt.hash(password, 12);
    const accountRoleId = await resolveSystemAccountRoleId(
      this.dataSource.manager,
      SystemAccountRoleCode.Admin,
    );
    await this.users.createUser({
      email,
      passwordHash,
      role: UserRole.Admin,
      accountRoleId,
      mustChangePassword: false,
    });
    this.logger.log(`Seeded admin user ${email}`);
  }

  private async ensureDefaults(): Promise<void> {
    const existing = await this.settings.get('platform.initialized');
    if (!existing) {
      await this.settings.set('platform.initialized', 'true');
    }
  }
}
