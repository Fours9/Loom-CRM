import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { helpTourRegistry } from '../core/help/help-tour.registry';
import { helpPageContextRegistry } from '../core/help/help-page-context.registry';
import { matchHelpRoute } from '../core/help/help-route.match';
import { registerAppHelp } from './register-app-help';
import { resolvePeopleHelpContext } from '../features/people/help/resolve-people-help-context';
import { peopleHelpTourIds } from '../features/people/help/resolve-people-help-context';
import { resolveAbsenceSidePanel } from '../features/absences/absence-side-panel.model';
import {
  absencesHelpTourIds,
  resolveAbsencesDashboardHelpContext,
} from '../features/absences/help/resolve-absences-help-context';
import {
  positionsHelpTourIds,
  resolvePositionsHelpContext,
} from '../features/positions/help/resolve-positions-help-context';

const appRoot = join(__dirname, '..');

function collectTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === 'dist') continue;
      out.push(...collectTsFiles(full));
    } else if (name.endsWith('.ts') && !name.endsWith('.spec.ts')) {
      out.push(full);
    }
  }
  return out;
}

function helpLeafSources(): string[] {
  const roots = [
    join(appRoot, 'help'),
    join(appRoot, 'layouts', 'help'),
    join(appRoot, 'features', 'people', 'help'),
    join(appRoot, 'features', 'absences', 'help'),
    join(appRoot, 'features', 'positions', 'help'),
    join(appRoot, 'features', 'settings', 'help'),
    join(appRoot, 'features', 'questionnaires', 'help'),
  ];
  const files: string[] = [];
  for (const root of roots) {
    files.push(...collectTsFiles(root));
  }
  // Pure shared models used by help resolvers
  files.push(
    join(appRoot, 'features', 'people', 'employee-data-tabs.model.ts'),
    join(appRoot, 'features', 'absences', 'absence-side-panel.model.ts'),
    join(appRoot, 'features', 'positions', 'position-help-context.model.ts'),
  );
  return files;
}

