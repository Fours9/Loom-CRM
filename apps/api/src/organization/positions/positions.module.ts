import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Position } from './position.entity';
import { PositionManagedDepartment } from './position-managed-department.entity';
import { PositionsService } from './positions.service';
import { PositionsController } from './positions.controller';
import { DepartmentsModule } from '../departments/departments.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Position, PositionManagedDepartment]),
    DepartmentsModule,
  ],
  providers: [PositionsService],
  controllers: [PositionsController],
  exports: [PositionsService],
})
export class PositionsModule {}
