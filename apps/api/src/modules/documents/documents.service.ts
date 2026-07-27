import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { User } from '../../platform/identity/user.entity';
import { AuditService } from '../../platform/audit/audit.service';
import { Permission } from '../../platform/permissions/permission.names';
import { PermissionService } from '../../platform/permissions/permission.service';
import { Employee } from '../../organization/employees/employee.entity';
import { EmployeeAccessService } from '../../organization/access/employee-access.service';
import { EmployeeDocument } from './employee-document.entity';
import {
  MANAGER_VISIBLE_DOCUMENT_TYPES,
  type EmployeeDocumentType,
} from './document-types';
import {
  DOCUMENT_ALLOWED_MIME_TYPES,
  DOCUMENT_MAX_FILE_SIZE,
} from './document-limits';
import { normalizeUploadedFileName } from '../../platform/http/normalize-uploaded-file-name';

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
  files: [EmployeeDocumentFileDto];
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

    const items = rows
      .filter((row) =>
        this.canViewDocumentType(actor, employee, row.documentType),
      )
      .map((row) => this.toListItem(row, canManage));

    return {
      items,
      capabilities: { canUpload: canManage },
    };
  }

  async upload(
    actor: User,
    employeeId: string,
    input: { title: string; documentType: EmployeeDocumentType },
    file: Express.Multer.File | undefined,
  ): Promise<EmployeeDocumentListItemDto> {
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

    const employee = await this.access.getEmployeeOrFail(employeeId);
    await this.access.requireCanView(actor, employee);

    const fileName = normalizeUploadedFileName(file.originalname || 'file');
    const id = uuidv4();
    const storageKey = `db:employee-document:${id}`;

    const saved = await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(EmployeeDocument);
      const document = await repo.save(
        repo.create({
          id,
          employeeId: employee.id,
          documentType: input.documentType,
          title: input.title.trim(),
          fileName,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          contentBase64: file.buffer.toString('base64'),
          storageKey,
          createdByUserId: actor.id,
        }),
      );

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
            sizeBytes: document.sizeBytes,
          },
        },
        manager,
      );

      return document;
    });

    return this.toListItem(saved, true);
  }

  async download(actor: User, documentId: string) {
    const document = await this.documents
      .createQueryBuilder('document')
      .addSelect('document.contentBase64')
      .where('document.id = :id', { id: documentId })
      .andWhere('document.deleted_at IS NULL')
      .getOne();

    if (!document || !document.contentBase64) {
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

    return {
      buffer: Buffer.from(document.contentBase64, 'base64'),
      mimeType: document.mimeType ?? 'application/octet-stream',
      fileName: normalizeUploadedFileName(document.fileName),
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
            sizeBytes: document.sizeBytes,
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
    canDelete: boolean,
  ): EmployeeDocumentListItemDto {
    const createdAt =
      row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : String(row.createdAt);
    const file: EmployeeDocumentFileDto = {
      id: row.id,
      fileName: normalizeUploadedFileName(row.fileName),
      mimeType: row.mimeType,
      sizeBytes: row.sizeBytes,
      createdAt,
    };
    return {
      source: 'employee_document',
      id: row.id,
      employeeId: row.employeeId,
      documentType: row.documentType,
      title: row.title,
      createdAt,
      relatedStartDate: null,
      relatedEndDate: null,
      files: [file],
      permissions: { canDelete },
    };
  }
}
