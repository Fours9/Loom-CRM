import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { helpDismissStorageKey } from './help-dismiss.keys';
import { resolveHelpAnchor, isVisibleAndUsable } from './help-anchor.resolve';
import { HelpTourRegistry, helpTourRegistry } from './help-tour.registry';
import { findUsableStepIndex } from './help-tour.navigate';
import { HelpFeatureOverrideStore } from './help-feature-override.store';
import { helpPageContextRegistry } from './help-page-context.registry';
import { matchHelpRoute } from './help-route.match';
import {
  QUESTIONNAIRE_HELP_BUNDLE,
  QUESTIONNAIRE_LIFECYCLE_BLURB,
} from '../../features/questionnaires/help/questionnaire-help.definition';
import { QUESTIONNAIRE_ROUTE_HELP_DESCRIPTORS } from '../../features/questionnaires/help/register-questionnaire-help';
import {
  APP_MAIN_HELP_BUNDLE,
  APP_ROUTE_HELP_DESCRIPTORS,
} from '../../layouts/help/app-main-help.definition';
import { registerAppHelp } from '../../help/register-app-help';
import {
  navigationDisplayLabel,
  navigationLabel,
} from '../navigation/navigation.model';
import { peopleProfileTabLabel } from '../../features/people/people-profile-tabs';

describe('QUESTIONNAIRE_LIFECYCLE_BLURB', () => {
  it('does not mention cross-employee 409 / create-new wording', () => {
    expect(QUESTIONNAIRE_LIFECYCLE_BLURB.toLowerCase()).not.toContain('409');
    expect(QUESTIONNAIRE_LIFECYCLE_BLURB).not.toMatch(/створіть нову/i);
    expect(QUESTIONNAIRE_LIFECYCLE_BLURB).toMatch(/у тому числі за іншим/i);
  });
});

describe('helpDismissStorageKey', () => {
  it('versioned keys keep v1 and v2 distinct (dismiss v1 does not hide v2)', () => {
    expect(helpDismissStorageKey('questionnaire.lifecycle', 1)).toBe(
      'loom.help.dismiss.questionnaire.lifecycle.v1',
    );
    expect(helpDismissStorageKey('questionnaire.lifecycle', 2)).toBe(
      'loom.help.dismiss.questionnaire.lifecycle.v2',
    );
  });
});

describe('findUsableStepIndex', () => {
  const steps = [
    { id: 'a', title: 'A', body: 'a', anchorId: 'q.open' },
    { id: 'b', title: 'B', body: 'b', anchorId: 'q.print' },
    { id: 'c', title: 'C', body: 'c', anchorId: 'q.more' },
    { id: 'd', title: 'D', body: 'copy only' },
  ];

  it('skips missing anchors and lands on q.more without requiring q.print', () => {
    const present = new Set(['q.open', 'q.more']);
    expect(
      findUsableStepIndex(steps, 1, 1, (id) => present.has(id)),
    ).toBe(2);
  });

  it('returns null when all remaining anchors missing (clean finish)', () => {
    expect(findUsableStepIndex(steps, 1, 1, () => false)).toBe(3);
    expect(
      findUsableStepIndex(steps.slice(0, 3), 1, 1, () => false),
    ).toBeNull();
  });
});

function fakeEl(opts: {
  width: number;
  height: number;
  disabled?: boolean;
}): HTMLElement {
  return {
    getBoundingClientRect: () => ({
      width: opts.width,
      height: opts.height,
      top: 0,
      left: 0,
      bottom: opts.height,
      right: opts.width,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }),
    hasAttribute: (n: string) => n === 'disabled' && !!opts.disabled,
    getAttribute: () => null,
  } as unknown as HTMLElement;
}

describe('resolveHelpAnchor', () => {
  it('picks first visible usable match among repeats', () => {
    const hidden = fakeEl({ width: 0, height: 0 });
    const visible = fakeEl({ width: 40, height: 20 });
    const doc = {
      querySelectorAll: () =>
        [hidden, visible] as unknown as NodeListOf<Element>,
    };
    expect(resolveHelpAnchor(doc, 'q.more')).toBe(visible);
  });
});

describe('isVisibleAndUsable', () => {
  it('rejects disabled elements', () => {
    expect(
      isVisibleAndUsable(fakeEl({ width: 10, height: 10, disabled: true })),
    ).toBe(false);
  });

  it('accepts sized elements', () => {
    expect(isVisibleAndUsable(fakeEl({ width: 10, height: 10 }))).toBe(true);
  });
});

