import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BootstrapState } from './bootstrap-state.entity';
import { ApplicationBootstrapService } from './application-bootstrap.service';

@Module({
  imports: [TypeOrmModule.forFeature([BootstrapState])],
  providers: [ApplicationBootstrapService],
  exports: [ApplicationBootstrapService],
})
export class ApplicationBootstrapModule {}
