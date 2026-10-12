import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Position } from './position.entity';
import { Direction } from '../companies/direction.entity';

@Entity({ name: 'position_managed_directions' })
@Unique(['positionId', 'directionId'])
export class PositionManagedDirection {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'position_id', type: 'uuid' })
  positionId!: string;

  @ManyToOne(() => Position, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'position_id' })
  position?: Position;

  @Index()
  @Column({ name: 'direction_id', type: 'uuid' })
  directionId!: string;

  @ManyToOne(() => Direction, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'direction_id' })
  direction?: Direction;
}