describe('HelpTourRegistry + questionnaire bundle', () => {
  it('employee tour uses q.more and never q.print/q.delete/q.unpin anchors', () => {
    const registry = new HelpTourRegistry();
    registry.register(QUESTIONNAIRE_HELP_BUNDLE);
    const tour = registry.getTour('questionnaires.employee');
    const anchors = tour?.steps.map((s) => s.anchorId).filter(Boolean) ?? [];
    expect(anchors).toContain('q.more');
    expect(anchors).not.toContain('q.print');
    expect(anchors).not.toContain('q.delete');
    expect(anchors).not.toContain('q.unpin');
    expect(anchors).not.toContain('q.close');
  });

  it('directory tour includes create/attach/attachment-filter', () => {
    const registry = new HelpTourRegistry();
    registry.register(QUESTIONNAIRE_HELP_BUNDLE);
    const tour = registry.getTour('questionnaires.directory');
    const anchors = tour?.steps.map((s) => s.anchorId).filter(Boolean) ?? [];
    expect(anchors).toEqual(
      expect.arrayContaining(['q.create', 'q.attach', 'q.attachment-filter']),
    );
  });

  it('lifecycle callout is version 2', () => {
    const callout = QUESTIONNAIRE_HELP_BUNDLE.callouts?.[0];
    expect(callout?.id).toBe('questionnaire.lifecycle');
    expect(callout?.version).toBe(2);
    expect(callout?.body).toBe(QUESTIONNAIRE_LIFECYCLE_BLURB);
  });
});

describe('app.main tour', () => {
  it('uses shell.navigation (phone-safe), not drawer-only shell.nav', () => {
    const anchors =
      APP_MAIN_HELP_BUNDLE.tours[0]?.steps
        .map((s) => s.anchorId)
        .filter(Boolean) ?? [];
    expect(anchors).toContain('shell.navigation');
    expect(anchors).not.toContain('shell.nav');
  });
});

describe('registerAppHelp composition root', () => {
  beforeEach(() => {
    helpTourRegistry.clear();
    helpPageContextRegistry.clear();
  });

  it('registers questionnaire tours without visiting /questionnaires routes', () => {
    registerAppHelp();
    expect(helpTourRegistry.getTour('questionnaires.employee')).toBeTruthy();
    expect(helpTourRegistry.getTour('questionnaires.fill')).toBeTruthy();
    expect(helpTourRegistry.getTour('app.main')).toBeTruthy();
  });

  it('registerAppHelp can be invoked repeatedly; clear + re-register restores', () => {
    registerAppHelp();
    helpTourRegistry.clear();
    expect(helpTourRegistry.getTour('app.main')).toBeNull();
    registerAppHelp();
    expect(helpTourRegistry.getTour('app.main')).toBeTruthy();
    expect(helpTourRegistry.getTour('questionnaires.directory')).toBeTruthy();
  });
});

describe('matchHelpRoute specificity', () => {
  const descriptors = [
    ...QUESTIONNAIRE_ROUTE_HELP_DESCRIPTORS,
    ...APP_ROUTE_HELP_DESCRIPTORS,
  ];

  it('maps /questionnaires to directory', () => {
    expect(matchHelpRoute(descriptors, '/questionnaires')?.tourId).toBe(
      'questionnaires.directory',
    );
  });

  it('maps /questionnaires/:id to fill, never directory', () => {
    expect(
      matchHelpRoute(descriptors, '/questionnaires/abc-uuid')?.tourId,
    ).toBe('questionnaires.fill');
  });

  it('ignores query and fragment', () => {
    expect(
      matchHelpRoute(
        descriptors,
        '/questionnaires/abc-uuid?x=1#foo',
      )?.tourId,
    ).toBe('questionnaires.fill');
  });

  it('more-specific wins regardless of registration order', () => {
    const reversed = [...descriptors].reverse();
    expect(
      matchHelpRoute(reversed, '/questionnaires/abc')?.tourId,
    ).toBe('questionnaires.fill');
  });

  it('statistics uses base label without double soon', () => {
    const ctx = matchHelpRoute(descriptors, '/statistics');
    expect(ctx?.label).toBe('Статистика');
    expect(ctx?.soon).toBe(true);
    expect(ctx?.label).not.toContain('незабаром');
  });
});

