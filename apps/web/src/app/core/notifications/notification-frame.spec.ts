import {
  normalizeNotificationType,
  notificationFrameTone,
} from './notification-frame';

describe('normalizeNotificationType', () => {
  it('strips absence. prefix used by Loom API', () => {
    expect(normalizeNotificationType('absence.request.approved')).toBe(
      'request.approved',
    );
  });

  it('keeps PW-style types', () => {
    expect(normalizeNotificationType('request.rejected')).toBe(
      'request.rejected',
    );
  });
});

describe('notificationFrameTone', () => {
  it('maps PW request types', () => {
    expect(notificationFrameTone('request.approved')).toBe('approved');
    expect(notificationFrameTone('request.rejected')).toBe('rejected');
    expect(notificationFrameTone('request.deletion_requested')).toBe(
      'rejected',
    );
    expect(notificationFrameTone('request.deletion_approved')).toBe(
      'rejected',
    );
    expect(notificationFrameTone('request.deletion_rejected')).toBe(
      'approved',
    );
    expect(notificationFrameTone('request.updated')).toBe('pending');
  });

  it('maps Loom absence.request.* types (existing inbox rows)', () => {
    expect(notificationFrameTone('absence.request.approved')).toBe('approved');
    expect(notificationFrameTone('absence.request.rejected')).toBe('rejected');
  });

  it('maps questionnaire types', () => {
    expect(notificationFrameTone('questionnaire.changes_requested')).toBe(
      'pending',
    );
    expect(notificationFrameTone('questionnaire.changes_completed')).toBe(
      'completed',
    );
    expect(notificationFrameTone('questionnaire.changes_declined')).toBe(
      'rejected',
    );
  });

  it('falls back to neutral', () => {
    expect(notificationFrameTone('other')).toBe('neutral');
    expect(notificationFrameTone(null)).toBe('neutral');
  });
});
