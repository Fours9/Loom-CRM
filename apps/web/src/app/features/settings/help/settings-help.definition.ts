import type { HelpDomainBundle } from '../../../core/help/help-tour.models';
import { helpTour } from '../../../layouts/help/help-tour.factory';

/** Copy SoT for Settings help tours. */
export const SETTINGS_HELP_BUNDLE: HelpDomainBundle = {
  tours: [
    helpTour(
      'settings.shell',
      'Налаштування',
      'Оболонка платформених налаштувань LoomCRM. Довідники посад — у «Керуванні посадами»; тут — доступи та майбутні параметри.',
      [
        {
          id: 'settings.shell__nav',
          title: 'Навігація налаштувань',
          body: 'Якщо вашій ролі доступне керування доступами, зʼявиться пункт «Доступи». Інакше лишається підказка з посиланням на посади.',
          anchorId: 'settings.shell',
        },
        {
          id: 'settings.shell__access',
          title: 'Доступи',
          body: 'Відкриває екран ролей облікових записів і поверхонь меню. Пункт зʼявляється лише за відповідного дозволу в ролі — без нього крок просто пропускається.',
          anchorId: 'settings.access-link',
        },
        {
          id: 'settings.shell__tip',
          title: 'Посади',
          body: 'Напрямки, відділи, посади й навички редагуються в розділі «Керування посадами», не всередині цієї оболонки.',
        },
      ],
    ),
    helpTour(
      'settings.access-roles',
      'Доступи',
      'Ролі акаунтів визначають права в API та перелік екранів. Керівництво в структурі задається посадою, а не роллю акаунта.',
      [
        {
          id: 'settings.access-roles__create',
          title: 'Нова роль',
          body: 'Відкриває діалог створення ролі: назва, права й поверхні меню. Після збереження роль можна призначити в картці працівника.',
          anchorId: 'settings.access-roles.create',
        },
        {
          id: 'settings.access-roles__list',
          title: 'Список ролей',
          body: 'Оберіть роль, щоб переглянути або змінити права. Видалення/редагування — з видимих дій у списку.',
          anchorId: 'settings.access-roles',
        },
        {
          id: 'settings.access-roles__tip',
          title: 'Вплив',
          body: 'Зміна ролі впливає на меню й API для користувачів із цією роллю. Індивідуальні перевизначення лишаються в картці працівника («Роль та допуски»).',
        },
      ],
    ),
  ],
};
