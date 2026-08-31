import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApplicationConfigModule } from './platform/config/config.module';
import { getTypeOrmModuleOptions } from './platform/database/typeorm-options';
import { DatabaseModule } from './platform/database/database.module';
import { HealthModule } from './platform/health/health.module';
import { ApplicationBootstrapModule } from './platform/bootstrap/application-bootstrap.module';
import { ApplicationSettingsModule } from './platform/settings/application-settings.module';
import { IdentityModule } from './platform/identity/identity.module';
import { PermissionsModule } from './platform/permissions/permissions.module';
import { AuditModule } from './platform/audit/audit.module';
import { NotificationsModule } from './platform/notifications/notifications.module';
import { AuthModule } from './platform/auth/auth.module';
import { SeedModule } from './platform/seed/seed.module';
import { OrganizationModule } from './organization/organization.module';
import { AbsencesModule } from './modules/absences/absences.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { QuestionnairesModule } from './modules/questionnaires/questionnaires.module';
import { ApplicationStartupModule } from './application-startup/application-startup.module';
import { EmployeeDeletionModule } from './application/employee-deletion/employee-deletion.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    ApplicationConfigModule,
    TypeOrmModule.forRootAsync({
      useFactory: () => getTypeOrmModuleOptions(),
    }),
    DatabaseModule,
    ApplicationSettingsModule,
    IdentityModule,
    PermissionsModule,
    AuditModule,
    NotificationsModule,
    OrganizationModule,
    AuthModule,
    SeedModule,
    AbsencesModule,
    DocumentsModule,
    QuestionnairesModule,
    EmployeeDeletionModule,
    ApplicationBootstrapModule,
    ApplicationStartupModule,
    HealthModule,
  ],
})
export class AppModule {}
