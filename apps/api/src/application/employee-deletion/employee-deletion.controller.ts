import {
  Controller,
  Delete,
  HttpCode,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../platform/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../platform/auth/guards/jwt-auth.guard';
import { User } from '../../platform/identity/user.entity';
import { EmployeeDeletionCoordinator } from './employee-deletion.coordinator';

@Controller('employees')
@UseGuards(JwtAuthGuard)
export class EmployeeDeletionController {
  constructor(private readonly deletion: EmployeeDeletionCoordinator) {}

  @Delete(':id')
  @HttpCode(204)
  async deleteEmployee(
    @CurrentUser() actor: User,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.deletion.deleteEmployee(actor, id);
  }
}
