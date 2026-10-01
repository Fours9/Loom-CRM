import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';
import { NavigationStart, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { resolveHelpAnchor } from './help-anchor.resolve';
import type {
  HelpCloseReason,
  HelpTourId,
  HelpTourSession,
} from './help-tour.models';
import { findUsableStepIndex } from './help-tour.navigate';
import { helpTourRegistry } from './help-tour.registry';
import { HelpViewportAdapter } from './help-viewport.adapter';

/**
 * Single runtime entry for guided help tours.
 * Features only call start/next/prev/close; overlay reads session().
 */
@Injectable({ providedIn: 'root' })
export class HelpTourService {
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly viewport = inject(HelpViewportAdapter);
  private readonly registry = helpTourRegistry;

  private detachRemeasure: (() => void) | null = null;
  private pendingTrigger: HTMLElement | null = null;

  readonly session = signal<HelpTourSession | null>(null);

  constructor() {
    this.router.events
      .pipe(filter((e): e is NavigationStart => e instanceof NavigationStart))
      .subscribe(() => this.close('route-change'));
  }

  start(tourId: HelpTourId, triggerEl?: HTMLElement | null): void {
    const tour = this.registry.getTour(tourId);
    if (!tour || tour.steps.length === 0) {
      this.close('empty');
      return;
    }
    if (this.session()) {
      this.close('replace');
    }
    this.pendingTrigger = triggerEl ?? null;
    this.goToIndex(tourId, 0);
  }

  next(): void {
    const current = this.session();
    if (!current) return;
    const tour = this.registry.getTour(current.tourId);
    if (!tour) {
      this.close('empty');
      return;
    }
    this.goToIndex(current.tourId, current.stepIndex + 1);
  }

  private goToIndex(tourId: HelpTourId, fromIndex: number): void {
    const tour = this.registry.getTour(tourId);
    if (!tour) {
      this.close('empty');
      return;
    }

    const index = findUsableStepIndex(
      tour.steps,
      fromIndex,
      1,
      (anchorId) => !!resolveHelpAnchor(this.document, anchorId),
    );
    if (index == null) {
      this.close(fromIndex === 0 ? 'empty' : 'done');
      return;
    }
    const step = tour.steps[index]!;
    if (!step.anchorId) {
      this.applySession(tourId, index, tour.steps.length, step, null);
      return;
    }
    const el = resolveHelpAnchor(this.document, step.anchorId)!;
    this.viewport.scrollIntoView(el);
    this.applySession(
      tourId,
      index,
      tour.steps.length,
      step,
      this.viewport.measure(el),
    );
  }

  prev(): void {
    const current = this.session();
    if (!current || current.stepIndex <= 0) return;
    const tour = this.registry.getTour(current.tourId);
    if (!tour) {
      this.close('empty');
      return;
    }
    const index = findUsableStepIndex(
      tour.steps,
      current.stepIndex - 1,
      -1,
      (anchorId) => !!resolveHelpAnchor(this.document, anchorId),
    );
    if (index == null) return;
    const step = tour.steps[index]!;
    if (!step.anchorId) {
      this.applySession(current.tourId, index, tour.steps.length, step, null);
      return;
    }
    const el = resolveHelpAnchor(this.document, step.anchorId)!;
    this.viewport.scrollIntoView(el);
    this.applySession(
      current.tourId,
      index,
      tour.steps.length,
      step,
      this.viewport.measure(el),
    );
  }

  close(_reason: HelpCloseReason = 'user'): void {
    this.clearRemeasure();
    const trigger = this.session()?.triggerEl ?? this.pendingTrigger;
    this.session.set(null);
    this.pendingTrigger = null;
    queueMicrotask(() => trigger?.focus?.());
  }

  remeasure(): void {
    const current = this.session();
    if (!current?.step.anchorId) return;
    const el = resolveHelpAnchor(this.document, current.step.anchorId);
    if (!el) {
      this.session.set({ ...current, hole: null });
      return;
    }
    this.session.set({
      ...current,
      hole: this.viewport.measure(el),
    });
  }

  private applySession(
    tourId: HelpTourId,
    stepIndex: number,
    stepCount: number,
    step: HelpTourSession['step'],
    hole: HelpTourSession['hole'],
  ): void {
    this.clearRemeasure();
    this.session.set({
      tourId,
      stepIndex,
      stepCount,
      step,
      hole,
      triggerEl: this.pendingTrigger,
    });
    if (step.anchorId) {
      this.detachRemeasure = this.viewport.onRemeasure(() => this.remeasure());
    }
  }

  private clearRemeasure(): void {
    this.detachRemeasure?.();
    this.detachRemeasure = null;
  }
}
