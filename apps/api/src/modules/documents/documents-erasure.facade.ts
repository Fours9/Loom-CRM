import { Injectable } from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import { enqueueExternalFileDeletion } from '../../platform/storage/file-deletion-outbox';
import { EmployeeDocument } from './employee-document.entity';
import { EmployeeDocumentFile } from './employee-document-file.entity';

/**
 * Documents-owned rows for Employee hard-delete (same EntityManager / TX).
 * Includes soft-deleted documents (fail-closed vs FK RESTRICT).
 */
@Injectable()
export class DocumentsErasureFacade {
  async eraseForEmployee(
    manager: EntityManager,
    employeeId: string,
  ): Promise<void> {
    const docs = manager.getRepository(EmployeeDocument);
    const files = manager.getRepository(EmployeeDocumentFile);

    const documentRows = await docs
      .createQueryBuilder('d')
      .withDeleted()
      .select(['d.id'])
      .where('d.employee_id = :employeeId', { employeeId })
      .getMany();
    const documentIds = documentRows.map((d) => d.id);
    if (documentIds.length === 0) return;

    const fileRows = await files.find({
      where: { documentId: In(documentIds) },
      select: ['id', 'storageKey'],
    });
    for (const file of fileRows) {
      await enqueueExternalFileDeletion(manager, file.storageKey);
    }

    await files.delete({ documentId: In(documentIds) });
    await docs
      .createQueryBuilder()
      .delete()
      .from(EmployeeDocument)
      .where('employee_id = :employeeId', { employeeId })
      .execute();
  }
}
