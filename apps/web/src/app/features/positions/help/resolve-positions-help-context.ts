import type { HelpPageDescriptor } from '../../../core/help/help-page.models';
import {
  positionCatalogTabLabel,
  positionPageTabLabel,
  type PositionCatalogTabId,
  type PositionPageTabId,
} from '../position-help-context.model';

export type PositionsHelpResolveInput = {
  pageTab: PositionPageTabId;
  selectedPositionId: string | null;
  catalogTab: PositionCatalogTabId;
  standalone: boolean;
};

/**
 * Precedence:
 * 1. standalone catalog → position.{catalogTab}
 * 2. formats (settings) → formats (wins over leftover selection)
 * 3. management + selected → position.{catalogTab}
 * 4. management + none → management
 */
export function resolvePositionsHelpContext(
  input: PositionsHelpResolveInput,
): HelpPageDescriptor {
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
  ];
}
