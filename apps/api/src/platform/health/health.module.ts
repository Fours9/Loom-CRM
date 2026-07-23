import { Module } from '@nestjs/common';
import { ApplicationBootstrapModule } from '../bootstrap/application-bootstrap.module';
import { HealthController } from './health.controller';

@Module({
  imports: [ApplicationBootstrapModule],
  controllers: [HealthController],
})
export class HealthModule {}
