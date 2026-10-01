import type { HelpRouteDescriptor } from '../../../core/help/help-page.models';
import { helpTourRegistry } from '../../../core/help/help-tour.registry';
import { helpPageContextRegistry } from '../../../core/help/help-page-context.registry';
import { navigationLabel } from '../../../core/navigation/navigation.model';
import { ABSENCES_HELP_BUNDLE } from './absences-help.definition';

export const ABSENCES_ROUTE_HELP_DESCRIPTORS: readonly HelpRouteDescriptor[] = [
  {
    id: 'route.absences.dashboard',
    pattern: ['absences'],
    exact: true,
    context: {
      label: navigationLabel('/absences'),
      tourId: 'absences.dashboard.schedule',
      soon: false,
    },
  },
  {
    id: 'route.absences.employees',
    pattern: ['absences', 'employees'],
    exact: true,
    context: {
      label: 'Працівники',
      tourId: 'absences.employees',
      soon: false,
    },
  },
  {
    id: 'route.absences.employee-detail',
    pattern: ['absences', 'employees', ':id'],
    exact: true,
    context: {
      label: 'Працівник',
      tourId: 'absences.employee-detail.schedule',
      soon: false,
    },
  },
  {
    id: 'route.absences.requests',
    pattern: ['absences', 'requests'],
    exact: true,
    context: {
      label: 'Заявки',
      tourId: 'absences.requests',
      soon: false,
    },
  },
  {
    id: 'route.absences.request-create',
    pattern: ['absences', 'requests', 'new'],
    exact: true,
    context: {
      label: 'Нова заявка',
      tourId: 'absences.request-create',
      soon: false,
    },
  },
  {
    id: 'route.absences.request-detail',
    pattern: ['absences', 'requests', ':id'],
    exact: true,
    context: {
      label: 'Заявка',
      tourId: 'absences.request-detail',
      soon: false,
    },
  },
  {
    id: 'route.absences.calendar',
    pattern: ['absences', 'calendar'],
    exact: true,
    context: {
      label: 'Календар',
      tourId: 'absences.calendar',
      soon: false,
    },
  },
  {
    id: 'route.absences.admin',
    pattern: ['absences', 'admin'],
    exact: true,
    context: {
      label: 'Адмін',
      tourId: 'absences.admin',
      soon: false,
    },
  },
];

export function registerAbsencesHelp(): void {
  helpTourRegistry.register(ABSENCES_HELP_BUNDLE);
  helpPageContextRegistry.register(ABSENCES_ROUTE_HELP_DESCRIPTORS);
}
