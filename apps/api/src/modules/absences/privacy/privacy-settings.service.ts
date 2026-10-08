import { Injectable } from '@nestjs/common';
import { ApplicationSettingsService } from '../../../platform/settings/application-settings.service';
import {
  PRIVACY_DEFAULTS,
  PRIVACY_SETTING_KEYS,
  PRIVACY_SETTINGS_ID,
  parseAbsenceVisibilityMode,
  parseBool,
  parseProfileVisibilityMode,
  parseSessionMinutes,
  type AbsenceVisibilityMode,
  type PrivacySettingsDto,
  type ProfileVisibilityMode,
} from './privacy-settings.keys';

export type UpdatePrivacySettingsInput = {
  absenceVisibilityMode?: AbsenceVisibilityMode;
  profileVisibilityMode?: ProfileVisibilityMode;
  globalPrivacyPriority?: boolean;
  showDepartmentOnCalendar?: boolean;
  showPositionOnCalendar?: boolean;
  showAbsenceTypeToPeers?: boolean;
  sessionInactivityMinutes?: number;
};

@Injectable()
export class PrivacySettingsService {
  constructor(private readonly settings: ApplicationSettingsService) {}

  async get(): Promise<PrivacySettingsDto> {
    const [
      absenceVisibilityMode,
      profileVisibilityMode,
      globalPrivacyPriority,
      showDepartmentOnCalendar,
      showPositionOnCalendar,
      showAbsenceTypeToPeers,
      sessionInactivityMinutes,
    ] = await Promise.all([
      this.settings.get(PRIVACY_SETTING_KEYS.absenceVisibilityMode),
      this.settings.get(PRIVACY_SETTING_KEYS.profileVisibilityMode),
      this.settings.get(PRIVACY_SETTING_KEYS.globalPrivacyPriority),
      this.settings.get(PRIVACY_SETTING_KEYS.showDepartmentOnCalendar),
      this.settings.get(PRIVACY_SETTING_KEYS.showPositionOnCalendar),
      this.settings.get(PRIVACY_SETTING_KEYS.showAbsenceTypeToPeers),
      this.settings.get(PRIVACY_SETTING_KEYS.sessionInactivityMinutes),
    ]);

    return {
      id: PRIVACY_SETTINGS_ID,
      absenceVisibilityMode: parseAbsenceVisibilityMode(absenceVisibilityMode),
      profileVisibilityMode: parseProfileVisibilityMode(profileVisibilityMode),
      globalPrivacyPriority: parseBool(
        globalPrivacyPriority,
        PRIVACY_DEFAULTS.globalPrivacyPriority,
      ),
      showDepartmentOnCalendar: parseBool(
        showDepartmentOnCalendar,
        PRIVACY_DEFAULTS.showDepartmentOnCalendar,
      ),
      showPositionOnCalendar: parseBool(
        showPositionOnCalendar,
        PRIVACY_DEFAULTS.showPositionOnCalendar,
      ),
      showAbsenceTypeToPeers: parseBool(
        showAbsenceTypeToPeers,
        PRIVACY_DEFAULTS.showAbsenceTypeToPeers,
      ),
      sessionInactivityMinutes: parseSessionMinutes(sessionInactivityMinutes),
    };
  }

  /**
   * Ensure baseline keys exist (empty DB / migrate without snapshot restore).
   * Does not overwrite existing values.
   */
  async ensureDefaults(): Promise<void> {
    const entries: Array<[string, string]> = [
      [
        PRIVACY_SETTING_KEYS.absenceVisibilityMode,
        PRIVACY_DEFAULTS.absenceVisibilityMode,
      ],
      [
        PRIVACY_SETTING_KEYS.profileVisibilityMode,
        PRIVACY_DEFAULTS.profileVisibilityMode,
      ],
      [
        PRIVACY_SETTING_KEYS.globalPrivacyPriority,
        String(PRIVACY_DEFAULTS.globalPrivacyPriority),
      ],
      [
        PRIVACY_SETTING_KEYS.showDepartmentOnCalendar,
        String(PRIVACY_DEFAULTS.showDepartmentOnCalendar),
      ],
      [
        PRIVACY_SETTING_KEYS.showPositionOnCalendar,
        String(PRIVACY_DEFAULTS.showPositionOnCalendar),
      ],
      [
        PRIVACY_SETTING_KEYS.showAbsenceTypeToPeers,
        String(PRIVACY_DEFAULTS.showAbsenceTypeToPeers),
      ],
      [
        PRIVACY_SETTING_KEYS.sessionInactivityMinutes,
        String(PRIVACY_DEFAULTS.sessionInactivityMinutes),
      ],
    ];
    for (const [key, value] of entries) {
      const existing = await this.settings.get(key);
      if (existing === null) {
        await this.settings.set(key, value);
      }
    }
  }

  async update(input: UpdatePrivacySettingsInput): Promise<PrivacySettingsDto> {
    const current = await this.get();
    const next: PrivacySettingsDto = {
      ...current,
      ...(input.absenceVisibilityMode !== undefined
        ? { absenceVisibilityMode: input.absenceVisibilityMode }
        : {}),
      ...(input.profileVisibilityMode !== undefined
        ? { profileVisibilityMode: input.profileVisibilityMode }
        : {}),
      ...(input.globalPrivacyPriority !== undefined
        ? { globalPrivacyPriority: input.globalPrivacyPriority }
        : {}),
      ...(input.showDepartmentOnCalendar !== undefined
        ? { showDepartmentOnCalendar: input.showDepartmentOnCalendar }
        : {}),
      ...(input.showPositionOnCalendar !== undefined
        ? { showPositionOnCalendar: input.showPositionOnCalendar }
        : {}),
      ...(input.showAbsenceTypeToPeers !== undefined
        ? { showAbsenceTypeToPeers: input.showAbsenceTypeToPeers }
        : {}),
      ...(input.sessionInactivityMinutes !== undefined
        ? { sessionInactivityMinutes: input.sessionInactivityMinutes }
        : {}),
    };

    await Promise.all([
      this.settings.set(
        PRIVACY_SETTING_KEYS.absenceVisibilityMode,
        next.absenceVisibilityMode,
      ),
      this.settings.set(
        PRIVACY_SETTING_KEYS.profileVisibilityMode,
        next.profileVisibilityMode,
      ),
      this.settings.set(
        PRIVACY_SETTING_KEYS.globalPrivacyPriority,
        String(next.globalPrivacyPriority),
      ),
      this.settings.set(
        PRIVACY_SETTING_KEYS.showDepartmentOnCalendar,
        String(next.showDepartmentOnCalendar),
      ),
      this.settings.set(
        PRIVACY_SETTING_KEYS.showPositionOnCalendar,
        String(next.showPositionOnCalendar),
      ),
      this.settings.set(
        PRIVACY_SETTING_KEYS.showAbsenceTypeToPeers,
        String(next.showAbsenceTypeToPeers),
      ),
      this.settings.set(
        PRIVACY_SETTING_KEYS.sessionInactivityMinutes,
        String(next.sessionInactivityMinutes),
      ),
    ]);

    return next;
  }
}
