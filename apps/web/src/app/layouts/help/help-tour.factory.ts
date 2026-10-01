import type { HelpStep, HelpTourDefinition } from '../../core/help/help-tour.models';

/** Every tour starts with a stable copy-only intro (DoD 30). */
export function helpTour(
  id: string,
  title: string,
  body: string,
  extraSteps: readonly HelpStep[] = [],
): HelpTourDefinition {
  return {
    id,
    steps: [{ id: `${id}__intro`, title, body }, ...extraSteps],
  };
}
