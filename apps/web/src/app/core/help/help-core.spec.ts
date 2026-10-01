import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { helpDismissStorageKey } from './help-dismiss.keys';
import { resolveHelpAnchor, isVisibleAndUsable } from './help-anchor.resolve';
import { HelpTourRegistry } from './help-tour.registry';
import { findUsableStepIndex } from './help-tour.navigate';
import {
  QUESTIONNAIRE_HELP_BUNDLE,
  QUESTIONNAIRE_LIFECYCLE_BLURB,
} from '../../features/questionnaires/help/questionnaire-help.definition';

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
    expect(
      helpDismissStorageKey('questionnaire.lifecycle', 1),
    ).not.toBe(helpDismissStorageKey('questionnaire.lifecycle', 2));
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
    expect(
      findUsableStepIndex(steps, 1, 1, () => false),
    ).toBe(3);
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
      querySelectorAll: () => [hidden, visible] as unknown as NodeListOf<Element>,
    };
    expect(resolveHelpAnchor(doc, 'q.more')).toBe(visible);
  });
});

describe('isVisibleAndUsable', () => {
  it('rejects disabled elements', () => {
    expect(isVisibleAndUsable(fakeEl({ width: 10, height: 10, disabled: true }))).toBe(
      false,
    );
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

  it('lifecycle callout is version 2 (v1 dismiss does not hide it)', () => {
    const callout = QUESTIONNAIRE_HELP_BUNDLE.callouts?.[0];
    expect(callout?.id).toBe('questionnaire.lifecycle');
    expect(callout?.version).toBe(2);
    expect(callout?.body).toBe(QUESTIONNAIRE_LIFECYCLE_BLURB);
  });
});

describe('host + nav DoD (source)', () => {
  const appRoot = join(__dirname, '..', '..');

  it('AppComponent hosts exactly one help spotlight overlay', () => {
    const src = readFileSync(join(appRoot, 'app.component.ts'), 'utf8');
    const matches = src.match(/<loom-help-spotlight-overlay\s*\/>/g) ?? [];
    expect(matches).toHaveLength(1);
  });

  it('Statistics nav label is locked «Статистика · незабаром»', () => {
    const src = readFileSync(
      join(appRoot, 'core', 'navigation', 'navigation.service.ts'),
      'utf8',
    );
    expect(src).toMatch(
      /\{\s*path:\s*'\/statistics',\s*label:\s*'Статистика · незабаром',\s*surface:/,
    );
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
