import {
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import {
  parseQuestionnaireContext,
  type QuestionnaireContext,
} from '@loom/contracts-questionnaires';

const logger = new Logger('QuestionnaireContext');

/**
 * Expose parsed QuestionnaireContext (V1 historical or V2) or null
 * (legacy only when raw is null).
 * Non-null invalid context is a server data-integrity failure (HTTP 500).
 */
export function parseAssignmentContext(
  raw: unknown,
  meta?: { assignmentId?: string; submissionId?: string },
): QuestionnaireContext | null {
  if (raw == null) return null;
  const parsed = parseQuestionnaireContext(raw);
  if (!parsed.ok) {
    logger.error(
      `Invalid questionnaire context_json (data integrity): ${parsed.error}` +
        (meta?.assignmentId ? ` assignmentId=${meta.assignmentId}` : '') +
        (meta?.submissionId ? ` submissionId=${meta.submissionId}` : ''),
    );
    throw new InternalServerErrorException(
      'Questionnaire context is corrupted',
    );
  }
  return parsed.context;
}
