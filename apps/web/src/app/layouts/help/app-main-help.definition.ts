import { navigationLabel } from '../../core/navigation/navigation.model';
import type { HelpDomainBundle } from '../../core/help/help-tour.models';
import type { HelpRouteDescriptor } from '../../core/help/help-page.models';
import { helpTourRegistry } from '../../core/help/help-tour.registry';
import { helpPageContextRegistry } from '../../core/help/help-page-context.registry';

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

/** Route-level soon stubs + home (labels from navigation.model SoT). */
export const APP_ROUTE_HELP_DESCRIPTORS: readonly HelpRouteDescriptor[] = [
  {
    id: 'route.home',
    pattern: [],
    exact: true,
    context: {
      label: navigationLabel('/'),
      tourId: null,
      soon: true,
    },
  },
  {
    id: 'route.people',
    pattern: ['people'],
    exact: true,
    context: {
      label: navigationLabel('/people'),
      tourId: null,
      soon: true,
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
  {
    id: 'route.positions',
    pattern: ['positions'],
    exact: false,
    context: {
      label: navigationLabel('/positions'),
      tourId: null,
      soon: true,
    },
  },
  {
    id: 'route.absences',
    pattern: ['absences', '**'],
    exact: false,
    context: {
      label: navigationLabel('/absences'),
      tourId: null,
      soon: true,
    },
  },
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
  {
    id: 'route.settings',
    pattern: ['settings', '**'],
    exact: false,
    context: {
      label: navigationLabel('/settings'),
      tourId: null,
      soon: true,
    },
  },
];

export function registerAppMainHelp(): void {
  helpTourRegistry.register(APP_MAIN_HELP_BUNDLE);
  helpPageContextRegistry.register(APP_ROUTE_HELP_DESCRIPTORS);
}
