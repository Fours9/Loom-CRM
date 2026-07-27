import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { EmployeeDocumentType } from './document-types';

@Entity({ name: 'employee_documents' })
export class EmployeeDocument {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'employee_id', type: 'uuid' })
  employeeId!: string;

  @Column({ name: 'document_type', type: 'varchar', length: 32 })
  documentType!: EmployeeDocumentType;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ name: 'file_name', type: 'varchar', length: 255 })
  fileName!: string;

  @Column({ name: 'mime_type', type: 'varchar', length: 128, nullable: true })
  mimeType!: string | null;

  @Column({ name: 'size_bytes', type: 'int', default: 0 })
  sizeBytes!: number;

  @Column({
    name: 'content_base64',
    type: 'text',
    nullable: true,
    select: false,
  })
  contentBase64!: string | null;

  @Column({ name: 'storage_key', type: 'varchar', length: 512 })
  storageKey!: string;

  @Column({ name: 'created_by_user_id', type: 'uuid', nullable: true })
  createdByUserId!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
