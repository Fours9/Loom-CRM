import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../identity/users.service';
import { UserRole } from '../identity/user.enums';
import { ApplicationSettingsService } from '../settings/application-settings.service';

@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    private readonly users: UsersService,
    private readonly settings: ApplicationSettingsService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureAdmin();
    await this.ensureDefaults();
  }

  private async ensureAdmin(): Promise<void> {
    const email = (
      process.env.SEED_ADMIN_EMAIL || 'admin@loom.local'
    ).toLowerCase();
    const password = process.env.SEED_ADMIN_PASSWORD || 'Admin123!';
    const existing = await this.users.findByEmail(email);
    if (existing) {
      return;
    }
    const passwordHash = await bcrypt.hash(password, 12);
    await this.users.createUser({
      email,
      passwordHash,
      role: UserRole.Admin,
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
