import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { getApplicationConfig } from '../config/application-config';
import { IdentityModule } from '../identity/identity.module';
import { AuditModule } from '../audit/audit.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { OrganizationModule } from '../../organization/organization.module';

@Module({
  imports: [
    IdentityModule,
    AuditModule,
    forwardRef(() => OrganizationModule),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      useFactory: () => {
        const config = getApplicationConfig();
        return {
          secret: config.jwtSecret,
          signOptions: {
            expiresIn: (process.env.JWT_EXPIRES_IN || '8h') as `${number}h`,
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
