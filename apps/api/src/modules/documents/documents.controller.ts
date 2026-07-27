import {
  Controller,
  Delete,
  Get,
  Param,
  ParseFilePipe,
  ParseUUIDPipe,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Body,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { JwtAuthGuard } from '../../platform/auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../platform/auth/decorators/current-user.decorator';
import { User } from '../../platform/identity/user.entity';
import { Permission } from '../../platform/permissions/permission.names';
import { RequirePermissions } from '../../platform/permissions/require-permissions.decorator';
import { PermissionsGuard } from '../../platform/permissions/permissions.guard';
import { attachmentContentDisposition } from '../../platform/http/content-disposition';
import { DocumentsService } from './documents.service';
import { UploadEmployeeDocumentDto } from './upload-employee-document.dto';
import {
  DOCUMENT_ALLOWED_MIME_REGEXP,
  DOCUMENT_MAX_FILE_SIZE,
} from './document-limits';

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
    FileInterceptor('file', {
      limits: { fileSize: DOCUMENT_MAX_FILE_SIZE },
    }),
  )
  upload(
    @CurrentUser() actor: User,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body() dto: UploadEmployeeDocumentDto,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: DOCUMENT_MAX_FILE_SIZE }),
          new FileTypeValidator({ fileType: DOCUMENT_ALLOWED_MIME_REGEXP }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    return this.documents.upload(actor, employeeId, dto, file);
  }

  @Get(':id/download')
  @RequirePermissions(Permission.DocumentsView)
  async download(
    @CurrentUser() actor: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const file = await this.documents.download(actor, id);
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
