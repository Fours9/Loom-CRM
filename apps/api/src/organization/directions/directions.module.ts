import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Direction } from '../companies/direction.entity';
import { DirectionsService } from './directions.service';
import { DirectionsController } from './directions.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Direction])],
  providers: [DirectionsService],
  controllers: [DirectionsController],
  exports: [DirectionsService],
})
export class DirectionsModule {}
