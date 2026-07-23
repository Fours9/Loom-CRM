import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { getApplicationConfig } from '../config/application-config';
import { UsersService } from '../identity/users.service';
import { UserStatus } from '../identity/user.enums';
import { JwtPayload } from './jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly users: UsersService) {
    const config = getApplicationConfig();
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.jwtSecret,
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.users.findById(payload.sub);
    if (!user || user.status !== UserStatus.Active) {
      throw new UnauthorizedException('Invalid session');
    }
    if (user.tokenVersion !== payload.tokenVersion) {
      throw new UnauthorizedException('Session expired');
    }
    return user;
  }
}
