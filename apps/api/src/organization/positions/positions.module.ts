import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Position } from './position.entity';
import { PositionManagedDepartment } from './position-managed-department.entity';
import { PositionManagedDirection } from './position-managed-direction.entity';
import { PositionsService } from './positions.service';
import { PositionsController } from './positions.controller';
import { DepartmentsModule } from '../departments/departments.module';
import { EmploymentCatalogModule } from '../employment-catalog/employment-catalog.module';
import { Employee } from '../employees/employee.entity';
import { Department } from '../departments/department.entity';
import { EmploymentAssignmentManagedDirection } from '../employees/employment-assignment-managed-direction.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Position,
      PositionManagedDepartment,
      PositionManagedDirection,
      EmploymentAssignmentManagedDirection,
      Employee,
      Department,
    ]),
    DepartmentsModule,
    EmploymentCatalogModule,
  ],
  providers: [PositionsService],
  controllers: [PositionsController],
  exports: [PositionsService],
})
export class PositionsModule {}
