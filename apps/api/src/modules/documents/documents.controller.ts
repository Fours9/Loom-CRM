import {
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
  Body,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { JwtAuthGuard } from '../../platform/auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../platform/auth/decorators/current-user.decorator';
import { User } from '../../platform/identity/user.entity';
import { Permission } from '../../platform/permissions/permission.names';
import { RequirePermissions } from '../../platform/permissions/require-permissions.decorator';
import { PermissionsGuard } from '../../platform/permissions/permissions.guard';
import { attachmentContentDisposition } from '../../platform/http/content-disposition';
import {
  DOCUMENT_MAX_FILES_PER_SUBMISSION,
  DocumentsService,
} from './documents.service';
import { UploadEmployeeDocumentDto } from './upload-employee-document.dto';
import { DOCUMENT_MAX_FILE_SIZE } from './document-limits';

@Controller('documents')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get('employees/:employeeId')
  @RequirePermissions(Permission.DocumentsView)
  list(
    @CurrentUser() actor: User,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
  ) {
    return this.documents.listForEmployee(actor, employeeId);
  }

  @Post('employees/:employeeId')
  @RequirePermissions(Permission.DocumentsManage)
  @UseInterceptors(
    FilesInterceptor('files', DOCUMENT_MAX_FILES_PER_SUBMISSION, {
      limits: { fileSize: DOCUMENT_MAX_FILE_SIZE },
    }),
  )
  upload(
    @CurrentUser() actor: User,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body() dto: UploadEmployeeDocumentDto,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.documents.upload(actor, employeeId, dto, files ?? []);
  }

  @Get(':documentId/files/:fileId/download')
  @RequirePermissions(Permission.DocumentsView)
  async downloadFile(
    @CurrentUser() actor: User,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @Res() res: Response,
  ) {
    const file = await this.documents.downloadFile(actor, documentId, fileId);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader(
      'Content-Disposition',
      attachmentContentDisposition(file.fileName),
    );
    res.send(file.buffer);
  }

  @Delete(':id')
  @RequirePermissions(Permission.DocumentsManage)
  remove(
    @CurrentUser() actor: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.documents.softDelete(actor, id);
  }
}
