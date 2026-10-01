export type HelpTourId = string;

export type HelpStep = {
  id: string;
  title: string;
  body: string;
  /** data-help-id value; omit for copy-only steps */
  anchorId?: string;
};

export type HelpTourDefinition = {
  id: HelpTourId;
  steps: readonly HelpStep[];
};

export type HelpCalloutDefinition = {
  id: string;
  version: number;
  body: string;
};

export type HelpDomainBundle = {
  tours: readonly HelpTourDefinition[];
  callouts?: readonly HelpCalloutDefinition[];
};

export type HelpTourSession = {
  tourId: HelpTourId;
  stepIndex: number;
  stepCount: number;
  step: HelpStep;
  hole: { top: number; left: number; width: number; height: number } | null;
  triggerEl: HTMLElement | null;
};

export type HelpCloseReason =
  | 'user'
  | 'done'
  | 'route-change'
  | 'empty'
  | 'replace';
