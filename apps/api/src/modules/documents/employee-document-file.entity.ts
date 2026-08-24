import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'employee_document_files' })
export class EmployeeDocumentFile {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'document_id', type: 'uuid' })
  documentId!: string;

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

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
