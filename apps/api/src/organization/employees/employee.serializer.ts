import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { Employee } from './employee.entity';
import { User } from '../../platform/identity/user.entity';
import { UserStatus } from '../../platform/identity/user.enums';
import { EmployeeAccessService } from '../access/employee-access.service';
import { canMutateEmployeeOrgAssignment } from './can-mutate-employee-org-assignment.policy';
import {
  resolveEmployeeDisplayedDirection,
  type DisplayedDirectionRef,
} from './resolve-employee-displayed-direction';

export type AccountStatus = 'active' | 'deactivated';

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
  /** Current EA direction when preloaded (list/detail). */
  assignmentDirection?: DisplayedDirectionRef | null;
};

@Injectable()
export class EmployeeSerializer {
  constructor(private readonly access: EmployeeAccessService) {}

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
    const showWorkContacts =
      ctx?.canViewWorkContacts ??
      (await this.access.canViewWorkContacts(viewer, employee));
    const canViewAccount = this.access.canViewAccountDetails(viewer, employee);
    const isOwner = this.access.isOwner(viewer, employee);
    const showMustChange = this.access.isAdmin(viewer) || isOwner;
    const hasAccount = employee.userId != null;

    const direction = resolveEmployeeDisplayedDirection({
      assignmentDirection: ctx?.assignmentDirection ?? null,
      positionDirection: this.directionRef(employee.position?.directionId, employee.position?.direction?.name),
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
      isDepartmentManager: Boolean(employee.isDepartmentManager),
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
    const base = await this.toListDto(employee, viewer, {
      canViewWorkContacts: await this.access.canViewWorkContacts(
        viewer,
        employee,
      ),
      completenessPercent: 0,
      assignmentDirection: ctx?.assignmentDirection ?? null,
    });
    const { completenessPercent: _drop, ...rest } = base;
    const dto: EmployeeDetailDto = { ...rest };

    if (this.access.canViewComment(viewer, employee)) {
      dto.comment = employee.comment;
    }
    if (this.access.canViewAdminComment(viewer)) {
      dto.adminComment = employee.adminComment;
    }
    if (this.access.canViewPersonalContacts(viewer)) {
      dto.personalPhoneNumber = employee.personalPhoneNumber;
      dto.personalTelegram = employee.personalTelegram;
      dto.personalEmail = employee.personalEmail;
    }

    return dto;
  }

  async buildDetailPermissions(viewer: User, employee: Employee) {
    const canViewComment = this.access.canViewComment(viewer, employee);
    const canEditComment = await this.access.canEditComment(viewer, employee);
    const canViewAdminComment = this.access.canViewAdminComment(viewer);
    const canEditAdminComment = this.access.canEditAdminComment(viewer);
    const canViewPersonalContacts = this.access.canViewPersonalContacts(viewer);
    const canEditPersonalContacts = this.access.canEditPersonalContacts(viewer);
    const canExportProfilePdf = await this.access.canExportProfilePdf(
      viewer,
      employee,
    );

    const permissions: Record<string, boolean> = {
      canEditProfile: await this.access.canEditEmployeeProfile(
        viewer,
        employee,
      ),
      canEditOrgAssignment: canMutateEmployeeOrgAssignment(viewer),
      canEditSchedule: await this.access.canEditEmployeeSchedule(
        viewer,
        employee,
      ),
      canResetPassword:
        this.access.canResetEmployeePassword(viewer) &&
        employee.userId != null,
      canCreateAccount: this.access.canCreateEmployeeAccount(viewer, employee),
      canManageAccount: this.access.canManageExistingEmployeeAccount(
        viewer,
        employee,
      ),
      canViewAccountDetails: this.access.canViewAccountDetails(
        viewer,
        employee,
      ),
    };

    if (canViewComment || canEditComment) {
      permissions['canViewComment'] = canViewComment;
      permissions['canEditComment'] = canEditComment;
    }
    if (canViewAdminComment || canEditAdminComment) {
      permissions['canViewAdminComment'] = canViewAdminComment;
      permissions['canEditAdminComment'] = canEditAdminComment;
    }
    if (canViewPersonalContacts || canEditPersonalContacts) {
      permissions['canViewPersonalContacts'] = canViewPersonalContacts;
      permissions['canEditPersonalContacts'] = canEditPersonalContacts;
    }
    if (canExportProfilePdf) {
      permissions['canExportProfilePdf'] = canExportProfilePdf;
    }

    const targetRole = employee.role;
    if (this.access.canViewVisibilityOverrides(viewer, targetRole)) {
      permissions['canViewProfileVisibilityOverride'] = true;
      permissions['canViewAbsenceVisibilityOverride'] = true;
      permissions['canViewShowAbsenceTypeToPeersOverride'] = true;
    }
    if (this.access.canEditVisibilityOverrides(viewer, targetRole)) {
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
