import { ABOUT_SUBTAB_DEFS } from '@loom/employee-about-catalog';
import type { AboutSubtabId } from '@loom/employee-about-catalog';
import type { HelpPageDescriptor } from '../../../core/help/help-page.models';
import type { PeopleProfileTabId } from '../people-profile-tabs';
import { peopleProfileTabLabel } from '../people-profile-tabs';
import {
  employeeDataTabLabel,
  type EmployeeDataTabId,
} from '../employee-data-tabs.model';

export type PeopleWorkSubtabId =
  | 'position'
  | 'schedule'
  | 'requests'
  | 'calendar';

export type PeopleAdminSubtabId = 'history' | 'account' | 'roleAccess';

export type PeopleMetricsSubtabId = 'skills';

export type PeopleHelpDialogKind = 'assignment' | 'document-upload' | null;

export type PeopleHelpResolveInput = {
  tab: PeopleProfileTabId;
  dataSubtab: EmployeeDataTabId;
  aboutSubtab: AboutSubtabId | null;
  workSubtab: PeopleWorkSubtabId;
  metricsSubtab: PeopleMetricsSubtabId;
  adminSubtab: PeopleAdminSubtabId;
  dialogKind: PeopleHelpDialogKind;
};

const DIALOG_LABELS: Record<Exclude<PeopleHelpDialogKind, null>, string> = {
  assignment: 'Призначення',
  'document-upload': 'Завантаження документів',
};

const DIALOG_TOUR_IDS: Record<Exclude<PeopleHelpDialogKind, null>, string> = {
  assignment: 'people.dialog.assignment',
  'document-upload': 'people.dialog.document-upload',
};

const WORK_LABELS: Record<PeopleWorkSubtabId, string> = {
  position: 'Посада',
  schedule: 'Графік роботи',
  requests: 'Заявки',
  calendar: 'Календар',
};

const ADMIN_LABELS: Record<PeopleAdminSubtabId, string> = {
  history: 'Історія',
  account: 'Акаунт',
  roleAccess: 'Роль та допуски',
};

function aboutLabel(id: AboutSubtabId): string {
  return ABOUT_SUBTAB_DEFS.find((s) => s.id === id)?.labelUa ?? id;
}

function tourKey(id: string): string {
  return id.replaceAll('_', '-');
}

/** Pure People profile → HelpPageDescriptor (single owner projection). */
export function resolvePeopleHelpContext(
  input: PeopleHelpResolveInput,
): HelpPageDescriptor {
  if (input.dialogKind) {
    return {
      label: DIALOG_LABELS[input.dialogKind],
      tourId: DIALOG_TOUR_IDS[input.dialogKind],
      soon: false,
    };
  }

  switch (input.tab) {
    case 'data':
      return {
        label: employeeDataTabLabel(input.dataSubtab),
        tourId: `people.data.${input.dataSubtab}`,
        soon: false,
      };
    case 'absences':
      return {
        label: WORK_LABELS[input.workSubtab],
        tourId: `people.work.${input.workSubtab}`,
        soon: false,
      };
    case 'documents':
      return {
        label: peopleProfileTabLabel('documents'),
        tourId: 'people.documents',
        soon: false,
      };
    case 'questionnaires':
      return {
        label: peopleProfileTabLabel('questionnaires'),
        tourId: 'questionnaires.employee',
        soon: false,
      };
    case 'about':
      if (!input.aboutSubtab) {
        return {
          label: peopleProfileTabLabel('about'),
          tourId: null,
          soon: true,
        };
      }
      return {
        label: aboutLabel(input.aboutSubtab),
        tourId: `people.about.${tourKey(input.aboutSubtab)}`,
        soon: false,
      };
    case 'metrics':
      return {
        label: 'Матриця навичок',
        tourId: 'people.metrics.skills',
        soon: false,
      };
    case 'administration':
      return {
        label: ADMIN_LABELS[input.adminSubtab],
        tourId: `people.admin.${input.adminSubtab}`,
        soon: false,
      };
    default:
      return {
        label: peopleProfileTabLabel(input.tab),
        tourId: null,
        soon: true,
      };
  }
}

/** All ready People feature tour ids (for consistency tests). */
export function peopleHelpTourIds(): readonly string[] {
  return [
    'people.data.basics',
    'people.data.contacts',
    'people.data.dates',
    'people.work.position',
    'people.work.schedule',
    'people.work.requests',
    'people.work.calendar',
    'people.documents',
    'people.about.family-home',
    'people.about.celebrations',
    'people.about.hobbies',
    'people.about.strengths',
    'people.about.work-style',
    'people.about.experience',
    'people.about.life-goals',
    'people.metrics.skills',
    'people.admin.history',
    'people.admin.account',
    'people.admin.roleAccess',
    'people.directory',
    'people.create',
    'people.dialog.assignment',
    'people.dialog.document-upload',
  ];
}
