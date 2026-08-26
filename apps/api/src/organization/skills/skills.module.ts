import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SkillGroup } from './skill-group.entity';
import { Skill } from './skill.entity';
import { EmployeeSkillAssessment } from './employee-skill-assessment.entity';
import { PositionSkillRequirement } from '../position-requirements/position-skill-requirement.entity';
import { SkillsService } from './skills.service';
import { SkillsController } from './skills.controller';
import { EmployeeSkillAssessmentsFacade } from './employee-skill-assessments.facade';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SkillGroup,
      Skill,
      EmployeeSkillAssessment,
      PositionSkillRequirement,
    ]),
  ],
  providers: [SkillsService, EmployeeSkillAssessmentsFacade],
  controllers: [SkillsController],
  exports: [SkillsService, EmployeeSkillAssessmentsFacade],
})
export class SkillsModule {}
