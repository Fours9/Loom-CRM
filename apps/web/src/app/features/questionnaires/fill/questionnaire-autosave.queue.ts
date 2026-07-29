/**
 * Pure serialized save queue (no Angular DI).
 * Invariants: oneSaveInFlight, pendingChangesMayAccumulate, neverCancelAcceptedPatch.
 */
export type AutosaveQueueResult =
  | { type: 'success'; revision: number; generation: number }
  | { type: 'conflict'; generation: number }
  | { type: 'error'; message: string; generation: number }
  | { type: 'stale' };

export class QuestionnaireAutosaveQueue {
  private inFlight = false;
  private pendingDirty = false;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly opts: {
      debounceMs: number;
      isBlocked: () => boolean;
      getGeneration: () => number;
      save: (
        generation: number,
      ) => Promise<
        | { ok: true; revision: number }
        | { ok: false; conflict: true }
        | { ok: false; conflict: false; message: string }
      >;
      setTimeoutFn?: typeof setTimeout;
      clearTimeoutFn?: typeof clearTimeout;
    },
  ) {}

  get isInFlight(): boolean {
    return this.inFlight;
  }

  get hasPending(): boolean {
    return this.pendingDirty;
  }

  schedule(): void {
    if (this.opts.isBlocked()) return;
    this.pendingDirty = true;
    this.clearDebounce();
    const setT = this.opts.setTimeoutFn ?? setTimeout;
    this.debounceTimer = setT(() => {
      this.debounceTimer = null;
      void this.pump();
    }, this.opts.debounceMs) as ReturnType<typeof setTimeout>;
  }

  async flush(): Promise<boolean> {
    if (this.opts.isBlocked()) return false;
    this.clearDebounce();
    if (!this.pendingDirty && !this.inFlight) return true;
    this.pendingDirty = true;
    return this.pumpUntilIdle();
  }

  reset(): void {
    this.clearDebounce();
    this.pendingDirty = false;
    this.inFlight = false;
  }

  cancelDebounceOnly(): void {
    this.clearDebounce();
  }

  private clearDebounce(): void {
    if (this.debounceTimer) {
      const clearT = this.opts.clearTimeoutFn ?? clearTimeout;
      clearT(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  private async pumpUntilIdle(): Promise<boolean> {
    let ok = true;
    while (this.pendingDirty || this.inFlight) {
      if (this.inFlight) {
        await new Promise((r) => setTimeout(r, 0));
        continue;
      }
      const result = await this.pump();
      if (result === false) ok = false;
      if (this.opts.isBlocked()) return false;
      if (!this.pendingDirty && !this.inFlight) break;
    }
    return ok && !this.opts.isBlocked();
  }

  /** @returns false on failure/conflict; true on success or nothing to do */
  private async pump(): Promise<boolean> {
    if (this.inFlight) return true;
    if (this.opts.isBlocked()) return false;
    if (!this.pendingDirty) return true;

    const generation = this.opts.getGeneration();
    this.pendingDirty = false;
    this.inFlight = true;

    try {
      const result = await this.opts.save(generation);
      this.inFlight = false;

      if (generation !== this.opts.getGeneration()) {
        return false;
      }

      if (result.ok) {
        if (this.pendingDirty) {
          return this.pump();
        }
        return true;
      }

      if (result.conflict) {
        this.pendingDirty = false;
        this.clearDebounce();
        return false;
      }

      this.pendingDirty = true;
      return false;
    } catch {
      this.inFlight = false;
      this.pendingDirty = true;
      return false;
    }
  }
}
