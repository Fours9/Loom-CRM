import { DOCUMENT } from '@angular/common';
import { Injectable, inject, isDevMode } from '@angular/core';

interface BodySnapshot {
  overflow: string;
}

/**
 * Ref-counted body scroll lock for overlays (shell drawer, calendar phone sheet).
 * v1: overflow lock only — no scrollbar padding compensation (avoids half-compensation).
 */
@Injectable({ providedIn: 'root' })
export class OverlayScrollLockService {
  private readonly document = inject(DOCUMENT);
  private count = 0;
  private snapshot: BodySnapshot | null = null;

  acquire(): void {
    this.count += 1;
    if (this.count !== 1) {
      return;
    }
    const body = this.document.body;
    this.snapshot = {
      overflow: body.style.overflow,
    };
    body.style.overflow = 'hidden';
  }

  release(): void {
    if (this.count <= 0) {
      if (isDevMode()) {
        console.warn('[OverlayScrollLockService] release() called while unlocked');
      }
      this.count = 0;
      return;
    }
    this.count -= 1;
    if (this.count !== 0) {
      return;
    }
    const body = this.document.body;
    if (this.snapshot) {
      body.style.overflow = this.snapshot.overflow;
      this.snapshot = null;
    }
  }
}
