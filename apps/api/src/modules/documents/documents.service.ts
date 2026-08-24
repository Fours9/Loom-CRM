import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { User } from '../../platform/identity/user.entity';
import { AuditService } from '../../platform/audit/audit.service';
import { Permission } from '../../platform/permissions/permission.names';
import { PermissionService } from '../../platform/permissions/permission.service';
import { Employee } from '../../organization/employees/employee.entity';
import { EmployeeAccessService } from '../../organization/access/employee-access.service';
import { EmployeeDocument } from './employee-document.entity';
import { EmployeeDocumentFile } from './employee-document-file.entity';
import {
  MANAGER_VISIBLE_DOCUMENT_TYPES,
  type EmployeeDocumentType,
} from './document-types';
import {
  DOCUMENT_ALLOWED_MIME_TYPES,
  DOCUMENT_MAX_FILE_SIZE,
} from './document-limits';
import { normalizeUploadedFileName } from '../../platform/http/normalize-uploaded-file-name';

export const DOCUMENT_MAX_FILES_PER_SUBMISSION = 20;

export type EmployeeDocumentFileDto = {
  id: string;
  fileName: string;
  mimeType: string | null;
  sizeBytes: number;
  createdAt: string;
};

export type EmployeeDocumentListItemDto = {
  source: 'employee_document';
  id: string;
  employeeId: string;
  documentType: EmployeeDocumentType;
  title: string;
  createdAt: string;
  relatedStartDate: null;
  relatedEndDate: null;
  files: EmployeeDocumentFileDto[];
  permissions: { canDelete: boolean };
};

export type EmployeeDocumentListResponseDto = {
  items: EmployeeDocumentListItemDto[];
  capabilities: { canUpload: boolean };
};

