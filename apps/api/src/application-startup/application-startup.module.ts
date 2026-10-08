import { Module } from '@nestjs/common';
import { ApplicationBootstrapModule } from '../platform/bootstrap/application-bootstrap.module';
import { QuestionnairesModule } from '../modules/questionnaires/questionnaires.module';
import { AbsencesModule } from '../modules/absences/absences.module';
import { ApplicationStartupService } from './application-startup.service';
import { EmployeesModule } from '../organization/employees/employees.module';
import { EmploymentLifecycleIntervalAdapter } from './employment-lifecycle-interval.adapter';

@Module({
  imports: [
    ApplicationBootstrapModule,
    QuestionnairesModule,
    AbsencesModule,
    EmployeesModule,
  ],
  providers: [ApplicationStartupService, EmploymentLifecycleIntervalAdapter],
})
export class ApplicationStartupModule {}