describe('HelpFeatureOverrideStore REPLACE', () => {
  it('same owner set 10 times keeps exactly one override', () => {
    const store = new HelpFeatureOverrideStore();
    for (let i = 0; i < 10; i++) {
      store.set('people-profile', {
        label: `tab-${i}`,
        tourId: null,
        soon: true,
      });
    }
    expect(store.size()).toBe(1);
    expect(store.latest()?.label).toBe('tab-9');
  });

  it('data → questionnaires → about leaves only about', () => {
    const store = new HelpFeatureOverrideStore();
    store.set('people-profile', {
      label: 'Дані працівника',
      tourId: null,
      soon: true,
    });
    store.set('people-profile', {
      label: 'Анкети',
      tourId: 'questionnaires.employee',
      soon: false,
    });
    store.set('people-profile', {
      label: 'Про себе',
      tourId: null,
      soon: true,
    });
    expect(store.size()).toBe(1);
    expect(store.latest()?.label).toBe('Про себе');
  });

  it('clearAll drops overrides (NavigationStart contract)', () => {
    const store = new HelpFeatureOverrideStore();
    store.set('people-profile', {
      label: 'Анкети',
      tourId: 'questionnaires.employee',
      soon: false,
    });
    store.clearAll();
    expect(store.size()).toBe(0);
    expect(store.latest()).toBeNull();
  });
});

describe('label SoT', () => {
  it('peopleProfileTabLabel uses People tabs catalog', () => {
    expect(peopleProfileTabLabel('questionnaires')).toBe('Анкети');
    expect(peopleProfileTabLabel('about')).toBe('Про себе');
  });

  it('navigation Statistics base + display soon once', () => {
    expect(navigationLabel('/statistics')).toBe('Статистика');
    expect(
      navigationDisplayLabel({ label: 'Статистика', availability: 'soon' }),
    ).toBe('Статистика · незабаром');
  });
});

describe('host + nav DoD (source)', () => {
  const appRoot = join(__dirname, '..', '..');

  it('AppComponent hosts exactly one help spotlight overlay and registerAppHelp', () => {
    const src = readFileSync(join(appRoot, 'app.component.ts'), 'utf8');
    const matches = src.match(/<loom-help-spotlight-overlay\s*\/>/g) ?? [];
    expect(matches).toHaveLength(1);
    expect(src).toContain('registerAppHelp');
  });

  it('Shell HelpMenu showMain=true; fill showMain=false', () => {
    const shell = readFileSync(
      join(appRoot, 'layouts', 'shell.component.ts'),
      'utf8',
    );
    const fill = readFileSync(
      join(
        appRoot,
        'features',
        'questionnaires',
        'fill',
        'questionnaire-fill-chrome.component.ts',
      ),
      'utf8',
    );
    expect(shell).toContain('loom-help-menu');
    expect(shell).toMatch(/\[showMain\]="true"/);
    expect(shell).toContain('data-help-id="shell.navigation"');
    expect(fill).toMatch(/\[showMain\]="false"/);
    expect(fill).not.toContain('loom-help-trigger');
  });

  it('directory and employee panel have no local HelpTrigger', () => {
    const dir = readFileSync(
      join(
        appRoot,
        'features',
        'questionnaires',
        'directory',
        'questionnaire-directory-page.component.ts',
      ),
      'utf8',
    );
    const panel = readFileSync(
      join(
        appRoot,
        'features',
        'questionnaires',
        'employee-questionnaires-panel.component.ts',
      ),
      'utf8',
    );
    expect(dir).not.toContain('loom-help-trigger');
    expect(panel).not.toContain('loom-help-trigger');
    expect(dir).toContain('loom-help-callout');
    expect(panel).toContain('loom-help-callout');
  });

  it('questionnaires.routes does not register help', () => {
    const src = readFileSync(
      join(
        appRoot,
        'features',
        'questionnaires',
        'questionnaires.routes.ts',
      ),
      'utf8',
    );
    expect(src).not.toContain('registerQuestionnaireHelp');
  });

  it('register helpers have no boolean latch', () => {
    const q = readFileSync(
      join(
        appRoot,
        'features',
        'questionnaires',
        'help',
        'register-questionnaire-help.ts',
      ),
      'utf8',
    );
    expect(q).not.toMatch(/let registered/);
  });

  it('HelpTourService closes on NavigationStart', () => {
    const src = readFileSync(
      join(appRoot, 'core', 'help', 'help-tour.service.ts'),
      'utf8',
    );
    expect(src).toContain('NavigationStart');
    expect(src).toContain("close('route-change')");
  });
});
