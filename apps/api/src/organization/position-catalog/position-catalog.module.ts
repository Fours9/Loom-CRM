import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Employee } from '../employees/employee.entity';
import { EmploymentAssignment } from '../employees/employment-assignment.entity';
import { Position } from '../positions/position.entity';
import { Department } from '../departments/department.entity';
import { Direction } from '../companies/direction.entity';
import { PositionSkillRequirement } from '../position-requirements/position-skill-requirement.entity';
import { PositionDuty } from '../position-requirements/position-duty.entity';
import { PositionGoalTemplate } from '../position-requirements/position-goal-template.entity';
import { PositionCatalogFacade } from './position-catalog.facade';
import { PositionCatalogReadService } from './position-catalog-read.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Employee,
      EmploymentAssignment,
      Position,
      Department,
      Direction,
      PositionSkillRequirement,
      PositionDuty,
      PositionGoalTemplate,
    ]),
  ],
  providers: [PositionCatalogReadService, PositionCatalogFacade],
  exports: [PositionCatalogFacade],
})
export class PositionCatalogModule {}
