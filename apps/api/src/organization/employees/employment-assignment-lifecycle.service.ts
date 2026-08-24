import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { EmploymentAssignment } from './employment-assignment.entity';
import { Employee } from './employee.entity';
import { BusinessDateClock, type DateOnly } from './business-date-clock';
import { EmployeeProfileService } from './employee-profile.service';

@Injectable()
export class EmploymentAssignmentLifecycleService {
  private readonly logger = new Logger(
    EmploymentAssignmentLifecycleService.name,
  );

  constructor(
    @InjectRepository(EmploymentAssignment)
    private readonly assignments: Repository<EmploymentAssignment>,
    private readonly dataSource: DataSource,
    private readonly clock: BusinessDateClock,
    private readonly profile: EmployeeProfileService,
  ) {}

  async activateDueAssignments(today: DateOnly = this.clock.today()): Promise<{
    discovered: number;
    activated: number;
  }> {
    const due = await this.assignments
      .createQueryBuilder('assignment')
      .select(['assignment.id AS id', 'assignment.employee_id AS employeeId'])
      .where('assignment.status = :status', { status: 'planned' })
      .andWhere('assignment.start_date IS NOT NULL')
      .andWhere('assignment.start_date <= :today', { today })
      .orderBy('assignment.start_date', 'ASC')
      .getRawMany<{ id: string; employeeId: string }>();

    let activated = 0;
    for (const candidate of due) {
      const didActivate = await this.dataSource.transaction(async (manager) => {
        const employee = await manager.getRepository(Employee).findOne({
          where: { id: candidate.employeeId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!employee) {
          return false;
        }
        const planned = await manager.getRepository(EmploymentAssignment).findOne({
          where: { id: candidate.id, employeeId: candidate.employeeId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!planned || planned.status !== 'planned') {
          return false;
        }
        if (!planned.startDate || planned.startDate > today) {
          return false;
        }
        return this.profile.activatePlannedAssignment(
          manager,
          employee,
          planned,
          null,
        );
      });
      if (didActivate) {
        activated += 1;
      }
    }

    this.logger.log(
      `Employment lifecycle checked ${due.length} due planned assignment(s), activated ${activated}`,
    );
    return { discovered: due.length, activated };
  }
}
