import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ApplicationBootstrapService } from '../bootstrap/application-bootstrap.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly dataSource: DataSource,
    private readonly bootstrap: ApplicationBootstrapService,
  ) {}

  @Get('live')
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Get('ready')
  async ready(): Promise<{
    status: 'ok';
    checks: Record<string, boolean>;
  }> {
    const checks: Record<string, boolean> = {
      postgres: false,
      migrationsApplied: false,
      bootstrapCompleted: false,
    };

    try {
      await this.dataSource.query('SELECT 1');
      checks.postgres = true;
    } catch {
      checks.postgres = false;
    }

    try {
      const rows: Array<{ count: string }> = await this.dataSource.query(
        `SELECT COUNT(*)::text AS count FROM "migrations"`,
      );
      checks.migrationsApplied = Number(rows[0]?.count ?? 0) > 0;
    } catch {
      checks.migrationsApplied = false;
    }

    checks.bootstrapCompleted = this.bootstrap.isReady();

    // D2+: optional mandatory settings gate
    try {
      const rows: Array<{ value: string }> = await this.dataSource.query(
        `SELECT value FROM application_settings WHERE key = $1`,
        ['platform.initialized'],
      );
      checks.mandatorySettings = rows.length > 0;
    } catch {
      checks.mandatorySettings = false;
    }

    const allOk = Object.values(checks).every(Boolean);
    if (!allOk) {
      throw new ServiceUnavailableException({
        status: 'not_ready',
        checks,
      });
    }

    return { status: 'ok', checks };
  }
}
