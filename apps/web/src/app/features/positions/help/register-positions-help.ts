import type { HelpRouteDescriptor } from '../../../core/help/help-page.models';
import { helpTourRegistry } from '../../../core/help/help-tour.registry';
import { helpPageContextRegistry } from '../../../core/help/help-page-context.registry';
import { navigationLabel } from '../../../core/navigation/navigation.model';
import { POSITIONS_HELP_BUNDLE } from './positions-help.definition';

export const POSITIONS_ROUTE_HELP_DESCRIPTORS: readonly HelpRouteDescriptor[] = [
  {
    id: 'route.positions',
    pattern: ['positions'],
    exact: true,
    context: {
      label: navigationLabel('/positions'),
      tourId: 'positions.management',
      soon: false,
    },
  },
  {
    id: 'route.position-catalog',
    pattern: ['positions', ':id', 'catalog'],
    exact: true,
    context: {
      label: 'Каталог посади',
      tourId: 'positions.position.skills',
      soon: false,
    },
  },
];

export function registerPositionsHelp(): void {
  helpTourRegistry.register(POSITIONS_HELP_BUNDLE);
  helpPageContextRegistry.register(POSITIONS_ROUTE_HELP_DESCRIPTORS);
}
