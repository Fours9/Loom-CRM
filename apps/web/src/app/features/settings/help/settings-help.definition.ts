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
    helpTour(
      'settings.dialog.role',
      'Роль доступу',
      'Форма створення або редагування ролі акаунта: назва, набір прав і поверхні меню.',
      [
        {
          id: 'settings.dialog.role__name',
          title: 'Назва ролі',
          body: 'Тут задається відображувана назва ролі. Вона зʼявиться в списку доступів і при призначенні в картці працівника.',
          anchorId: 'settings.dialog.role.name',
        },
        {
          id: 'settings.dialog.role__preset',
          title: 'Набір прав',
          body: 'Це поле визначає базовий набір дозволів API. Для системних ролей значення може бути зафіксоване.',
          anchorId: 'settings.dialog.role.preset',
        },
        {
          id: 'settings.dialog.role__surfaces',
          title: 'Екрани меню',
          body: 'Оберіть поверхні інтерфейсу, які бачать користувачі з цією роллю. Адмін-еквівалент відкриває всі екрани.',
          anchorId: 'settings.dialog.role.surfaces',
        },
        {
          id: 'settings.dialog.role__save',
          title: 'Збереження',
          body: 'Записує роль. Скасування закриває форму без змін у довіднику.',
          anchorId: 'settings.dialog.role.save',
        },
        {
          id: 'settings.dialog.role__tip',
          title: 'Призначення',
          body: 'Збережена роль зʼявляється в списку доступів і може бути призначена в картці працівника.',
        },
      ],
    ),
  ],
};
