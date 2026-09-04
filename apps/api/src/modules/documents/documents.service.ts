import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { User } from '../../platform/identity/user.entity';
import { AuditService } from '../../platform/audit/audit.service';
import { Permission } from '../../platform/permissions/permission.names';
import { AuthorizationContextService } from '../../platform/access-control/authorization-context.service';
import {
  hasPermission,
  type AuthorizationContext,
} from '../../platform/access-control/authorization-context';
import { ConfidentialAccessPolicy } from '../../platform/access-control/confidential-access.policy';
import { Employee } from '../../organization/employees/employee.entity';
import {
  EmployeeAccessService,
  type TargetAccessFacts,
} from '../../organization/access/employee-access.service';
import { EmployeeDocument } from './employee-document.entity';
import { EmployeeDocumentFile } from './employee-document-file.entity';
import type { EmployeeDocumentType } from './document-types';
import {
  DOCUMENT_ALLOWED_MIME_TYPES,
  DOCUMENT_MAX_FILE_SIZE,
  DOCUMENT_MAX_FILES_PER_SUBMISSION,
} from './document-limits';
import { normalizeUploadedFileName } from '../../platform/http/normalize-uploaded-file-name';
import { DocumentTypeAccessPolicy } from './document-type-access.policy';
import { DocumentResourceAccessPolicy } from './document-resource-access.policy';

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
  isConfidential: boolean;
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

type ResolvedEmployeeDocContext = {
  employee: Employee;
  authz: AuthorizationContext;
  target: TargetAccessFacts;
  hasDocumentsManage: boolean;
};

