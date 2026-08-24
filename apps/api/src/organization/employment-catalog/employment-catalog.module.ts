import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmploymentType } from './employment-type.entity';
import { WorkFormat } from './work-format.entity';
import { EmploymentCatalogService } from './employment-catalog.service';
import { EmploymentCatalogController } from './employment-catalog.controller';

@Module({
  imports: [TypeOrmModule.forFeature([WorkFormat, EmploymentType])],
  providers: [EmploymentCatalogService],
  controllers: [EmploymentCatalogController],
  exports: [EmploymentCatalogService],
})
export class EmploymentCatalogModule {}
