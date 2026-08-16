import { Module } from '@nestjs/common';
import { DepartmentsModule } from './departments/departments.module';
import { DirectionsModule } from './directions/directions.module';
import { PositionsModule } from './positions/positions.module';
import { EmployeesModule } from './employees/employees.module';
import { SkillsModule } from './skills/skills.module';
import { PositionRequirementsModule } from './position-requirements/position-requirements.module';
import { PositionCatalogModule } from './position-catalog/position-catalog.module';

@Module({
  imports: [
    DepartmentsModule,
    DirectionsModule,
    PositionsModule,
    SkillsModule,
    PositionRequirementsModule,
    PositionCatalogModule,
    EmployeesModule,
  ],
  exports: [
    DepartmentsModule,
    DirectionsModule,
    PositionsModule,
    SkillsModule,
    PositionRequirementsModule,
    PositionCatalogModule,
    EmployeesModule,
  ],
})
export class OrganizationModule {}
