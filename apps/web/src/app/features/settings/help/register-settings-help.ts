import type { HelpRouteDescriptor } from '../../../core/help/help-page.models';
import { helpTourRegistry } from '../../../core/help/help-tour.registry';
import { helpPageContextRegistry } from '../../../core/help/help-page-context.registry';
import { navigationLabel } from '../../../core/navigation/navigation.model';
import { SETTINGS_HELP_BUNDLE } from './settings-help.definition';

export const SETTINGS_ROUTE_HELP_DESCRIPTORS: readonly HelpRouteDescriptor[] = [
  {
    id: 'route.settings.shell',
    pattern: ['settings'],
    exact: true,
    context: {
      label: navigationLabel('/settings'),
      tourId: 'settings.shell',
      soon: false,
    },
  },
  {
    id: 'route.settings.access-roles',
    pattern: ['settings', 'access-roles'],
    exact: true,
    context: {
      label: 'Доступи',
      tourId: 'settings.access-roles',
      soon: false,
    },
  },
];

export function registerSettingsHelp(): void {
  helpTourRegistry.register(SETTINGS_HELP_BUNDLE);
  helpPageContextRegistry.register(SETTINGS_ROUTE_HELP_DESCRIPTORS);
}