describe('full-app help DoD', () => {
  beforeEach(() => {
    helpTourRegistry.clear();
    helpPageContextRegistry.clear();
  });

  it('registers all product tourIds after boot without visiting lazy routes', () => {
    registerAppHelp();
    const expected = [
      'home.overview',
      'app.main',
      ...peopleHelpTourIds(),
      ...absencesHelpTourIds(),
      ...positionsHelpTourIds(),
      'settings.shell',
      'settings.access-roles',
      'questionnaires.directory',
      'questionnaires.employee',
      'questionnaires.fill',
    ];
    for (const id of expected) {
      expect(helpTourRegistry.getTour(id)).toBeTruthy();
    }
  });

  it('every ready route descriptor tourId is in the registry', () => {
    registerAppHelp();
    const descriptors = helpPageContextRegistry.list();
    for (const d of descriptors) {
      if (d.context.soon || !d.context.tourId) continue;
      expect(helpTourRegistry.getTour(d.context.tourId)).toBeTruthy();
    }
  });

  it('every feature-context mapping tourId is in the registry', () => {
    registerAppHelp();
    const mapped = [
      resolvePeopleHelpContext({
        tab: 'data',
        dataSubtab: 'contacts',
        aboutSubtab: null,
        workSubtab: 'position',
        metricsSubtab: 'skills',
        adminSubtab: 'history',
      }).tourId,
      resolvePeopleHelpContext({
        tab: 'about',
        dataSubtab: 'basics',
        aboutSubtab: 'family_home',
        workSubtab: 'position',
        metricsSubtab: 'skills',
        adminSubtab: 'history',
      }).tourId,
      resolveAbsencesDashboardHelpContext('requests', true).tourId,
      resolvePositionsHelpContext({
        pageTab: 'settings',
        selectedPositionId: 'x',
        catalogTab: 'skills',
        standalone: false,
      }).tourId,
    ];
    for (const id of mapped) {
      expect(id).toBeTruthy();
      expect(helpTourRegistry.getTour(id!)).toBeTruthy();
    }
  });

  it('Statistics remains soon with no ready tour', () => {
    registerAppHelp();
    const ctx = matchHelpRoute(
      helpPageContextRegistry.list(),
      '/statistics',
    );
    expect(ctx?.soon).toBe(true);
    expect(ctx?.tourId).toBeNull();
  });

  it('/people/new wins over /people/:id', () => {
    registerAppHelp();
    const list = helpPageContextRegistry.list();
    expect(matchHelpRoute(list, '/people/new')?.tourId).toBe('people.create');
    expect(matchHelpRoute(list, '/people/abc')?.soon).toBe(true);
  });

  it('/absences/requests/new wins over /absences/requests/:id', () => {
    registerAppHelp();
    const list = helpPageContextRegistry.list();
    expect(matchHelpRoute(list, '/absences/requests/new')?.tourId).toBe(
      'absences.request-create',
    );
    expect(matchHelpRoute(list, '/absences/requests/abc')?.tourId).toBe(
      'absences.request-detail',
    );
  });

  it('/positions/:id/catalog is ready and distinct from /positions', () => {
    registerAppHelp();
    const list = helpPageContextRegistry.list();
    expect(matchHelpRoute(list, '/positions')?.tourId).toBe(
      'positions.management',
    );
    expect(matchHelpRoute(list, '/positions/p1/catalog')?.tourId).toBe(
      'positions.position.skills',
    );
  });

  it('every registered tour has at least one stable/copy-only usable step', () => {
    registerAppHelp();
    for (const tour of helpTourRegistry.listTours()) {
      const hasStable = tour.steps.some((s) => !s.anchorId);
      expect(hasStable).toBe(true);
    }
  });

  it('product tours do not use region boilerplate copy', () => {
    registerAppHelp();
    const banned =
      /основний вміст|Підсвічена зона — основний|title:\s*['"]Область/;
    for (const tour of helpTourRegistry.listTours()) {
      if (tour.id.startsWith('questionnaires.') || tour.id === 'app.main') {
        continue;
      }
      for (const step of tour.steps) {
        expect(`${step.title}\n${step.body}`).not.toMatch(banned);
      }
    }
  });

  it('product tours include at least one actionable anchored step when CTAs exist', () => {
    registerAppHelp();
    const mustHaveAnchor = [
      'people.directory',
      'people.create',
      'people.data.basics',
      'absences.requests',
      'absences.request-create',
      'positions.management',
      'settings.access-roles',
      'home.overview',
    ];
    for (const id of mustHaveAnchor) {
      const tour = helpTourRegistry.getTour(id);
      expect(tour).toBeTruthy();
      expect(tour!.steps.some((s) => Boolean(s.anchorId))).toBe(true);
    }
  });

  it('register helpers have no boolean latch', () => {
    const files = [
      join(appRoot, 'help', 'register-app-help.ts'),
      join(appRoot, 'layouts', 'help', 'app-main-help.definition.ts'),
      join(appRoot, 'layouts', 'help', 'home-help.definition.ts'),
      join(appRoot, 'features', 'people', 'help', 'register-people-help.ts'),
      join(appRoot, 'features', 'absences', 'help', 'register-absences-help.ts'),
      join(
        appRoot,
        'features',
        'positions',
        'help',
        'register-positions-help.ts',
      ),
      join(appRoot, 'features', 'settings', 'help', 'register-settings-help.ts'),
      join(
        appRoot,
        'features',
        'questionnaires',
        'help',
        'register-questionnaire-help.ts',
      ),
    ];
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      expect(src).not.toMatch(/let\s+registered/);
      expect(src).not.toMatch(/registered\s*=\s*true/);
    }
  });

  it('eager help leaves do not import component/service/facade modules', () => {
    const forbidden =
      /\.(component|service|facade)(['"]|$)|\.component\.ts|\.service\.ts|\.facade\.ts/;
    for (const file of helpLeafSources()) {
      const src = readFileSync(file, 'utf8');
      const imports = src.match(/from\s+['"][^'"]+['"]/g) ?? [];
      for (const line of imports) {
        expect(line).not.toMatch(forbidden);
      }
    }
  });
});

describe('resolveAbsenceSidePanel', () => {
  it('normalizes comment without canViewComment to schedule', () => {
    expect(resolveAbsenceSidePanel('comment', false)).toBe('schedule');
    expect(resolveAbsenceSidePanel('comment', true)).toBe('comment');
    expect(resolveAbsenceSidePanel('requests', false)).toBe('requests');
  });

  it('dashboard help never proposes comment when canViewComment=false', () => {
    const ctx = resolveAbsencesDashboardHelpContext('comment', false);
    expect(ctx.tourId).toBe('absences.dashboard.schedule');
  });
});

describe('resolvePositionsHelpContext precedence', () => {
  it('formats wins even if a position remains selected', () => {
    const ctx = resolvePositionsHelpContext({
      pageTab: 'settings',
      selectedPositionId: 'pos-1',
      catalogTab: 'duties',
      standalone: false,
    });
    expect(ctx.tourId).toBe('positions.formats');
  });

  it('standalone catalog uses catalog tab tour', () => {
    expect(
      resolvePositionsHelpContext({
        pageTab: 'management',
        selectedPositionId: 'pos-1',
        catalogTab: 'goals',
        standalone: true,
      }).tourId,
    ).toBe('positions.position.goals');
  });

  it('management without selection → management', () => {
    expect(
      resolvePositionsHelpContext({
        pageTab: 'management',
        selectedPositionId: null,
        catalogTab: 'skills',
        standalone: false,
      }).tourId,
    ).toBe('positions.management');
  });
});

describe('resolvePeopleHelpContext', () => {
  it('maps data/about/work subtabs to ready tours', () => {
    expect(
      resolvePeopleHelpContext({
        tab: 'data',
        dataSubtab: 'dates',
        aboutSubtab: null,
        workSubtab: 'position',
        metricsSubtab: 'skills',
        adminSubtab: 'history',
      }).tourId,
    ).toBe('people.data.dates');

    expect(
      resolvePeopleHelpContext({
        tab: 'about',
        dataSubtab: 'basics',
        aboutSubtab: 'life_goals',
        workSubtab: 'position',
        metricsSubtab: 'skills',
        adminSubtab: 'history',
      }).tourId,
    ).toBe('people.about.life-goals');

    expect(
      resolvePeopleHelpContext({
        tab: 'absences',
        dataSubtab: 'basics',
        aboutSubtab: null,
        workSubtab: 'calendar',
        metricsSubtab: 'skills',
        adminSubtab: 'history',
      }).tourId,
    ).toBe('people.work.calendar');
  });

  it('about without resolved subtab stays soon fallback', () => {
    const ctx = resolvePeopleHelpContext({
      tab: 'about',
      dataSubtab: 'basics',
      aboutSubtab: null,
      workSubtab: 'position',
      metricsSubtab: 'skills',
      adminSubtab: 'history',
    });
    expect(ctx.soon).toBe(true);
    expect(ctx.tourId).toBeNull();
  });
});
