import { DataSourceOptions } from 'typeorm';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { getApplicationConfig } from '../config/application-config';
import { ApplicationSetting } from '../settings/application-setting.entity';
import { BootstrapState } from '../bootstrap/bootstrap-state.entity';
import { User } from '../identity/user.entity';
import { AuditLog } from '../audit/audit-log.entity';
import { Notification } from '../notifications/notification.entity';
import { Department } from '../../organization/departments/department.entity';
import { Position } from '../../organization/positions/position.entity';
import { Employee } from '../../organization/employees/employee.entity';
import { WorkScheduleDay } from '../../organization/employees/work-schedule-day.entity';
import { EmployeeManagedDepartment } from '../../organization/employees/employee-managed-department.entity';
import { InitialPlatformBaseline1730000000000 } from './migrations/1730000000000-InitialPlatformBaseline';
import { IdentityAndPlatform1730000001000 } from './migrations/1730000001000-IdentityAndPlatform';
import { OrganizationCore1730000002000 } from './migrations/1730000002000-OrganizationCore';
import { AbsencesModule1730000003000 } from './migrations/1730000003000-AbsencesModule';
import { AbsencesPwParity1730000004000 } from './migrations/1730000004000-AbsencesPwParity';

export function getDataSourceOptions(): DataSourceOptions {
  const config = getApplicationConfig();
  return {
    type: 'postgres',
    url: config.databaseUrl,
    // Runtime entities load via autoLoadEntities; Absences must not be imported here
    // (Platform cannot depend on Absences). Migrations still register Absences schema.
    entities: [
      ApplicationSetting,
      BootstrapState,
      User,
      AuditLog,
      Notification,
      Department,
      Position,
      Employee,
      WorkScheduleDay,
      EmployeeManagedDepartment,
    ],
    migrations: [
      InitialPlatformBaseline1730000000000,
      IdentityAndPlatform1730000001000,
      OrganizationCore1730000002000,
      AbsencesModule1730000003000,
      AbsencesPwParity1730000004000,
    ],
    synchronize: false,
    logging: config.nodeEnv === 'development' ? ['error', 'warn'] : ['error'],
  };
}

export function getTypeOrmModuleOptions(): TypeOrmModuleOptions {
  return {
    ...getDataSourceOptions(),
    autoLoadEntities: true,
  };
}
