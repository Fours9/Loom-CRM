import { InternalServerErrorException } from '@nestjs/common';
import { EmployeeSerializer } from './employee.serializer';
import { UserStatus } from '../../platform/identity/user.enums';

describe('EmployeeSerializer accountRole fail-closed', () => {
  const access = {
    canViewWorkContacts: jest.fn().mockResolvedValue(true),
    isOwner: jest.fn().mockReturnValue(false),
  };
  const authorization = {
    resolve: jest.fn().mockResolvedValue({
      userId: 'viewer',
      accountRole: {
        id: 'r',
        code: 'employee',
        name: 'E',
        permissionPreset: 'employee',
        isAdminEquivalent: false,
        isSystem: true,
      },
      permissions: [],
      surfaces: [],
      isAdminEquivalent: false,
    }),
  };
  const serializer = new EmployeeSerializer(
    access as never,
    authorization as never,
  );

  const baseEmployee = {
    id: 'e1',
    userId: 'u1',
    employeeNumber: '1',
    lastName: 'Test',
    firstName: 'User',
    middleName: null,
    photoUrl: null,
    phoneNumber: null,
    telegram: null,
    workEmail: null,
    departmentId: null,
    department: null,
    positionId: null,
    position: null,
    calendarColor: null,
    role: 'employee',
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-01T00:00:00.000Z'),
  };

  it('throws when hasAccount but accountRole relation missing', async () => {
    await expect(
      serializer.toListDto(
        {
          ...baseEmployee,
          user: {
            id: 'u1',
            email: 'a@b.c',
            status: UserStatus.Active,
            mustChangePassword: false,
            accountRoleId: 'role-1',
            accountRole: undefined,
          },
        } as never,
        { id: 'viewer' } as never,
        { canViewWorkContacts: true, completenessPercent: 0 },
      ),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it('projects AccountRole.name when relation loaded', async () => {
    const dto = await serializer.toListDto(
      {
        ...baseEmployee,
        user: {
          id: 'u1',
          email: 'a@b.c',
          status: UserStatus.Active,
          mustChangePassword: false,
          accountRoleId: 'role-1',
          accountRole: {
            id: 'role-1',
            code: 'director',
            name: 'Директор',
            isAdminEquivalent: false,
          },
        },
      } as never,
      { id: 'viewer' } as never,
      {
        canViewWorkContacts: true,
        completenessPercent: 10,
        displayedDirection: {
          directionId: 'd1',
          directionName: 'Retail',
        },
      },
    );
    expect(dto.accountRole?.name).toBe('Директор');
    expect(dto.directionName).toBe('Retail');
    expect(dto.role).toBe('employee');
  });

  it('sets accountRole null when no account', async () => {
    const dto = await serializer.toListDto(
      {
        ...baseEmployee,
        userId: null,
        user: undefined,
      } as never,
      { id: 'viewer' } as never,
      { canViewWorkContacts: true, completenessPercent: 0 },
    );
    expect(dto.hasAccount).toBe(false);
    expect(dto.accountRole).toBeNull();
  });
});
