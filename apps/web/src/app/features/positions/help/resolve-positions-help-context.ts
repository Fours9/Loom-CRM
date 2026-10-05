import type { HelpPageDescriptor } from '../../../core/help/help-page.models';
import {
  positionCatalogTabLabel,
  positionPageTabLabel,
  type PositionCatalogTabId,
  type PositionPageTabId,
} from '../position-help-context.model';

/** Dialog kinds that own help while a Positions modal is open. */
export type PositionHelpDialogKind =
  | 'position'
  | 'direction'
  | 'department'
  | 'skill-group'
  | 'skill'
  | 'work-format'
  | 'employment-type'
  | null;

export type PositionSettingsHelpDialogKind =
  | 'work-format'
  | 'employment-type'
  | null;

export type PositionsHelpResolveInput = {
  pageTab: PositionPageTabId;
  selectedPositionId: string | null;
  catalogTab: PositionCatalogTabId;
  standalone: boolean;
  dialogKind?: PositionHelpDialogKind;
};

export function resolvePositionDialogKind(input: {
  positionDialogOpen: boolean;
  catalogDialog: 'direction' | 'department' | 'group' | 'skill' | null;
  settingsDialog: PositionSettingsHelpDialogKind;
}): PositionHelpDialogKind {
  if (input.positionDialogOpen) return 'position';
  switch (input.catalogDialog) {
    case 'direction':
      return 'direction';
    case 'department':
      return 'department';
    case 'group':
      return 'skill-group';
    case 'skill':
      return 'skill';
    default:
      break;
  }
  if (input.settingsDialog === 'work-format') return 'work-format';
  if (input.settingsDialog === 'employment-type') return 'employment-type';
  return null;
}

function dialogTour(kind: Exclude<PositionHelpDialogKind, null>): HelpPageDescriptor {
  const labels: Record<Exclude<PositionHelpDialogKind, null>, string> = {
    position: 'Посада',
    direction: 'Напрямок',
    department: 'Відділ',
    'skill-group': 'Група навичок',
    skill: 'Навичка',
    'work-format': 'Формат роботи',
    'employment-type': 'Тип зайнятості',
  };
  return {
    label: labels[kind],
    tourId: `positions.dialog.${kind}`,
    soon: false,
  };
}

/**
 * Precedence:
 * 1. dialog open → positions.dialog.*
 * 2. standalone catalog → position.{catalogTab}
 * 3. formats (settings) → formats
 * 4. management + selected → position.{catalogTab}
 * 5. management + none → management
 */
export function resolvePositionsHelpContext(
  input: PositionsHelpResolveInput,
): HelpPageDescriptor {
  if (input.dialogKind) {
    return dialogTour(input.dialogKind);
  }
  if (input.standalone) {
    return {
      label: positionCatalogTabLabel(input.catalogTab),
      tourId: `positions.position.${input.catalogTab}`,
      soon: false,
    };
  }
  if (input.pageTab === 'settings') {
    return {
      label: positionPageTabLabel('settings'),
      tourId: 'positions.formats',
      soon: false,
    };
  }
  if (input.selectedPositionId) {
    return {
      label: positionCatalogTabLabel(input.catalogTab),
      tourId: `positions.position.${input.catalogTab}`,
      soon: false,
    };
  }
  return {
    label: positionPageTabLabel('management'),
    tourId: 'positions.management',
    soon: false,
  };
}

export function positionsHelpTourIds(): readonly string[] {
  return [
    'positions.management',
    'positions.formats',
    'positions.position.skills',
    'positions.position.goals',
    'positions.position.duties',
    'positions.dialog.position',
    'positions.dialog.direction',
    'positions.dialog.department',
    'positions.dialog.skill-group',
    'positions.dialog.skill',
    'positions.dialog.work-format',
    'positions.dialog.employment-type',
  ];
}
