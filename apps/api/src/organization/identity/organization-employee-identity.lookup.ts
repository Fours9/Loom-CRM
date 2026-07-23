import { Injectable } from '@nestjs/common';
import { EmployeeIdentityLookup } from '../../platform/auth/auth.service';
import { EmployeesService } from '../employees/employees.service';

@Injectable()
export class OrganizationEmployeeIdentityLookup extends EmployeeIdentityLookup {
  constructor(private readonly employees: EmployeesService) {
    super();
  }

  async findEmployeeIdByUserId(userId: string): Promise<string | null> {
    const emp = await this.employees.findByUserId(userId);
    return emp?.id ?? null;
  }
}