@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(EmployeeDocument)
    private readonly documents: Repository<EmployeeDocument>,
    @InjectRepository(EmployeeDocumentFile)
    private readonly files: Repository<EmployeeDocumentFile>,
    private readonly access: EmployeeAccessService,
    private readonly permissions: PermissionService,
    private readonly audit: AuditService,
    private readonly dataSource: DataSource,
  ) {}

  async listForEmployee(
    actor: User,
    employeeId: string,
  ): Promise<EmployeeDocumentListResponseDto> {
    const employee = await this.access.getEmployeeOrFail(employeeId);
    await this.access.requireCanView(actor, employee);

    const canManage = this.permissions.has(
      actor.role,
      Permission.DocumentsManage,
    );

    const rows = await this.documents.find({
      where: { employeeId: employee.id },
      order: { createdAt: 'DESC' },
    });

    const visible = rows.filter((row) =>
      this.canViewDocumentType(actor, employee, row.documentType),
    );
    const fileRows =
      visible.length === 0
        ? []
        : await this.files.find({
            where: { documentId: In(visible.map((r) => r.id)) },
            order: { createdAt: 'ASC' },
          });

    const byDocument = new Map<string, EmployeeDocumentFile[]>();
    for (const file of fileRows) {
      const list = byDocument.get(file.documentId) ?? [];
      list.push(file);
      byDocument.set(file.documentId, list);
    }

    const items = visible
      .map((row) =>
        this.toListItem(row, byDocument.get(row.id) ?? [], canManage),
      )
      .filter((item) => item.files.length > 0);

    return {
      items,
      capabilities: { canUpload: canManage },
    };
  }

  async upload(
    actor: User,
    employeeId: string,
    input: { title: string; documentType: EmployeeDocumentType },
    uploaded: Express.Multer.File[],
  ): Promise<EmployeeDocumentListItemDto> {
    const files = uploaded ?? [];
    if (!files.length) {
      throw new BadRequestException('At least one file is required');
    }
    if (files.length > DOCUMENT_MAX_FILES_PER_SUBMISSION) {
      throw new BadRequestException(
        `Maximum ${DOCUMENT_MAX_FILES_PER_SUBMISSION} files per submission`,
      );
    }

    for (const file of files) {
      if (!file?.buffer?.length) {
        throw new BadRequestException('File is required');
      }
      if (file.size > DOCUMENT_MAX_FILE_SIZE) {
        throw new BadRequestException('File exceeds maximum size');
      }
      if (
        !DOCUMENT_ALLOWED_MIME_TYPES.includes(
          file.mimetype as (typeof DOCUMENT_ALLOWED_MIME_TYPES)[number],
        )
      ) {
        throw new BadRequestException('Unsupported file type');
      }
    }

    const employee = await this.access.getEmployeeOrFail(employeeId);
    await this.access.requireCanView(actor, employee);

    const title = input.title.trim();
    if (!title) {
      throw new BadRequestException('Title is required');
    }

    const documentId = uuidv4();
    const saved = await this.dataSource.transaction(async (manager) => {
      const docs = manager.getRepository(EmployeeDocument);
      const fileRepo = manager.getRepository(EmployeeDocumentFile);

      const document = await docs.save(
        docs.create({
          id: documentId,
          employeeId: employee.id,
          documentType: input.documentType,
          title,
          createdByUserId: actor.id,
        }),
      );

      const savedFiles: EmployeeDocumentFile[] = [];
      for (const file of files) {
        const fileId = uuidv4();
        const fileName = normalizeUploadedFileName(file.originalname || 'file');
        savedFiles.push(
          await fileRepo.save(
            fileRepo.create({
              id: fileId,
              documentId: document.id,
              fileName,
              mimeType: file.mimetype,
              sizeBytes: file.size,
              contentBase64: file.buffer.toString('base64'),
              storageKey: `db:employee-document-file:${fileId}`,
            }),
          ),
        );
      }

      await this.audit.record(
        {
          actorId: actor.id,
          action: 'employee.document_uploaded',
          entityType: 'employee_document',
          entityId: document.id,
          metadata: {
            employeeId: employee.id,
            documentId: document.id,
            documentType: document.documentType,
            fileCount: savedFiles.length,
            sizeBytes: savedFiles.reduce((sum, f) => sum + f.sizeBytes, 0),
          },
        },
        manager,
      );

      return { document, files: savedFiles };
    });

    return this.toListItem(saved.document, saved.files, true);
  }

  async downloadFile(actor: User, documentId: string, fileId: string) {
    const document = await this.documents.findOne({
      where: { id: documentId },
    });
    if (!document) {
      throw new NotFoundException('Document not found');
    }

    const employee = await this.access.getEmployeeOrFail(document.employeeId);
    try {
      await this.access.requireCanView(actor, employee);
    } catch {
      throw new NotFoundException('Document not found');
    }

    if (!this.canViewDocumentType(actor, employee, document.documentType)) {
      throw new NotFoundException('Document not found');
    }

    const file = await this.files
      .createQueryBuilder('file')
      .addSelect('file.contentBase64')
      .where('file.id = :fileId', { fileId })
      .andWhere('file.document_id = :documentId', { documentId })
      .getOne();

    if (!file || !file.contentBase64) {
      throw new NotFoundException('Document not found');
    }

    return {
      buffer: Buffer.from(file.contentBase64, 'base64'),
      mimeType: file.mimeType ?? 'application/octet-stream',
      fileName: normalizeUploadedFileName(file.fileName),
    };
  }

  async softDelete(actor: User, documentId: string): Promise<{ ok: true }> {
    const document = await this.documents.findOne({
      where: { id: documentId },
    });
    if (!document) {
      throw new NotFoundException('Document not found');
    }

    const employee = await this.access.getEmployeeOrFail(document.employeeId);
    try {
      await this.access.requireCanView(actor, employee);
    } catch {
      throw new NotFoundException('Document not found');
    }

    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(EmployeeDocument);
      const result = await repo.softDelete({
        id: documentId,
        employeeId: employee.id,
      });
      if (result.affected !== 1) {
        throw new NotFoundException('Document not found');
      }

      await this.audit.record(
        {
          actorId: actor.id,
          action: 'employee.document_deleted',
          entityType: 'employee_document',
          entityId: documentId,
          metadata: {
            employeeId: employee.id,
            documentId,
            documentType: document.documentType,
          },
        },
        manager,
      );
    });

    return { ok: true };
  }

  private canViewDocumentType(
    actor: User,
    employee: Employee,
    type: EmployeeDocumentType,
  ): boolean {
    if (this.access.isAdmin(actor)) return true;
    if (this.access.isOwner(actor, employee)) return true;
    if (this.access.isManager(actor)) {
      return MANAGER_VISIBLE_DOCUMENT_TYPES.has(type);
    }
    return false;
  }

  private toListItem(
    row: EmployeeDocument,
    files: EmployeeDocumentFile[],
    canDelete: boolean,
  ): EmployeeDocumentListItemDto {
    const createdAt =
      row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : String(row.createdAt);
    return {
      source: 'employee_document',
      id: row.id,
      employeeId: row.employeeId,
      documentType: row.documentType,
      title: row.title,
      createdAt,
      relatedStartDate: null,
      relatedEndDate: null,
      files: files.map((file) => ({
        id: file.id,
        fileName: normalizeUploadedFileName(file.fileName),
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        createdAt:
          file.createdAt instanceof Date
            ? file.createdAt.toISOString()
            : String(file.createdAt),
      })),
      permissions: { canDelete },
    };
  }
}
