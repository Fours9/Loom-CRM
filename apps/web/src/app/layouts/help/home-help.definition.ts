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
      'Стартова сторінка LoomCRM: швидкі переходи до робочих розділів. Плитка «Статистика» — майбутній розділ, не готовий модуль звітів.',
      [
        {
          id: 'home.overview__tiles',
          title: 'Плитки розділів',
          body: '«Робочий календар» — заявки й командні події часу. «Працівники» — кадровий каталог. «Налаштування» — ролі й параметри. Натисніть плитку, щоб відкрити розділ.',
          anchorId: 'home.tiles',
        },
        {
          id: 'home.overview__tip',
          title: 'Статистика',
          body: 'Плитка «Статистика» веде на заглушку. Звітів і аналітики там ще немає — не очікуйте готових дашбордів у пілоті.',
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
