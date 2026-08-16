import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Position } from '../positions/position.entity';

@Entity({ name: 'position_goal_templates' })
export class PositionGoalTemplate {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'position_id', type: 'uuid' })
  positionId!: string;

  @ManyToOne(() => Position, (position) => position.goalTemplates, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'position_id' })
  position?: Position;

  @Column({ name: 'goal_kind', type: 'varchar', length: 32 })
  goalKind!: string;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder!: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
