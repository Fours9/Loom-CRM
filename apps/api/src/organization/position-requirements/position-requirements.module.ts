import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PositionsModule } from '../positions/positions.module';
import { SkillsModule } from '../skills/skills.module';
import { PositionSkillRequirement } from './position-skill-requirement.entity';
import { PositionDuty } from './position-duty.entity';
import { PositionGoalTemplate } from './position-goal-template.entity';
import { PositionRequirementsService } from './position-requirements.service';
import { PositionRequirementsController } from './position-requirements.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PositionSkillRequirement,
      PositionDuty,
      PositionGoalTemplate,
    ]),
    PositionsModule,
    SkillsModule,
  ],
  providers: [PositionRequirementsService],
  controllers: [PositionRequirementsController],
  exports: [PositionRequirementsService],
})
export class PositionRequirementsModule {}
