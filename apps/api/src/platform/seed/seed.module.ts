import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { ApplicationSettingsModule } from '../settings/application-settings.module';
import { SeedService } from './seed.service';

@Module({
  imports: [IdentityModule, ApplicationSettingsModule],
  providers: [SeedService],
})
export class SeedModule {}
