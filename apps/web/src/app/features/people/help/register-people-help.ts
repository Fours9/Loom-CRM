import type { HelpRouteDescriptor } from '../../../core/help/help-page.models';
import { helpTourRegistry } from '../../../core/help/help-tour.registry';
import { helpPageContextRegistry } from '../../../core/help/help-page-context.registry';
import { navigationLabel } from '../../../core/navigation/navigation.model';
import { PEOPLE_HELP_BUNDLE } from './people-help.definition';

export const PEOPLE_ROUTE_HELP_DESCRIPTORS: readonly HelpRouteDescriptor[] = [
  {
    id: 'route.people.directory',
    pattern: ['people'],
    exact: true,
    context: {
      label: navigationLabel('/people'),
      tourId: 'people.directory',
      soon: false,
    },
  },
  {
    id: 'route.people.create',
    pattern: ['people', 'new'],
    exact: true,
    context: {
      label: 'Новий працівник',
      tourId: 'people.create',
      soon: false,
    },
  },
  {
    id: 'route.people.detail',
    pattern: ['people', ':id'],
    exact: true,
    context: {
      label: navigationLabel('/people'),
      tourId: null,
      soon: true,
    },
  },
];

export function registerPeopleHelp(): void {
  helpTourRegistry.register(PEOPLE_HELP_BUNDLE);
  helpPageContextRegistry.register(PEOPLE_ROUTE_HELP_DESCRIPTORS);
}
