import { DataSource, EntityManager } from 'typeorm';
import { AuditService } from '../../platform/audit/audit.service';
import { Employee } from './employee.entity';
import { EmployeeProfileService } from './employee-profile.service';
import { EmployeeAccessService } from '../access/employee-access.service';
import { UserRole } from '../../platform/identity/user.enums';
import type { User } from '../../platform/identity/user.entity';

/**
 * Proves HR mutations pair entity write + audit in one DataSource.transaction:
 * if audit.record throws, the transaction rejects and the entity change is not committed.
 */
describe('EmployeeProfileService transactional audit', () => {
  it('patchBasic rolls back employee change when audit.record fails', async () => {
    const actor = { id: 'u-admin', role: UserRole.Admin } as User;
    const employeeId = 'e1';
    const liveEmployee = {
      id: employeeId,
      firstName: 'Old',
      lastName: 'Name',
      middleName: null,
      preferredName: null,
      photoUrl: null,
      employeeNumber: 'E-1',
    } as Employee;

    let transactionEntered = false;
    let committed = false;
    let savedFirstName: string | null = null;

    const access = {
      getEmployeeOrFail: jest.fn(async () => ({ ...liveEmployee })),
      requireCanEdit: jest.fn(async () => undefined),
      isAdmin: jest.fn(() => true),
    } as unknown as EmployeeAccessService;

    const audit = {
      record: jest.fn(async () => {
        throw new Error('audit write failed');
      }),
    } as unknown as AuditService;

    const dataSource = {
      transaction: jest.fn(async (work: (manager: EntityManager) => Promise<void>) => {
        transactionEntered = true;
        const draft = {
          id: liveEmployee.id,
          firstName: liveEmployee.firstName,
          lastName: liveEmployee.lastName,
          middleName: liveEmployee.middleName,
          preferredName: liveEmployee.preferredName,
          photoUrl: liveEmployee.photoUrl,
          employeeNumber: liveEmployee.employeeNumber,
        };
        const manager = {
          getRepository: (_entity: unknown) => ({
            findOneByOrFail: jest.fn(async () => draft),
            save: jest.fn(async (row: typeof draft) => {
              Object.assign(draft, row);
              savedFirstName = draft.firstName;
              return draft;
            }),
          }),
        } as unknown as EntityManager;

        await work(manager);
        committed = true;
        liveEmployee.firstName = draft.firstName;
      }),
    } as unknown as DataSource;

    const service = new EmployeeProfileService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      access,
      {} as never,
      audit,
      {} as never,
      dataSource,
    );

    await expect(
      service.patchBasic(actor, employeeId, { firstName: 'New' }),
    ).rejects.toThrow('audit write failed');

    expect(transactionEntered).toBe(true);
    expect(audit.record).toHaveBeenCalled();
    expect(savedFirstName).toBe('New');
    expect(committed).toBe(false);
    expect(liveEmployee.firstName).toBe('Old');
  });
});
