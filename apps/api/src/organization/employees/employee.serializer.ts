import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { Employee } from './employee.entity';
import { User } from '../../platform/identity/user.entity';
import { UserStatus } from '../../platform/identity/user.enums';
import { EmployeeAccessService } from '../access/employee-access.service';
import { AuthorizationContextService } from '../../platform/access-control/authorization-context.service';
import {
  canChangeAssignmentOnTarget,
  canDeleteEmployee,
  canDestructivelyManageAccount,
  canExportProfile,
  canResetPassword,
  canViewAccountDetails,
  canViewAdminComment,
  canViewPersonalContacts,
  canViewTeamComment,
  canWritePersonalOnTarget,
} from './employee-profile-authz';
import {
  resolveEmployeeDisplayedDirection,
  type DisplayedDirectionRef,
} from './resolve-employee-displayed-direction';

export type AccountStatus = 'active' | 'deactivated';

export type EmployeeListAccountRoleDto = {
  id: string;
  code: string | null;
  name: string;
  isAdminEquivalent: boolean;
};

export type EmployeeListDto = {
  id: string;
  userId: string | null;
  hasAccount: boolean;
  employeeNumber: string;
  lastName: string;
  firstName: string;
  middleName: string | null;
  fullName: string;
  photoUrl: string | null;
  phoneNumber: string | null;
  telegram: string | null;
  workEmail: string | null;
  departmentId: string | null;
  departmentName: string | null;
  positionId: string | null;
  positionName: string | null;
  directionId: string | null;
  directionName: string | null;
  calendarColor: string | null;
  role: string;
  isDepartmentManager: boolean;
  accountRole: EmployeeListAccountRoleDto | null;
  accountStatus?: AccountStatus;
  accountEmail?: string;
  mustChangePassword: boolean | null;
  completenessPercent: number;
  createdAt: string;
  updatedAt: string;
};

