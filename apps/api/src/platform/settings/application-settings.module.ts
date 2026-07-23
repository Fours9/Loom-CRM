import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApplicationSetting } from './application-setting.entity';
import { ApplicationSettingsService } from './application-settings.service';

@Module({
  imports: [TypeOrmModule.forFeature([ApplicationSetting])],
  providers: [ApplicationSettingsService],
  exports: [ApplicationSettingsService],
})
export class ApplicationSettingsModule {}
