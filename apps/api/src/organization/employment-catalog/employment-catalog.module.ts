import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmploymentAssignment } from '../employees/employment-assignment.entity';
import { EmploymentType } from './employment-type.entity';
import { WorkFormat } from './work-format.entity';
import { EmploymentCatalogService } from './employment-catalog.service';
import { EmploymentCatalogController } from './employment-catalog.controller';
import { CurrentEmploymentAssignmentResolver } from './current-employment-assignment.resolver';

@Module({
  imports: [
    TypeOrmModule.forFeature([WorkFormat, EmploymentType, EmploymentAssignment]),
  ],
  providers: [EmploymentCatalogService, CurrentEmploymentAssignmentResolver],
  controllers: [EmploymentCatalogController],
  exports: [EmploymentCatalogService, CurrentEmploymentAssignmentResolver],
})
export class EmploymentCatalogModule {}
