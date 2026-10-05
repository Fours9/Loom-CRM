import type { HelpDomainBundle } from '../../core/help/help-tour.models';
import type { HelpRouteDescriptor } from '../../core/help/help-page.models';
import { helpTourRegistry } from '../../core/help/help-tour.registry';
import { helpPageContextRegistry } from '../../core/help/help-page-context.registry';
import { helpTour } from './help-tour.factory';
import { navigationLabel } from '../../core/navigation/navigation.model';

export const HOME_HELP_BUNDLE: HelpDomainBundle = {
  tours: [
    helpTour(
      'home.overview',
      'Головна',
      'Стартова сторінка LoomCRM: швидкі переходи до вашого профілю та робочого календаря.',
      [
        {
          id: 'home.overview__tiles',
          title: 'Швидкі дії',
          body: '«Мій профіль» — картка працівника вашого акаунта. «Робочий календар» — заявки, календар і командні події часу. Оберіть картку, щоб перейти.',
          anchorId: 'home.tiles',
        },
      ],
    ),
  ],
};

export const HOME_ROUTE_HELP_DESCRIPTORS: readonly HelpRouteDescriptor[] = [
  {
    id: 'route.home',
    pattern: [],
    exact: true,
    context: {
      label: navigationLabel('/'),
      tourId: 'home.overview',
      soon: false,
    },
  },
];

export function registerHomeHelp(): void {
  helpTourRegistry.register(HOME_HELP_BUNDLE);
  helpPageContextRegistry.register(HOME_ROUTE_HELP_DESCRIPTORS);
}
