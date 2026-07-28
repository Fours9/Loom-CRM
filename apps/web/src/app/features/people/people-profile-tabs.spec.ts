import { Permission } from '@loom/contracts-auth';
import type { EmployeeProfileCapabilities } from '@loom/contracts-employees';
import {
  resolvePeopleProfileTab,
  visiblePeopleProfileTabs,
  type PeopleProfileTabId,
} from './people-profile-tabs';

const capsViewHistory: EmployeeProfileCapabilities = {
  canEditBasic: false,
  canEditEmployment: false,
  canViewPersonal: false,
  canEditPersonal: false,
  canViewEmergencyContact: false,
  canEditEmergencyContact: false,
  canChangeStatus: false,
  canExport: false,
  canViewHistory: true,
  canStartOnboarding: false,
  canAssignQuestionnaire: false,
};

const capsNoHistory: EmployeeProfileCapabilities = {
  ...capsViewHistory,
  canViewHistory: false,
};

const allPerms: Permission[] = [
  Permission.AbsencesCalendarView,
  Permission.DocumentsView,
];

describe('visiblePeopleProfileTabs', () => {
  it('always includes data, metrics, later', () => {
    const tabs = visiblePeopleProfileTabs({
      capabilities: capsNoHistory,
      permissions: [],
    });
    expect(tabs.map((t) => t.id)).toEqual(['data', 'metrics', 'later']);
  });

  it('hides history when canViewHistory is false', () => {
    const tabs = visiblePeopleProfileTabs({
      capabilities: capsNoHistory,
      permissions: allPerms,
    });
    expect(tabs.some((t) => t.id === 'history')).toBe(false);
  });

  it('shows history when canViewHistory is true', () => {
    const tabs = visiblePeopleProfileTabs({
      capabilities: capsViewHistory,
      permissions: allPerms,
    });
    expect(tabs.some((t) => t.id === 'history')).toBe(true);
  });

  it('hides documents without documents.view', () => {
    const tabs = visiblePeopleProfileTabs({
      capabilities: capsViewHistory,
      permissions: [Permission.AbsencesCalendarView],
    });
    expect(tabs.some((t) => t.id === 'documents')).toBe(false);
  });

  it('hides absences without absences.calendar.view', () => {
    const tabs = visiblePeopleProfileTabs({
      capabilities: capsViewHistory,
      permissions: [Permission.DocumentsView],
    });
    expect(tabs.some((t) => t.id === 'absences')).toBe(false);
  });
});

describe('resolvePeopleProfileTab', () => {
  const visible = visiblePeopleProfileTabs({
    capabilities: capsNoHistory,
    permissions: [Permission.DocumentsView],
  });

  it('falls back to data when history is hidden', () => {
    expect(resolvePeopleProfileTab('history', visible)).toBe('data');
  });

  it('keeps visible documents', () => {
    expect(resolvePeopleProfileTab('documents', visible)).toBe('documents');
  });

  it('falls back for unknown/hidden request', () => {
    expect(
      resolvePeopleProfileTab('absences' as PeopleProfileTabId, visible),
    ).toBe('data');
  });
});
