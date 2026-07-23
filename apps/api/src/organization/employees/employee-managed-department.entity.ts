import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

@Entity({ name: 'employee_managed_departments' })
@Unique(['employeeId', 'departmentId'])
export class EmployeeManagedDepartment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'employee_id', type: 'uuid' })
  employeeId!: string;

  @Index()
  @Column({ name: 'department_id', type: 'uuid' })
  departmentId!: string;
}
