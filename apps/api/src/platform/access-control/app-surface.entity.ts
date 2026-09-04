import { Column, Entity, PrimaryColumn } from 'typeorm';

/** UI exposure catalog. Surface never authorizes a backend mutation (ADR 0011). */
@Entity({ name: 'app_surfaces' })
export class AppSurface {
  @PrimaryColumn({ type: 'varchar', length: 96 })
  id!: string;

  @Column({ name: 'label_ua', type: 'varchar', length: 160 })
  labelUa!: string;

  @Column({ name: 'group_key', type: 'varchar', length: 64 })
  groupKey!: string;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder!: number;
}
