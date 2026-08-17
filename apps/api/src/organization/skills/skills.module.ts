import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SkillGroup } from './skill-group.entity';
import { Skill } from './skill.entity';
import { PositionSkillRequirement } from '../position-requirements/position-skill-requirement.entity';
import { SkillsService } from './skills.service';
import { SkillsController } from './skills.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([SkillGroup, Skill, PositionSkillRequirement]),
  ],
  providers: [SkillsService],
  controllers: [SkillsController],
  exports: [SkillsService],
})
export class SkillsModule {}
