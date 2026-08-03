import {
  ATTACHED_STATUSES,
  attachmentStateForStatus,
} from './questionnaire-assignment-attachment-state';
import { QUESTIONNAIRE_ASSIGNMENT_STATUSES } from '../questionnaire.enums';

describe('attachmentStateForStatus', () => {
  it.each([
    ['new', 'new'],
    ['assigned', 'attached'],
    ['in_progress', 'attached'],
    ['submitted', 'attached'],
    ['changes_requested', 'attached'],
    ['reviewed', 'attached'],
    ['cancelled', 'detached'],
    ['closed', 'closed'],
  ] as const)('maps %s -> %s', (status, expected) => {
    expect(attachmentStateForStatus(status)).toBe(expected);
  });

  it('covers every known assignment status exhaustively', () => {
    for (const status of QUESTIONNAIRE_ASSIGNMENT_STATUSES) {
      expect(() => attachmentStateForStatus(status)).not.toThrow();
    }
  });

  it('throws for unknown statuses', () => {
    expect(() => attachmentStateForStatus('bogus')).toThrow(
      /Unknown questionnaire assignment status/,
    );
  });
});

describe('ATTACHED_STATUSES', () => {
  it('lists exactly the statuses that map to attached', () => {
    const attachedByMapping = QUESTIONNAIRE_ASSIGNMENT_STATUSES.filter(
      (status) => attachmentStateForStatus(status) === 'attached',
    );
    expect([...ATTACHED_STATUSES].sort()).toEqual(
      [...attachedByMapping].sort(),
    );
  });
});
