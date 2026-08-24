import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { EmploymentAssignmentLifecycleService } from '../organization/employees/employment-assignment-lifecycle.service';

const DEFAULT_INTERVAL_MS = 60_000;

@Injectable()
export class EmploymentLifecycleIntervalAdapter
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(EmploymentLifecycleIntervalAdapter.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly employmentLifecycle: EmploymentAssignmentLifecycleService,
  ) {}

  onApplicationBootstrap(): void {
    if (this.timer) {
      return;
    }
    this.timer = setInterval(() => {
      void this.employmentLifecycle.activateDueAssignments().catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`Employment lifecycle tick failed: ${message}`);
      });
    }, DEFAULT_INTERVAL_MS);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
