import {
  emptyEmployeeContactsBundle,
  employeeContactsBundlesEqual,
  normalizeEmployeeContactsBundle,
  type EmployeeContactsBundle,
} from '@loom/employee-contacts';
import { hydrateContactsBundleDisplay } from '../../../../shared/employee-contacts/public-api';

export type QuestionnaireContactsFieldInput = {
  answers: Record<string, unknown>;
  profileMirror: Record<string, unknown>;
  employeeId: string | null;
};

/**
 * Single entry point for questionnaire contacts field display + edit commits.
 * Returns stable bundle references until canonical content changes (deterministic).
 */
export class QuestionnaireContactsFieldSession {
  private displayCache = emptyEmployeeContactsBundle();

  readDisplay(input: QuestionnaireContactsFieldInput): EmployeeContactsBundle {
    const next = hydrateContactsBundleDisplay(input);
    if (employeeContactsBundlesEqual(next, this.displayCache)) {
      return this.displayCache;
    }
    this.displayCache = next;
    return this.displayCache;
  }

  commitEdit(bundle: EmployeeContactsBundle): EmployeeContactsBundle {
    return normalizeEmployeeContactsBundle(bundle);
  }
}
