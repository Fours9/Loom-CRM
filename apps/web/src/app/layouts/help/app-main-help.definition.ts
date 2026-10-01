import type { HelpDomainBundle } from '../../core/help/help-tour.models';
import type { HelpRouteDescriptor } from '../../core/help/help-page.models';
import { helpTourRegistry } from '../../core/help/help-tour.registry';
import { helpPageContextRegistry } from '../../core/help/help-page-context.registry';
import { navigationLabel } from '../../core/navigation/navigation.model';

export const APP_MAIN_HELP_BUNDLE: HelpDomainBundle = {
  tours: [
    {
      id: 'app.main',
      steps: [
        {
          id: 'main-nav',
          title: 'Навігація',
          body: 'Тут відкривається навігація по основних розділах Loom. На великому екрані розділи також доступні в лівій панелі.',
          anchorId: 'shell.navigation',
        },
        {
          id: 'main-theme',
          title: 'Тема',
          body: 'Перемикає світлу або темну тему інтерфейсу.',
          anchorId: 'shell.theme',
        },
        {
          id: 'main-inbox',
          title: 'Сповіщення',
          body: 'Список сповіщень про анкети, заявки та інші події.',
          anchorId: 'shell.inbox',
        },
        {
          id: 'main-content',
          title: 'Робоча область',
          body: 'Праворуч відкривається вміст обраного розділу. Підказки для конкретного екрана — у меню «?» → назва сторінки.',
        },
      ],
    },
  ],
};

/** Only cross-cutting stubs not owned by feature help bundles. */
export const APP_ROUTE_HELP_DESCRIPTORS: readonly HelpRouteDescriptor[] = [
  {
    id: 'route.statistics',
    pattern: ['statistics'],
    exact: true,
    context: {
      label: navigationLabel('/statistics'),
      tourId: null,
      soon: true,
    },
  },
];

export function registerAppMainHelp(): void {
  helpTourRegistry.register(APP_MAIN_HELP_BUNDLE);
  helpPageContextRegistry.register(APP_ROUTE_HELP_DESCRIPTORS);
}
