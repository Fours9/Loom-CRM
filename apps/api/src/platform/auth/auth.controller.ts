import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { User } from '../identity/user.entity';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: User) {
    return this.auth.me(user);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  changePassword(@CurrentUser() user: User, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(
      user,
      dto.currentPassword,
      dto.newPassword,
    );
  }

  /** Admin-only temporary password reset (PW parity). */
  @Post('reset-password/:userId')
  @UseGuards(JwtAuthGuard)
  resetPassword(
    @CurrentUser() actor: User,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: ResetPasswordDto,
  ) {
    return this.auth.resetPassword(actor, userId, dto.temporaryPassword);
  }
}
