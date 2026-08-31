import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { QuestionnaireAssignment } from './questionnaire-assignment.entity';
import { QuestionnaireProfileProposal } from './questionnaire-profile-proposal.entity';

/**
 * Questionnaires-owned rows for Employee hard-delete (same EntityManager / TX).
 * Includes attached and detached assignments; children CASCADE from assignment.
 */
@Injectable()
export class QuestionnairesErasureFacade {
  async eraseForEmployee(
    manager: EntityManager,
    employeeId: string,
  ): Promise<void> {
    const proposals = manager.getRepository(QuestionnaireProfileProposal);
    const assignments = manager.getRepository(QuestionnaireAssignment);

    await proposals.delete({ employeeId });

    await assignments
      .createQueryBuilder()
      .delete()
      .from(QuestionnaireAssignment)
      .where('employee_id = :employeeId', { employeeId })
      .orWhere('detached_from_employee_id = :employeeId', { employeeId })
      .execute();
  }
}
