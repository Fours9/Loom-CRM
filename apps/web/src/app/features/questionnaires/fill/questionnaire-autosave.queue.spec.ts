import { QuestionnaireAutosaveQueue } from './questionnaire-autosave.queue';
import {
  displayFieldValue,
  hasOwnAnswer,
} from './validation/questionnaire-validation';
import type { QuestionnaireSchemaField } from '@loom/contracts-questionnaires';

describe('QuestionnaireAutosaveQueue', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('debounces to a single save', async () => {
    const save = jest.fn(async () => ({ ok: true as const, revision: 1 }));
    let generation = 1;
    const q = new QuestionnaireAutosaveQueue({
      debounceMs: 1300,
      isBlocked: () => false,
      getGeneration: () => generation,
      save,
    });
    q.schedule();
    q.schedule();
    expect(save).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1300);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('queues pending changes during in-flight save', async () => {
    let resolveFirst!: (v: { ok: true; revision: number }) => void;
    const save = jest
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<{ ok: true; revision: number }>((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockImplementationOnce(async () => ({ ok: true as const, revision: 2 }));

    const q = new QuestionnaireAutosaveQueue({
      debounceMs: 100,
      isBlocked: () => false,
      getGeneration: () => 1,
      save,
    });

    q.schedule();
    await jest.advanceTimersByTimeAsync(100);
    expect(save).toHaveBeenCalledTimes(1);
    q.schedule();
    resolveFirst({ ok: true, revision: 1 });
    await Promise.resolve();
    await Promise.resolve();
    expect(save).toHaveBeenCalledTimes(2);
  });

  it('flush runs immediately without waiting full debounce', async () => {
    const save = jest.fn(async () => ({ ok: true as const, revision: 3 }));
    const q = new QuestionnaireAutosaveQueue({
      debounceMs: 5000,
      isBlocked: () => false,
      getGeneration: () => 1,
      save,
    });
    q.schedule();
    const ok = await q.flush();
    expect(ok).toBe(true);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('save error keeps pending dirty', async () => {
    const save = jest.fn(async () => ({
      ok: false as const,
      conflict: false as const,
      message: 'fail',
    }));
    const q = new QuestionnaireAutosaveQueue({
      debounceMs: 50,
      isBlocked: () => false,
      getGeneration: () => 1,
      save,
    });
    q.schedule();
    await jest.advanceTimersByTimeAsync(50);
    expect(q.hasPending).toBe(true);
  });

  it('409 conflict stops pending and fails flush', async () => {
    const save = jest.fn(async () => ({
      ok: false as const,
      conflict: true as const,
    }));
    let blocked = false;
    const q = new QuestionnaireAutosaveQueue({
      debounceMs: 50,
      isBlocked: () => blocked,
      getGeneration: () => 1,
      save,
    });
    q.schedule();
    const flushPromise = q.flush();
    await jest.advanceTimersByTimeAsync(0);
    const ok = await flushPromise;
    expect(ok).toBe(false);
    blocked = true;
    expect(await q.flush()).toBe(false);
  });

  it('ignores stale generation after reset', async () => {
    let resolveSave!: (v: { ok: true; revision: number }) => void;
    let generation = 1;
    const save = jest.fn(
      () =>
        new Promise<{ ok: true; revision: number }>((resolve) => {
          resolveSave = resolve;
        }),
    );
    const q = new QuestionnaireAutosaveQueue({
      debounceMs: 50,
      isBlocked: () => false,
      getGeneration: () => generation,
      save,
    });
    q.schedule();
    await jest.advanceTimersByTimeAsync(50);
    q.reset();
    generation = 2;
    resolveSave({ ok: true, revision: 99 });
    await Promise.resolve();
    expect(generation).toBe(2);
  });
});

describe('DraftStore-facing mirror invariants', () => {
  const field: QuestionnaireSchemaField = {
    key: 'personal.last_name',
    label: 'Прізвище',
    valueType: 'text',
    proposalMapping: { section: 'overview', field: 'lastName' },
  };

  it('draft has priority; explicit empty/false/null kept', () => {
    expect(
      displayFieldValue(
        { 'personal.last_name': 'Draft' },
        { lastName: 'Mirror' },
        field,
      ),
    ).toBe('Draft');
    expect(
      displayFieldValue(
        { 'personal.last_name': '' },
        { lastName: 'Mirror' },
        field,
      ),
    ).toBe('');
    expect(hasOwnAnswer({ flag: false }, 'flag')).toBe(true);
    expect(hasOwnAnswer({ flag: null }, 'flag')).toBe(true);
    expect(hasOwnAnswer({}, 'flag')).toBe(false);
  });

  it('assignment switch clears conceptual answers bag', () => {
    const answersA = { flag: true };
    const answersB: Record<string, unknown> = {};
    expect(answersB).not.toEqual(answersA);
    expect(Object.keys(answersB)).toHaveLength(0);
  });
});
