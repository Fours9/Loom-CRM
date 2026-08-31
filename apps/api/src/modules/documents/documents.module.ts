import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationModule } from '../../organization/organization.module';
import { AuditModule } from '../../platform/audit/audit.module';
import { EmployeeDocument } from './employee-document.entity';
import { EmployeeDocumentFile } from './employee-document-file.entity';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { DocumentsErasureFacade } from './documents-erasure.facade';

@Module({
  imports: [
    TypeOrmModule.forFeature([EmployeeDocument, EmployeeDocumentFile]),
    OrganizationModule,
    AuditModule,
  ],
  providers: [DocumentsService, DocumentsErasureFacade],
  controllers: [DocumentsController],
  exports: [DocumentsService, DocumentsErasureFacade],
})
export class DocumentsModule {}
