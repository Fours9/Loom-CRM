import type { HelpTourId } from './help-tour.models';

export type HelpPageDescriptor = {
  label: string;
  tourId: HelpTourId | null;
  soon: boolean;
};

export type HelpRouteDescriptor = {
  id: string;
  /** Path segments after leading slash; `:param` or trailing `**` allowed */
  pattern: readonly string[];
  /** true = exact segment count; false or `**` = subtree prefix */
  exact: boolean;
  context: HelpPageDescriptor;
};

export const HELP_PAGE_FALLBACK: HelpPageDescriptor = {
  label: 'Сторінка',
  tourId: null,
  soon: true,
};
