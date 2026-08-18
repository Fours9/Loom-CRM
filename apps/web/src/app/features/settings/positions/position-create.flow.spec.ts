import { of, throwError } from 'rxjs';
import { PositionDraftSkillQueue } from './position-draft-skill-queue';
import {
  applyDraftRequirements,
  createPositionThenApplyDrafts,
} from './position-create.flow';
import type { PositionDraftApi } from './position-create.flow';
import type { PositionDialogMode } from './position-dialog.models';
import type { OrgPosition, OrgPositionSkillRequirement } from '../settings-org-api.service';

function skillSnap(id: string, scaleMin = 0) {
  return { id, scaleMin, scaleMax: 5, name: id, code: id, scaleKind: 'range' as const };
}

function position(id = 'pos-1'): OrgPosition {
  return {
    id,
    name: 'Cashier',
    departmentId: null,
    directionId: null,
    description: null,
    isActive: true,
  };
}

function req(
  skillId: string,
  overrides: Partial<OrgPositionSkillRequirement> = {},
): OrgPositionSkillRequirement {
  return {
    id: `req-${skillId}`,
    positionId: 'pos-1',
    skillId,
    targetLevel: 0,
    required: true,
    weight: null,
    ...overrides,
  };
}

function makeApi(opts: {
  create?: () => ReturnType<PositionDraftApi['createPosition']>;
  createReq?: jest.Mock;
  list?: OrgPositionSkillRequirement[];
  updateReq?: jest.Mock;
}): PositionDraftApi & { createPosition: jest.Mock; createReqCalls: string[] } {
  const createReqCalls: string[] = [];
  const createReq =
    opts.createReq ??
    jest.fn((positionId: string, body: { skillId: string }) => {
      createReqCalls.push(body.skillId);
      return of(req(body.skillId, { positionId }));
    });
  const createPosition = jest.fn(
    opts.create ?? (() => of(position())),
  );
  return {
    createPosition,
    createPositionSkillRequirement: createReq,
    getPositionSkillRequirements: jest.fn(() => of(opts.list ?? [])),
    updatePositionSkillRequirement:
      opts.updateReq ?? jest.fn(() => of(req('x'))),
    createReqCalls,
  };
}

describe('createPositionThenApplyDrafts', () => {
  it('keeps the queue and does not POST requirements on known rejection', async () => {
    const queue = new PositionDraftSkillQueue();
    queue.addSkills([skillSnap('a')], 0);
    const api = makeApi({
      create: () => throwError(() => ({ status: 400, error: { message: 'bad' } })),
    });
    let mode: PositionDialogMode = 'create';
    const result = await createPositionThenApplyDrafts({
      api,
      queue,
      mode,
      body: { name: 'X' },
      setMode: (next) => {
        mode = next;
      },
    });
    expect(result.kind).toBe('known-rejection');
    expect(api.createPositionSkillRequirement).not.toHaveBeenCalled();
    expect(queue.length).toBe(1);
    expect(mode).toBe('create');
  });

  it('does not blind-retry after unknown create outcome', async () => {
    const queue = new PositionDraftSkillQueue();
    queue.addSkills([skillSnap('a')], 0);
    const api = makeApi({
      create: () => throwError(() => ({ status: 0 })),
    });
    let mode: PositionDialogMode = 'create';
    const first = await createPositionThenApplyDrafts({
      api,
      queue,
      mode,
      body: { name: 'X' },
      setMode: (next) => {
        mode = next;
      },
    });
    expect(first.kind).toBe('unknown');
    expect(mode).toBe('unresolved-create');
    const second = await createPositionThenApplyDrafts({
      api,
      queue,
      mode,
      body: { name: 'X' },
      setMode: (next) => {
        mode = next;
      },
    });
    expect(second.kind).toBe('locked');
    expect(api.createPosition).toHaveBeenCalledTimes(1);
    expect(api.createPositionSkillRequirement).not.toHaveBeenCalled();
  });

  it('applies drafts in sequence and ends in edit when all succeed', async () => {
    const queue = new PositionDraftSkillQueue();
    queue.addSkills([skillSnap('a'), skillSnap('b'), skillSnap('c')], 0);
    const listed = [req('a'), req('b'), req('c')];
    const api = makeApi({ list: listed });
    let mode: PositionDialogMode = 'create';
    const result = await createPositionThenApplyDrafts({
      api,
      queue,
      mode,
      body: { name: 'X' },
      setMode: (next) => {
        mode = next;
      },
    });
    expect(result.kind).toBe('created');
    expect(api.createReqCalls).toEqual(['a', 'b', 'c']);
    expect(queue.isEmpty()).toBe(true);
    expect(mode).toBe('edit');
  });

  it('keeps failed row B after A and C succeed', async () => {
    const queue = new PositionDraftSkillQueue();
    queue.addSkills([skillSnap('a'), skillSnap('b'), skillSnap('c')], 0);
    const createReq = jest.fn((_positionId: string, body: { skillId: string }) => {
      if (body.skillId === 'b') {
        return throwError(() => ({ status: 400, error: { message: 'nope' } }));
      }
      return of(req(body.skillId));
    });
    const api = makeApi({
      createReq,
      list: [req('a'), req('c')],
    });
    let mode: PositionDialogMode = 'create';
    await createPositionThenApplyDrafts({
      api,
      queue,
      mode,
      body: { name: 'X' },
      setMode: (next) => {
        mode = next;
      },
    });
    expect(queue.snapshot().map((row) => row.skillId)).toEqual(['b']);
    expect(queue.snapshot()[0].state).toBe('failed');
    expect(mode).toBe('edit-with-failed-drafts');
  });

  it('does not duplicate POST when reload already has the same skill+values', async () => {
    const queue = new PositionDraftSkillQueue();
    queue.addSkills([skillSnap('a')], 0);
    const createReq = jest.fn(() => throwError(() => ({ status: 0 })));
    const api = makeApi({
      createReq,
      list: [req('a')],
    });
    await applyDraftRequirements(api, 'pos-1', queue);
    expect(queue.isEmpty()).toBe(true);
  });

  it('does not treat mismatched server values as applied', async () => {
    const queue = new PositionDraftSkillQueue();
    queue.addSkills([skillSnap('a')], 0);
    queue.changeTarget(queue.snapshot()[0].clientId, 4);
    const createReq = jest.fn(() => throwError(() => ({ status: 0 })));
    const api = makeApi({
      createReq,
      list: [req('a', { targetLevel: 0 })],
    });
    await applyDraftRequirements(api, 'pos-1', queue);
    expect(queue.snapshot()[0].state).toBe('conflict');
  });

  it('locks a second save during creating-position', async () => {
    const queue = new PositionDraftSkillQueue();
    const api = makeApi({});
    const result = await createPositionThenApplyDrafts({
      api,
      queue,
      mode: 'creating-position',
      body: { name: 'X' },
      setMode: () => undefined,
    });
    expect(result.kind).toBe('locked');
    expect(api.createPosition).not.toHaveBeenCalled();
  });
});
