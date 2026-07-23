import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

@Entity({ name: 'work_schedule_days' })
@Unique(['employeeId', 'weekday'])
export class WorkScheduleDay {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'employee_id', type: 'uuid' })
  employeeId!: string;

  /** 1=Mon .. 7=Sun */
  @Column({ type: 'smallint' })
  weekday!: number;

  @Column({ name: 'is_working_day', type: 'boolean', default: true })
  isWorkingDay!: boolean;

  @Column({ name: 'start_time', type: 'varchar', length: 8, nullable: true })
  startTime!: string | null;

  @Column({ name: 'end_time', type: 'varchar', length: 8, nullable: true })
  endTime!: string | null;

  @Column({ name: 'break_start', type: 'varchar', length: 8, nullable: true })
  breakStart!: string | null;

  @Column({ name: 'break_end', type: 'varchar', length: 8, nullable: true })
  breakEnd!: string | null;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  /** Legacy Loom column; kept in sync as NOT isWorkingDay */
  @Column({ name: 'is_day_off', type: 'boolean', default: false })
  isDayOff!: boolean;
}
