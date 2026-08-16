import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Position } from '../positions/position.entity';
import { Skill } from '../skills/skill.entity';

@Entity({ name: 'position_skill_requirements' })
@Unique('UQ_position_skill_req', ['positionId', 'skillId'])
export class PositionSkillRequirement {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'position_id', type: 'uuid' })
  positionId!: string;

  @ManyToOne(() => Position, (position) => position.skillRequirements, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'position_id' })
  position?: Position;

  @Index()
  @Column({ name: 'skill_id', type: 'uuid' })
  skillId!: string;

  @ManyToOne(() => Skill, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'skill_id' })
  skill?: Skill;

  @Column({ name: 'target_level', type: 'int', default: 0 })
  targetLevel!: number;

  @Column({ type: 'boolean', default: true })
  required!: boolean;

  @Column({ type: 'int', nullable: true })
  weight!: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