export type EmployeeDetailDto = Omit<EmployeeListDto, 'completenessPercent'> & {
  completenessPercent?: number;
  comment?: string | null;
  adminComment?: string | null;
  personalPhoneNumber?: string | null;
  personalTelegram?: string | null;
  personalEmail?: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Avoid per-row DB after listVisibleEmployees. */
export type EmployeeListProjectionContext = {
  canViewWorkContacts: boolean;
  completenessPercent: number;
  /**
   * Fully resolved display direction (list). When set, skips EA→position→dept stack.
   */
  displayedDirection?: {
    directionId: string | null;
    directionName: string | null;
  } | null;
  /** Current EA direction when preloaded (detail / legacy). */
  assignmentDirection?: DisplayedDirectionRef | null;
};

@Injectable()
export class EmployeeSerializer {
  constructor(
    private readonly access: EmployeeAccessService,
    private readonly authorization: AuthorizationContextService,
  ) {}

  fullName(employee: Employee): string {
    return [employee.lastName, employee.firstName, employee.middleName]
      .filter(Boolean)
      .join(' ');
  }

  async toListDto(
    employee: Employee,
    viewer: User,
    ctx?: EmployeeListProjectionContext,
  ): Promise<EmployeeListDto> {
    const authz = await this.authorization.resolve(viewer.id);
    const isOwner = this.access.isOwner(viewer, employee);
    const showWorkContacts =
      ctx?.canViewWorkContacts ??
      (await this.access.canViewWorkContacts(viewer, employee, authz));
    const canViewAccount = canViewAccountDetails(authz, isOwner);
    const showMustChange = authz.isAdminEquivalent || isOwner;
    const hasAccount = employee.userId != null;

    const direction =
      ctx?.displayedDirection != null
        ? ctx.displayedDirection
        : resolveEmployeeDisplayedDirection({
            assignmentDirection: ctx?.assignmentDirection ?? null,
            positionDirection: this.directionRef(
              employee.position?.directionId,
              employee.position?.direction?.name,
            ),
            departmentDirection: this.directionRef(
              employee.department?.directionId,
              employee.department?.direction?.name,
            ),
          });

    const dto: EmployeeListDto = {
      id: employee.id,
      userId: employee.userId,
      hasAccount,
      employeeNumber: employee.employeeNumber,
      lastName: employee.lastName,
      firstName: employee.firstName,
      middleName: employee.middleName,
      fullName: this.fullName(employee),
      photoUrl: employee.photoUrl,
      phoneNumber: showWorkContacts ? employee.phoneNumber : null,
      telegram: showWorkContacts ? employee.telegram : null,
      workEmail: showWorkContacts ? employee.workEmail : null,
      departmentId: employee.departmentId,
      departmentName: employee.department?.name ?? null,
      positionId: employee.positionId,
      positionName: employee.position?.name ?? null,
      directionId: direction.directionId,
      directionName: direction.directionName,
      calendarColor: employee.calendarColor,
      role: employee.role,
      // Derived mirror / permission role — not legacy Employee.isDepartmentManager flag
      isDepartmentManager: employee.role === 'department_manager',
      accountRole: null,
      mustChangePassword: null,
      completenessPercent: ctx?.completenessPercent ?? 0,
      createdAt: employee.createdAt.toISOString(),
      updatedAt: employee.updatedAt.toISOString(),
    };

    if (hasAccount) {
      const user = employee.user;
      if (!user) {
        throw new InternalServerErrorException(
          'Employee has userId but User relation was not loaded',
        );
      }
      if (!user.accountRole) {
        throw new InternalServerErrorException(
          'Employee has account but AccountRole relation was not loaded',
        );
      }
      dto.accountRole = {
        id: user.accountRole.id,
        code: user.accountRole.code,
        name: user.accountRole.name,
        isAdminEquivalent: Boolean(user.accountRole.isAdminEquivalent),
      };
      dto.accountStatus =
        user.status === UserStatus.Deactivated ? 'deactivated' : 'active';
      if (canViewAccount) {
        dto.accountEmail = user.email;
      }
      if (showMustChange) {
        dto.mustChangePassword = Boolean(user.mustChangePassword);
      }
    }

    return dto;
  }

  async toDetailDto(
    employee: Employee,
    viewer: User,
    ctx?: Pick<EmployeeListProjectionContext, 'assignmentDirection'>,
  ): Promise<EmployeeDetailDto> {
    const authz = await this.authorization.resolve(viewer.id);
    const isOwner = this.access.isOwner(viewer, employee);
    const base = await this.toListDto(employee, viewer, {
      canViewWorkContacts: await this.access.canViewWorkContacts(
        viewer,
        employee,
        authz,
      ),
      completenessPercent: 0,
      assignmentDirection: ctx?.assignmentDirection ?? null,
    });
    const { completenessPercent: _drop, ...rest } = base;
    const dto: EmployeeDetailDto = { ...rest };

    if (canViewTeamComment(authz)) {
      dto.comment = employee.comment;
    }
    if (canViewAdminComment(authz)) {
      dto.adminComment = employee.adminComment;
    }
    if (canViewPersonalContacts(authz, isOwner)) {
      dto.personalPhoneNumber = employee.personalPhoneNumber;
      dto.personalTelegram = employee.personalTelegram;
      dto.personalEmail = employee.personalEmail;
    }

    return dto;
  }

  async buildDetailPermissions(viewer: User, employee: Employee) {
    const authz = await this.authorization.resolve(viewer.id);
    const inManagedDept = await this.access.isTargetInManagedDepartments(
      viewer,
      employee,
      authz,
    );
    const isOwner = this.access.isOwner(viewer, employee);
    const hasAccount = employee.userId != null;
    const isSelf = employee.userId === viewer.id;

    const canViewComment = canViewTeamComment(authz);
    const canEditComment = await this.access.canEditComment(viewer, employee);
    const viewAdminComment = canViewAdminComment(authz);
    const editAdminComment = viewAdminComment;
    const viewPersonal = canViewPersonalContacts(authz, isOwner);
    const canEditPersonalContacts = canWritePersonalOnTarget(
      authz,
      inManagedDept,
    );
    const canViewTarget = await this.access.canViewEmployeeProfile(
      viewer,
      employee,
    );
    const canExportProfilePdf = canExportProfile(authz, canViewTarget);

    const permissions: Record<string, boolean> = {
      canEditProfile: await this.access.canEditEmployeeProfile(
        viewer,
        employee,
      ),
      canEditOrgAssignment: canChangeAssignmentOnTarget(authz, inManagedDept),
      canEditSchedule: await this.access.canEditEmployeeSchedule(
        viewer,
        employee,
      ),
      canResetPassword: canResetPassword(authz, hasAccount),
      canCreateAccount: await this.access.canCreateEmployeeAccount(
        viewer,
        employee,
        authz,
      ),
      canManageAccount: canDestructivelyManageAccount(
        authz,
        hasAccount,
        isSelf,
      ),
      canDeleteEmployee: canDeleteEmployee(authz, isSelf),
      canViewAccountDetails: canViewAccountDetails(authz, isOwner),
    };

    if (canViewComment || canEditComment) {
      permissions['canViewComment'] = canViewComment;
      permissions['canEditComment'] = canEditComment;
    }
    if (viewAdminComment || editAdminComment) {
      permissions['canViewAdminComment'] = viewAdminComment;
      permissions['canEditAdminComment'] = editAdminComment;
    }
    if (viewPersonal || canEditPersonalContacts) {
      permissions['canViewPersonalContacts'] = viewPersonal;
      permissions['canEditPersonalContacts'] = canEditPersonalContacts;
    }
    if (canExportProfilePdf) {
      permissions['canExportProfilePdf'] = canExportProfilePdf;
    }

    const targetRole = employee.role;
    if (authz.isAdminEquivalent) {
      permissions['canViewProfileVisibilityOverride'] = true;
      permissions['canViewAbsenceVisibilityOverride'] = true;
      permissions['canViewShowAbsenceTypeToPeersOverride'] = true;
    }
    if (
      await this.access.canEditVisibilityOverrides(viewer, targetRole, authz)
    ) {
      permissions['canEditProfileVisibilityOverride'] = true;
      permissions['canEditAbsenceVisibilityOverride'] = true;
      permissions['canEditShowAbsenceTypeToPeersOverride'] = true;
    }

    return permissions;
  }

  private directionRef(
    id: string | null | undefined,
    name: string | null | undefined,
  ): DisplayedDirectionRef | null {
    if (!id) return null;
    return { id, name: name ?? null };
  }
}
