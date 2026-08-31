import { AbsencesErasureFacade } from './absences-erasure.facade';
import { AbsenceAttachment } from './absence-attachment.entity';
import { AbsenceRequest } from './absence-request.entity';
import { AbsenceRequestHistory } from './absence-request-history.entity';

describe('AbsencesErasureFacade', () => {
  it('deletes requests, attachments, history for employee', async () => {
    const deleted: Array<{ entity: string; where: unknown }> = [];
    const enqueueKeys: string[] = [];

    const manager = {
      getRepository: (entity: unknown) => {
        if (entity === AbsenceRequest) {
          return {
            find: async () => [{ id: 'r1' }, { id: 'r2' }],
            delete: async (where: unknown) => {
              deleted.push({ entity: 'AbsenceRequest', where });
            },
          };
        }
        if (entity === AbsenceAttachment) {
          return {
            find: async () => [
              { id: 'a1', storageKey: 'db:inline' },
              { id: 'a2', storageKey: 's3://bucket/x' },
            ],
            delete: async (where: unknown) => {
              deleted.push({ entity: 'AbsenceAttachment', where });
            },
          };
        }
        if (entity === AbsenceRequestHistory) {
          return {
            delete: async (where: unknown) => {
              deleted.push({ entity: 'AbsenceRequestHistory', where });
            },
          };
        }
        throw new Error('unexpected entity');
      },
      query: async (_sql: string, params: string[]) => {
        enqueueKeys.push(params[0]!);
      },
    };

    const facade = new AbsencesErasureFacade();
    await facade.eraseForEmployee(manager as never, 'emp-1');

    expect(enqueueKeys).toEqual(['s3://bucket/x']);
    expect(deleted.map((d) => d.entity)).toEqual([
      'AbsenceAttachment',
      'AbsenceRequestHistory',
      'AbsenceRequest',
    ]);
  });

  it('no-ops when employee has no requests', async () => {
    let requestDeletes = 0;
    const manager = {
      getRepository: (entity: unknown) => {
        if (entity === AbsenceRequest) {
          return {
            find: async () => [],
            delete: async () => {
              requestDeletes += 1;
            },
          };
        }
        return {
          find: async () => [],
          delete: async () => {
            throw new Error('should not delete');
          },
        };
      },
    };
    await new AbsencesErasureFacade().eraseForEmployee(manager as never, 'emp-x');
    expect(requestDeletes).toBe(0);
  });
});
