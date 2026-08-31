import { Permission } from '@loom/contracts-auth';
import type { EmployeeProfileCapabilities } from '@loom/contracts-employees';
import {
  canShowAccountAdminTab,
  canShowRoleAccessAdminTab,
  resolvePeopleProfileTab,
  visiblePeopleProfileTabs,
} from './people-profile-tabs';

const capsBase: EmployeeProfileCapabilities = {
  canEditBasic: false,
  canEditEmployment: false,
  canViewPersonal: false,
  canEditPersonal: false,
  canViewEmergencyContact: false,
  canEditEmergencyContact: false,
  canChangeStatus: false,
  canExport: false,
  canViewHistory: false,
  canStartOnboarding: false,
  canAssignQuestionnaire: false,
  canCreateAccount: false,
  canResetPassword: false,
  canManageAccount: false,
  canDeleteEmployee: false,
  canEditAdminAccess: false,
  canEditVisibilityOverrides: false,
  canViewAccountDetails: false,
  canEditAccountEmail: false,
};

const capsViewHistory: EmployeeProfileCapabilities = {
  ...capsBase,
  canViewHistory: true,
};

const capsNoHistory: EmployeeProfileCapabilities = {
  ...capsBase,
};

const capsAccountOnly: EmployeeProfileCapabilities = {
  ...capsBase,
  canCreateAccount: true,
};

const capsRoleAccessOnly: EmployeeProfileCapabilities = {
  ...capsBase,
  canEditAdminAccess: true,
};

const capsVisibilityOnly: EmployeeProfileCapabilities = {
  ...capsBase,
  canEditVisibilityOverrides: true,
};

const allPerms: Permission[] = [
  Permission.AbsencesCalendarView,
  Permission.DocumentsView,
];

describe('visiblePeopleProfileTabs', () => {
  it('always includes data, absences (Робота), metrics, later', () => {
    const tabs = visiblePeopleProfileTabs({
      capabilities: capsNoHistory,
      permissions: [],
    });
    expect(tabs.map((t) => t.id)).toEqual([
      'data',
      'absences',
      'metrics',
      'later',
    ]);
  });

  it('hides questionnaires without questionnaires.view', () => {
    const tabs = visiblePeopleProfileTabs({
      capabilities: capsViewHistory,
      permissions: allPerms,
    });
    expect(tabs.some((t) => t.id === 'questionnaires')).toBe(false);
  });

  it('shows questionnaires with questionnaires.view', () => {
    const tabs = visiblePeopleProfileTabs({
      capabilities: capsViewHistory,
      permissions: [...allPerms, Permission.QuestionnairesView],
    });
    expect(tabs.find((t) => t.id === 'questionnaires')?.label).toBe('Анкети');
  });

  it('hides administration when canViewHistory is false', () => {
    const tabs = visiblePeopleProfileTabs({
      capabilities: capsNoHistory,
      permissions: allPerms,
    });
    expect(tabs.some((t) => t.id === 'administration')).toBe(false);
  });

  it('shows administration when canViewHistory is true', () => {
    const tabs = visiblePeopleProfileTabs({
      capabilities: capsViewHistory,
      permissions: allPerms,
    });
    expect(tabs.find((t) => t.id === 'administration')?.label).toBe(
      'Адміністрування',
    );
  });

  it('shows administration when only account caps are true', () => {
    const tabs = visiblePeopleProfileTabs({
      capabilities: capsAccountOnly,
      permissions: allPerms,
    });
    expect(tabs.some((t) => t.id === 'administration')).toBe(true);
  });

  it('shows administration when canEditAdminAccess is true', () => {
    const tabs = visiblePeopleProfileTabs({
      capabilities: capsRoleAccessOnly,
      permissions: allPerms,
    });
    expect(tabs.some((t) => t.id === 'administration')).toBe(true);
  });

  it('shows administration when canEditVisibilityOverrides is true', () => {
    const tabs = visiblePeopleProfileTabs({
      capabilities: capsVisibilityOnly,
      permissions: allPerms,
    });
    expect(tabs.some((t) => t.id === 'administration')).toBe(true);
  });

  it('hides documents without documents.view', () => {
    const tabs = visiblePeopleProfileTabs({
      capabilities: capsViewHistory,
      permissions: [Permission.AbsencesCalendarView],
    });
    expect(tabs.some((t) => t.id === 'documents')).toBe(false);
  });

  it('always shows absences (Робота) tab for Посада', () => {
    const tabs = visiblePeopleProfileTabs({
      capabilities: capsViewHistory,
      permissions: [Permission.DocumentsView],
    });
    expect(tabs.some((t) => t.id === 'absences')).toBe(true);
  });

  it('labels absences tab as Робота', () => {
    const tabs = visiblePeopleProfileTabs({
      capabilities: capsViewHistory,
      permissions: [Permission.AbsencesCalendarView],
    });
    expect(tabs.find((t) => t.id === 'absences')?.label).toBe('Робота');
  });
});

describe('canShowAccountAdminTab', () => {
  it('is true for account lifecycle caps', () => {
    expect(canShowAccountAdminTab(capsAccountOnly)).toBe(true);
  });

  it('is true for canViewAccountDetails', () => {
    expect(
      canShowAccountAdminTab({
        ...capsBase,
        canViewAccountDetails: true,
      }),
    ).toBe(true);
  });

  it('is false without account caps', () => {
    expect(canShowAccountAdminTab(capsViewHistory)).toBe(false);
  });
});

describe('canShowRoleAccessAdminTab', () => {
  it('is true for canEditAdminAccess', () => {
    expect(canShowRoleAccessAdminTab(capsRoleAccessOnly)).toBe(true);
  });

  it('is true for canEditVisibilityOverrides', () => {
    expect(canShowRoleAccessAdminTab(capsVisibilityOnly)).toBe(true);
  });

  it('is false without role/access caps', () => {
    expect(canShowRoleAccessAdminTab(capsViewHistory)).toBe(false);
  });
});

describe('resolvePeopleProfileTab', () => {
  const visible = visiblePeopleProfileTabs({
    capabilities: capsNoHistory,
    permissions: [Permission.DocumentsView],
  });

  it('falls back to data when administration is hidden', () => {
    expect(resolvePeopleProfileTab('administration', visible)).toBe('data');
  });

  it('keeps visible documents', () => {
    expect(resolvePeopleProfileTab('documents', visible)).toBe('documents');
  });

  it('keeps visible absences (Робота)', () => {
    expect(resolvePeopleProfileTab('absences', visible)).toBe('absences');
  });
});
