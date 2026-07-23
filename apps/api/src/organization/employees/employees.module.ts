import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DepartmentsModule } from '../departments/departments.module';
import { PositionsModule } from '../positions/positions.module';
import { IdentityModule } from '../../platform/identity/identity.module';
import { AuditModule } from '../../platform/audit/audit.module';
import { EmployeeAccessService } from '../access/employee-access.service';
import { Employee } from './employee.entity';
import { WorkScheduleDay } from './work-schedule-day.entity';
import { EmployeeManagedDepartment } from './employee-managed-department.entity';
import { EmployeesService } from './employees.service';
import { EmployeesController } from './employees.controller';
import { EmployeeSerializer } from './employee.serializer';
import { EmployeeProfileExportService } from './employee-profile-export.service';
import { PdfRenderer } from '../../platform/pdf/pdf-renderer';
import { OrganizationEmployeeIdentityLookup } from '../identity/organization-employee-identity.lookup';
import { EmployeeIdentityLookup } from '../../platform/auth/auth.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Employee,
      WorkScheduleDay,
      EmployeeManagedDepartment,
    ]),
    DepartmentsModule,
    PositionsModule,
    IdentityModule,
    AuditModule,
  ],
  providers: [
    EmployeesService,
    EmployeeAccessService,
    EmployeeSerializer,
    EmployeeProfileExportService,
    PdfRenderer,
    OrganizationEmployeeIdentityLookup,
    {
      provide: EmployeeIdentityLookup,
      useExisting: OrganizationEmployeeIdentityLookup,
    },
  ],
  controllers: [EmployeesController],
  exports: [EmployeesService, EmployeeAccessService, EmployeeIdentityLookup],
})
export class EmployeesModule {}
