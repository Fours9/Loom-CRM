import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BootstrapState } from './bootstrap-state.entity';

export const BOOTSTRAP_ROW_ID = 'default';

@Injectable()
export class ApplicationBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(ApplicationBootstrapService.name);
  private ready = false;

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(BootstrapState)
    private readonly bootstrapRepo: Repository<BootstrapState>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.run();
  }

  isReady(): boolean {
    return this.ready;
  }

  async run(): Promise<void> {
    // Migrations are applied by a separate job / `pnpm migration:run`.
    // Startup only verifies connectivity and records bootstrap completion.
    await this.dataSource.query('SELECT 1');

    let row = await this.bootstrapRepo.findOne({
      where: { id: BOOTSTRAP_ROW_ID },
    });
    if (!row) {
      row = this.bootstrapRepo.create({
        id: BOOTSTRAP_ROW_ID,
        bootstrapCompleted: false,
        completedAt: null,
      });
    }

    // D1: no mandatory settings yet — mark bootstrap complete after DB OK.
    row.bootstrapCompleted = true;
    row.completedAt = new Date();
    await this.bootstrapRepo.save(row);

    this.ready = true;
    this.logger.log('Application bootstrap completed');
  }
}
