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
import { SkillGroup } from './skill-group.entity';

@Entity({ name: 'skills' })
export class Skill {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'group_id', type: 'uuid', nullable: true })
  groupId!: string | null;

  @ManyToOne(() => SkillGroup, (group) => group.skills, {
    onDelete: 'RESTRICT',
    nullable: true,
  })
  @JoinColumn({ name: 'group_id' })
  group?: SkillGroup | null;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  code!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'scale_kind', type: 'varchar', length: 16, default: 'range' })
  scaleKind!: 'range' | 'percent';

  @Column({ name: 'scale_min', type: 'int', default: 0 })
  scaleMin!: number;

  @Column({ name: 'scale_max', type: 'int', default: 5 })
  scaleMax!: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
