import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Employee } from './employee.entity';
import { WorkScheduleDay } from './work-schedule-day.entity';
import { User } from '../../platform/identity/user.entity';
import { EmployeeAccessService } from '../access/employee-access.service';
import { AuditService } from '../../platform/audit/audit.service';
import { PdfRenderer } from '../../platform/pdf/pdf-renderer';
import {
  EmployeeProfilePrintModel,
  PROFILE_PDF_TEMPLATE_VERSION,
} from './employee-profile-print.model';
import { EmployeeSerializer } from './employee.serializer';
import {
  buildEmployeePdfFilenames,
  formatKyivDateTime,
} from './employee-pdf-filename';

const WEEKDAY_LABELS: Record<number, string> = {
  1: 'Понеділок',
  2: 'Вівторок',
  3: 'Середа',
  4: 'Четвер',
  5: "П'ятниця",
  6: 'Субота',
  7: 'Неділя',
};

@Injectable()
export class EmployeeProfileExportService {
  constructor(
    @InjectRepository(Employee)
    private readonly employeesRepo: Repository<Employee>,
    @InjectRepository(WorkScheduleDay)
    private readonly scheduleRepo: Repository<WorkScheduleDay>,
    private readonly access: EmployeeAccessService,
    private readonly audit: AuditService,
    private readonly pdfRenderer: PdfRenderer,
    private readonly serializer: EmployeeSerializer,
  ) {}

  async exportPdf(
    actor: User,
    employeeId: string,
  ): Promise<{ buffer: Buffer; asciiFilename: string; utf8Filename: string }> {
    const employee = await this.employeesRepo.findOne({
      where: { id: employeeId },
      relations: ['department', 'position'],
    });
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }
    if (!(await this.access.canExportProfilePdf(actor, employee))) {
      throw new NotFoundException('Employee not found');
    }

    const model = await this.buildPrintModel(actor, employee);
    const buffer = await this.pdfRenderer.renderEmployeeProfile(model);
    const names = buildEmployeePdfFilenames(employee);

    await this.audit.record({
      actorId: actor.id,
      action: 'employee.export_pdf',
      entityType: 'Employee',
      entityId: employee.id,
      metadata: {
        employeeId: employee.id,
        filename: names.utf8Filename,
        templateVersion: PROFILE_PDF_TEMPLATE_VERSION,
      },
    });

    return { buffer, ...names };
  }

  private async buildPrintModel(
    actor: User,
    employee: Employee,
  ): Promise<EmployeeProfilePrintModel> {
    const days = await this.scheduleRepo.find({
      where: { employeeId: employee.id },
      order: { weekday: 'ASC' },
    });

    const schedule =
      days.length === 0
        ? null
        : days.map((day) => ({
            weekday: day.weekday,
            weekdayLabel: WEEKDAY_LABELS[day.weekday] ?? `День ${day.weekday}`,
            isWorkingDay: Boolean(day.isWorkingDay),
            workTime: day.isWorkingDay
              ? [day.startTime, day.endTime].filter(Boolean).join('–') || null
              : null,
            breakTime:
              day.isWorkingDay && day.breakStart && day.breakEnd
                ? `${day.breakStart}–${day.breakEnd}`
                : null,
          }));

    return {
      employeeNumber: employee.employeeNumber,
      lastName: employee.lastName,
      firstName: employee.firstName,
      middleName: employee.middleName,
      fullName: this.serializer.fullName(employee),
      departmentName: employee.department?.name ?? null,
      positionName: employee.position?.name ?? null,
      phoneNumber: employee.phoneNumber,
      telegram: employee.telegram,
      email: employee.workEmail,
      schedule,
      comment: employee.comment,
      generatedAtLabel: formatKyivDateTime(new Date()),
      generatedByLabel: actor.email,
      templateVersion: PROFILE_PDF_TEMPLATE_VERSION,
    };
  }
}
