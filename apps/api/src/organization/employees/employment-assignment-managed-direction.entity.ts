import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { EmploymentAssignment } from './employment-assignment.entity';
import { Direction } from '../companies/direction.entity';

@Entity({ name: 'employment_assignment_managed_directions' })
@Unique(['assignmentId', 'directionId'])
export class EmploymentAssignmentManagedDirection {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'assignment_id', type: 'uuid' })
  assignmentId!: string;

  @ManyToOne(() => EmploymentAssignment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'assignment_id' })
  assignment?: EmploymentAssignment;

  @Index()
  @Column({ name: 'direction_id', type: 'uuid' })
  directionId!: string;

  @ManyToOne(() => Direction, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'direction_id' })
  direction?: Direction;
}