@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(EmployeeDocument)
    private readonly documents: Repository<EmployeeDocument>,
    @InjectRepository(EmployeeDocumentFile)
    private readonly files: Repository<EmployeeDocumentFile>,
    private readonly access: EmployeeAccessService,
    private readonly authorization: AuthorizationContextService,
    private readonly audit: AuditService,
    private readonly dataSource: DataSource,
  ) {}

  async listForEmployee(
    actor: User,
    employeeId: string,
  ): Promise<EmployeeDocumentListResponseDto> {
    const ctx = await this.resolveEmployeeDocContext(actor, employeeId);
    if (!ctx.target.isInScope) {
      throw new ForbiddenException('Cannot view employee');
    }

    const rows = await this.documents.find({
      where: { employeeId: ctx.employee.id },
      order: { createdAt: 'DESC', id: 'DESC' },
    });

    const visible: EmployeeDocument[] = [];
    const canDeleteById = new Map<string, boolean>();
    for (const row of rows) {
      const decision =
        DocumentResourceAccessPolicy.evaluateExistingDocumentAccess(
          this.toExistingAccessInput(ctx, row),
        );
      if (!decision.canRead) continue;
      visible.push(row);
      canDeleteById.set(
        row.id,
        ctx.hasDocumentsManage && decision.canMutate,
      );
    }

    const fileRows =
      visible.length === 0
        ? []
        : await this.files.find({
            where: { documentId: In(visible.map((r) => r.id)) },
            order: { createdAt: 'ASC', id: 'ASC' },
          });

    const byDocument = new Map<string, EmployeeDocumentFile[]>();
    for (const file of fileRows) {
      const list = byDocument.get(file.documentId) ?? [];
      list.push(file);
      byDocument.set(file.documentId, list);
    }

    const items = visible
      .map((row) =>
        this.toListItem(row, byDocument.get(row.id) ?? [], {
          canDelete: canDeleteById.get(row.id) === true,
        }),
      )
      .filter((item) => item.files.length > 0);

    return {
      items,
      capabilities: { canUpload: ctx.hasDocumentsManage },
    };
  }

  async upload(
    actor: User,
    employeeId: string,
    input: {
      title: string;
      documentType: EmployeeDocumentType;
      isConfidential?: boolean;
    },
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

    const ctx = await this.resolveEmployeeDocContext(actor, employeeId);
    if (!ctx.target.isInScope) {
      throw new ForbiddenException('Cannot view employee');
    }
    if (!ctx.hasDocumentsManage) {
      throw new ForbiddenException('Missing permission: documents.manage');
    }

    const typeInput = {
      isOwner: ctx.target.isOwner,
      isAdminEquivalent: ctx.authz.isAdminEquivalent,
      canViewTargetViaManagedScope: ctx.target.isViaManagedScope,
      documentType: input.documentType,
    };
    if (!DocumentTypeAccessPolicy.canWriteType(typeInput)) {
      throw new NotFoundException('Document not found');
    }

    const isConfidential = input.isConfidential ?? false;
    if (isConfidential && !ConfidentialAccessPolicy.canMark(ctx.authz)) {
      throw new ForbiddenException('Cannot mark document as confidential');
    }

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
          employeeId: ctx.employee.id,
          documentType: input.documentType,
          title,
          isConfidential,
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
            employeeId: ctx.employee.id,
            documentId: document.id,
            documentType: document.documentType,
            isConfidential: document.isConfidential,
            fileCount: savedFiles.length,
            sizeBytes: savedFiles.reduce((sum, f) => sum + f.sizeBytes, 0),
          },
        },
        manager,
      );

      return { document, files: savedFiles };
    });

    const decision =
      DocumentResourceAccessPolicy.evaluateExistingDocumentAccess(
        this.toExistingAccessInput(ctx, saved.document),
      );

    return this.toListItem(saved.document, saved.files, {
      canDelete: ctx.hasDocumentsManage && decision.canMutate,
    });
  }

  async downloadFile(actor: User, documentId: string, fileId: string) {
    const document = await this.documents.findOne({
      where: { id: documentId },
    });
    if (!document) {
      throw new NotFoundException('Document not found');
    }

    const ctx = await this.resolveEmployeeDocContext(
      actor,
      document.employeeId,
    );
    DocumentResourceAccessPolicy.requireExistingDocumentReadAccess(
      this.toExistingAccessInput(ctx, document),
    );

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

    const ctx = await this.resolveEmployeeDocContext(
      actor,
      document.employeeId,
    );
    if (!ctx.hasDocumentsManage) {
      throw new NotFoundException('Document not found');
    }
    DocumentResourceAccessPolicy.requireExistingDocumentMutationAccess(
      this.toExistingAccessInput(ctx, document),
    );

    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(EmployeeDocument);
      const result = await repo.softDelete({
        id: documentId,
        employeeId: ctx.employee.id,
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
            employeeId: ctx.employee.id,
            documentId,
            documentType: document.documentType,
            isConfidential: document.isConfidential,
          },
        },
        manager,
      );
    });

    return { ok: true };
  }

  private async resolveEmployeeDocContext(
    actor: User,
    employeeId: string,
  ): Promise<ResolvedEmployeeDocContext> {
    const employee = await this.access.getEmployeeOrFail(employeeId);
    const [authz, actorAccess] = await Promise.all([
      this.authorization.resolve(actor.id),
      this.access.resolveActorContext(actor),
    ]);
    const target = await this.access.resolveTargetAccess(
      actor,
      employee,
      actorAccess,
    );
    const hasDocumentsManage = hasPermission(
      authz,
      Permission.DocumentsManage,
    );

    return { employee, authz, target, hasDocumentsManage };
  }

  private toExistingAccessInput(
    ctx: ResolvedEmployeeDocContext,
    document: EmployeeDocument,
  ) {
    return {
      authz: ctx.authz,
      isOwner: ctx.target.isOwner,
      employeeInScope: ctx.target.isInScope,
      canViewTargetViaManagedScope: ctx.target.isViaManagedScope,
      documentType: document.documentType,
      isConfidential: Boolean(document.isConfidential),
    };
  }

  private toListItem(
    row: EmployeeDocument,
    files: EmployeeDocumentFile[],
    permissions: { canDelete: boolean },
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
      isConfidential: Boolean(row.isConfidential),
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
      permissions,
    };
  }
}
