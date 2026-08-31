import {
  EMPLOYEE_HISTORY_SUMMARIES,
  EMPLOYEE_HISTORY_SUMMARY_FALLBACK,
  summarizeEmployeeHistoryAction,
} from './employee-history.labels';
import {
  projectEmployeeHistoryItem,
  resolveHistoryActorLabel,
} from './employee-history.projector';

describe('summarizeEmployeeHistoryAction', () => {
  it('maps known actions to Ukrainian summaries', () => {
    for (const [action, summary] of Object.entries(EMPLOYEE_HISTORY_SUMMARIES)) {
      expect(summarizeEmployeeHistoryAction(action)).toBe(summary);
    }
  });

  it('uses safe fallback for unknown actions', () => {
    expect(summarizeEmployeeHistoryAction('employee.future_event')).toBe(
      EMPLOYEE_HISTORY_SUMMARY_FALLBACK,
    );
  });

  it('does not interpolate metadata into summary', () => {
    const summary = summarizeEmployeeHistoryAction('employee.contacts_updated');
    expect(summary).not.toMatch(/@|380|\+/);
  });
});

describe('resolveHistoryActorLabel', () => {
  const usersById = new Map([['u1', { email: 'a@example.com' }]]);
  const employeesByUserId = new Map([
    ['u1', { fullName: 'Іван Петренко' }],
  ]);

  it('returns null for system (no actorUserId)', () => {
    expect(
      resolveHistoryActorLabel({
        actorUserId: null,
        usersById,
        employeesByUserId,
      }),
    ).toBeNull();
  });

  it('returns unknown when user missing', () => {
    expect(
      resolveHistoryActorLabel({
        actorUserId: 'gone',
        usersById,
        employeesByUserId,
      }),
    ).toEqual({ userId: 'gone', label: 'Видалений користувач' });
  });

  it('prefers employee full name', () => {
    expect(
      resolveHistoryActorLabel({
        actorUserId: 'u1',
        usersById,
        employeesByUserId,
      }),
    ).toEqual({ userId: 'u1', label: 'Іван Петренко' });
  });

  it('falls back to email when no employee', () => {
    expect(
      resolveHistoryActorLabel({
        actorUserId: 'u1',
        usersById,
        employeesByUserId: new Map(),
      }),
    ).toEqual({ userId: 'u1', label: 'a@example.com' });
  });
});

describe('projectEmployeeHistoryItem', () => {
  it('emits ISO createdAt and static summary', () => {
    const createdAt = new Date('2026-07-28T10:15:00.000Z');
    const item = projectEmployeeHistoryItem({
      auditLog: {
        id: 'a1',
        action: 'employee.basic_updated',
        actorUserId: 'u1',
        createdAt,
      },
      actor: { userId: 'u1', label: 'Іван Петренко' },
      redactedMetadata: { redacted: true },
    });
    expect(item.createdAt).toBe('2026-07-28T10:15:00.000Z');
    expect(item.summary).toBe('Оновлено основні дані');
    expect(item.metadata).toEqual({ redacted: true });
    expect(item.action).toBe('employee.basic_updated');
  });
});
