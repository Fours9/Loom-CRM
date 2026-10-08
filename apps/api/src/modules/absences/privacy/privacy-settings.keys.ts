/** Keys in `application_settings` (cutover from PW `privacy_settings`). */
export const PRIVACY_SETTING_KEYS = {
  absenceVisibilityMode: 'privacy.absence_visibility_mode',
  profileVisibilityMode: 'privacy.profile_visibility_mode',
  globalPrivacyPriority: 'privacy.global_privacy_priority',
  showDepartmentOnCalendar: 'privacy.show_department_on_calendar',
  showPositionOnCalendar: 'privacy.show_position_on_calendar',
  showAbsenceTypeToPeers: 'privacy.show_absence_type_to_peers',
  sessionInactivityMinutes: 'privacy.session_inactivity_minutes',
} as const;

export type AbsenceVisibilityMode = 'none' | 'own_department' | 'all_approved';
export type ProfileVisibilityMode = 'none' | 'own_department' | 'all';

export const ABSENCE_VISIBILITY_MODES: readonly AbsenceVisibilityMode[] = [
  'none',
  'own_department',
  'all_approved',
] as const;

export const PROFILE_VISIBILITY_MODES: readonly ProfileVisibilityMode[] = [
  'none',
  'own_department',
  'all',
] as const;

/** Synthetic id — settings are key/value, not a single row. */
export const PRIVACY_SETTINGS_ID = 1;

/** Defaults match tracked snapshot / PW cutover baseline. */
export const PRIVACY_DEFAULTS = {
  absenceVisibilityMode: 'all_approved' as AbsenceVisibilityMode,
  profileVisibilityMode: 'all' as ProfileVisibilityMode,
  globalPrivacyPriority: true,
  showDepartmentOnCalendar: true,
  showPositionOnCalendar: true,
  showAbsenceTypeToPeers: false,
  sessionInactivityMinutes: 480,
};

export type PrivacySettingsDto = {
  id: number;
  absenceVisibilityMode: AbsenceVisibilityMode;
  profileVisibilityMode: ProfileVisibilityMode;
  globalPrivacyPriority: boolean;
  showDepartmentOnCalendar: boolean;
  showPositionOnCalendar: boolean;
  showAbsenceTypeToPeers: boolean;
  sessionInactivityMinutes: number;
};

export function parseBool(raw: string | null, fallback: boolean): boolean {
  if (raw === null || raw === undefined || raw === '') return fallback;
  const v = raw.trim().toLowerCase();
  if (v === 'true' || v === '1' || v === 'yes') return true;
  if (v === 'false' || v === '0' || v === 'no') return false;
  return fallback;
}

export function parseAbsenceVisibilityMode(
  raw: string | null,
): AbsenceVisibilityMode {
  if (raw && (ABSENCE_VISIBILITY_MODES as readonly string[]).includes(raw)) {
    return raw as AbsenceVisibilityMode;
  }
  return PRIVACY_DEFAULTS.absenceVisibilityMode;
}

export function parseProfileVisibilityMode(
  raw: string | null,
): ProfileVisibilityMode {
  if (raw && (PROFILE_VISIBILITY_MODES as readonly string[]).includes(raw)) {
    return raw as ProfileVisibilityMode;
  }
  return PRIVACY_DEFAULTS.profileVisibilityMode;
}

export function parseSessionMinutes(raw: string | null): number {
  if (raw === null || raw === undefined || raw === '') {
    return PRIVACY_DEFAULTS.sessionInactivityMinutes;
  }
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) {
    return PRIVACY_DEFAULTS.sessionInactivityMinutes;
  }
  return n;
}
