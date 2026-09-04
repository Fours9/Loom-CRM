import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Position } from './position.entity';
import { PositionManagedDepartment } from './position-managed-department.entity';
import { PositionsService } from './positions.service';
import { PositionsController } from './positions.controller';
import { DepartmentsModule } from '../departments/departments.module';
import { EmploymentCatalogModule } from '../employment-catalog/employment-catalog.module';
import { Employee } from '../employees/employee.entity';
import { Department } from '../departments/department.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Position,
      PositionManagedDepartment,
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
