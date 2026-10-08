import { employeeCalendarColorCss } from '../../../shared/employees/employee-calendar-color';
import { AbsenceRequestListItem } from '../core/api/models';
import { requestPeriod, requestTypeLabel } from '../core/api/request-view.util';
import { requestFrameTone } from '../shared/request-status-presentation';

export interface RequestListItemViewModel {
  id: string;
  employeeName: string;
  departmentName: string;
  positionName: string;
  typeLabel: string;
  periodLabel: string;
  statusGroup: string;
  frameTone: string;
  createdAt: string;
  calendarColor: string;
  canEdit: boolean;
  detailLink: string[];
  editLink: string[];
}

export function toRequestListItemVm(item: AbsenceRequestListItem): RequestListItemViewModel {
  return {
    id: item.id,
    employeeName: item.employeeName,
    departmentName: item.departmentName || '—',
    positionName: item.positionName || '—',
    typeLabel: requestTypeLabel(item.type),
    periodLabel: requestPeriod(item),
    statusGroup: item.statusGroup,
    frameTone: requestFrameTone(item.statusGroup),
    createdAt: item.createdAt,
    calendarColor: employeeCalendarColorCss(item.calendarColor),
    canEdit: !!item.canEdit,
    detailLink: ['/absences/requests', item.id],
    editLink: ['/absences/requests', item.id],
  };
}
