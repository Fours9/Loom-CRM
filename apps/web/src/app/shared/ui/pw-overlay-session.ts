/** Exclusive open state for CRM popovers (select / multi-select / date). */
export type PwOverlayHandle = {
  closeFromOverlaySession: () => void;
};

let active: PwOverlayHandle | null = null;

/** Claim the single open slot; closes any other registered overlay. */
export function claimPwOverlay(handle: PwOverlayHandle): void {
  if (active && active !== handle) {
    active.closeFromOverlaySession();
  }
  active = handle;
}

/** Release only if this handle still owns the slot. */
export function releasePwOverlay(handle: PwOverlayHandle): void {
  if (active === handle) {
    active = null;
  }
}
