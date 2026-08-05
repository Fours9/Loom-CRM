import { mapRawNotification } from './notification-mapper';

describe('mapRawNotification', () => {
  it('maps payload.requestId to relatedRequestId', () => {
    const n = mapRawNotification({
      id: '1',
      type: 'request.approved',
      title: 't',
      body: 'b',
      isRead: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      payload: { requestId: 'req-1' },
    });
    expect(n.relatedRequestId).toBe('req-1');
    expect(n.relatedAssignmentId).toBeNull();
  });

  it('maps payload.assignmentId to relatedAssignmentId', () => {
    const n = mapRawNotification({
      id: '2',
      type: 'questionnaire.changes_requested',
      title: 't',
      body: 'b',
      isRead: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      payload: { assignmentId: 'asg-1' },
    });
    expect(n.relatedAssignmentId).toBe('asg-1');
    expect(n.relatedRequestId).toBeNull();
  });

  it('tolerates missing or invalid payload', () => {
    const n = mapRawNotification({
      id: '3',
      type: 'x',
      title: 't',
      body: 'b',
      isRead: true,
      createdAt: new Date('2026-01-02T00:00:00.000Z'),
      payload: { requestId: 12 as unknown as string },
    });
    expect(n.relatedRequestId).toBeNull();
    expect(n.relatedAssignmentId).toBeNull();
    expect(n.createdAt).toBe('2026-01-02T00:00:00.000Z');
  });
});
