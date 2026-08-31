import { Injectable } from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import { enqueueExternalFileDeletion } from '../../platform/storage/file-deletion-outbox';
import { AbsenceAttachment } from './absence-attachment.entity';
import { AbsenceRequest } from './absence-request.entity';
import { AbsenceRequestHistory } from './absence-request-history.entity';

/**
 * Absences-owned rows for Employee hard-delete (same EntityManager / TX).
 */
@Injectable()
export class AbsencesErasureFacade {
  async eraseForEmployee(
    manager: EntityManager,
    employeeId: string,
  ): Promise<void> {
    const requests = manager.getRepository(AbsenceRequest);
    const attachments = manager.getRepository(AbsenceAttachment);
    const history = manager.getRepository(AbsenceRequestHistory);

    const rows = await requests.find({
      where: { employeeId },
      select: ['id'],
    });
    const requestIds = rows.map((r) => r.id);
    if (requestIds.length === 0) return;

    const files = await attachments.find({
      where: { requestId: In(requestIds) },
      select: ['id', 'storageKey'],
    });
    for (const file of files) {
      await enqueueExternalFileDeletion(manager, file.storageKey);
    }

    await attachments.delete({ requestId: In(requestIds) });
    await history.delete({ requestId: In(requestIds) });
    await requests.delete({ employeeId });
  }
}
