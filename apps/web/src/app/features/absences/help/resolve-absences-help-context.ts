import type { HelpPageDescriptor } from '../../../core/help/help-page.models';
import {
  absenceSidePanelLabel,
  resolveAbsenceSidePanel,
  type AbsenceSidePanelId,
} from '../absence-side-panel.model';

export function resolveAbsencesDashboardHelpContext(
  sidePanel: AbsenceSidePanelId,
  canViewComment: boolean,
): HelpPageDescriptor {
  const panel = resolveAbsenceSidePanel(sidePanel, canViewComment);
  return {
    label: absenceSidePanelLabel(panel),
    tourId: `absences.dashboard.${panel}`,
    soon: false,
  };
}

export function resolveAbsencesEmployeeDetailHelpContext(
  sidePanel: AbsenceSidePanelId,
  canViewComment: boolean,
): HelpPageDescriptor {
  const panel = resolveAbsenceSidePanel(sidePanel, canViewComment);
  return {
    label: absenceSidePanelLabel(panel),
    tourId: `absences.employee-detail.${panel}`,
    soon: false,
  };
}

export function absencesHelpTourIds(): readonly string[] {
  return [
    'absences.dashboard.schedule',
    'absences.dashboard.comment',
    'absences.dashboard.requests',
    'absences.employee-detail.schedule',
    'absences.employee-detail.comment',
    'absences.employee-detail.requests',
    'absences.employees',
    'absences.requests',
    'absences.request-create',
    'absences.request-detail',
    'absences.calendar',
    'absences.admin',
  ];
}
