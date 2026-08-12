import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DepartmentsModule } from '../departments/departments.module';
import { PositionsModule } from '../positions/positions.module';
import { IdentityModule } from '../../platform/identity/identity.module';
import { AuditModule } from '../../platform/audit/audit.module';
import { AuditLog } from '../../platform/audit/audit-log.entity';
import { EmployeeAccessService } from '../access/employee-access.service';
import { Employee } from './employee.entity';
import { WorkScheduleDay } from './work-schedule-day.entity';
import { EmployeeManagedDepartment } from './employee-managed-department.entity';
import { EmployeeContact } from './employee-contact.entity';
import { EmployeeEmergencyContact } from './employee-emergency-contact.entity';
import { EmployeeImportantDate } from './employee-important-date.entity';
import { EmploymentAssignment } from './employment-assignment.entity';
import { Company } from '../companies/company.entity';
import { Direction } from '../companies/direction.entity';
import { EmployeesService } from './employees.service';
import { EmployeeProfileService } from './employee-profile.service';
import { EmployeesController } from './employees.controller';
import { EmployeeSerializer } from './employee.serializer';
import { EmployeeProfileExportService } from './employee-profile-export.service';
import { EmployeeContactsFacade } from './employee-contacts.facade';
import { PdfRenderer } from '../../platform/pdf/pdf-renderer';
import { OrganizationEmployeeIdentityLookup } from '../identity/organization-employee-identity.lookup';
import { EmployeeIdentityLookup } from '../../platform/auth/auth.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Employee,
      WorkScheduleDay,
      EmployeeManagedDepartment,
      EmployeeContact,
      EmployeeEmergencyContact,
      EmployeeImportantDate,
      EmploymentAssignment,
      Company,
      Direction,
      AuditLog,
    ]),
    DepartmentsModule,
    PositionsModule,
    IdentityModule,
    AuditModule,
  ],
  providers: [
    EmployeesService,
    EmployeeProfileService,
    EmployeeAccessService,
    EmployeeSerializer,
    EmployeeProfileExportService,
    EmployeeContactsFacade,
    PdfRenderer,
    OrganizationEmployeeIdentityLookup,
    {
      provide: EmployeeIdentityLookup,
      useExisting: OrganizationEmployeeIdentityLookup,
    },
  ],
  controllers: [EmployeesController],
  exports: [
    EmployeesService,
    EmployeeProfileService,
    EmployeeAccessService,
    EmployeeIdentityLookup,
    EmployeeContactsFacade,
  ],
})
export class EmployeesModule {}
