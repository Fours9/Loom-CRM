/**
 * Role-independent profile completeness (core vs extended).
 * Pure domain rules — no TypeORM / Nest.
 */

export type ProfileCompletenessSection = {
  weight: number;
  complete: boolean;
};

export type ProfileCompletenessLevel = {
  percent: number;
  incompleteSections: string[];
  sections: Record<string, ProfileCompletenessSection>;
};

export type ProfileCompletenessFacts = {
  hasIdentity: boolean;
  hasActiveAssignment: boolean;
  hasAssignmentStructure: boolean;
  hasStartDate: boolean;
  hasWorkContact: boolean;
  hasPhoto: boolean;
  hasPersonalCore: boolean;
  hasPersonalContact: boolean;
  hasEmergencyContact: boolean;
  hasImportantDates: boolean;
};

export type CompletenessEmployeeSlice = {
  firstName: string;
  lastName: string;
  employeeNumber: string;
  phoneNumber: string | null;
  workEmail: string | null;
  personalPhoneNumber: string | null;
  photoUrl: string | null;
  birthDate: string | null;
  city: string | null;
};

export type CompletenessContactSlice = {
  type: string;
  value: string;
};

export type CompletenessAssignmentSlice = {
  status: string;
  departmentId: string | null;
  positionId: string | null;
  startDate: string | null;
} | null;

function levelFromSections(
  sections: Record<string, ProfileCompletenessSection>,
): ProfileCompletenessLevel {
  let earned = 0;
  let total = 0;
  const incompleteSections: string[] = [];
  for (const [key, s] of Object.entries(sections)) {
    total += s.weight;
    if (s.complete) {
      earned += s.weight;
    } else {
      incompleteSections.push(key);
    }
  }
  return {
    percent: total === 0 ? 0 : Math.round((earned / total) * 100),
    incompleteSections,
    sections,
  };
}

export function buildProfileCompletenessFacts(input: {
  employee: CompletenessEmployeeSlice;
  contacts: CompletenessContactSlice[];
  emergencyCount: number;
  importantDatesCount: number;
  assignment: CompletenessAssignmentSlice;
}): ProfileCompletenessFacts {
  const { employee: e, contacts, assignment } = input;

  const hasWorkPhone =
    Boolean(e.phoneNumber?.trim()) ||
    contacts.some((c) => c.type === 'work_phone' && Boolean(c.value?.trim()));

  const hasWorkEmail =
    Boolean(e.workEmail?.trim()) ||
    contacts.some((c) => c.type === 'work_email' && Boolean(c.value?.trim()));

  const hasPersonalContact =
    Boolean(e.personalPhoneNumber?.trim()) ||
    contacts.some(
      (c) =>
        (c.type === 'personal_phone' || c.type === 'personal_email') &&
        Boolean(c.value?.trim()),
    );

  return {
    hasIdentity: Boolean(
      e.firstName?.trim() && e.lastName?.trim() && e.employeeNumber?.trim(),
    ),
    hasActiveAssignment: assignment?.status === 'active',
    hasAssignmentStructure: Boolean(
      assignment?.departmentId || assignment?.positionId,
    ),
    hasStartDate: Boolean(assignment?.startDate),
    hasWorkContact: hasWorkPhone || hasWorkEmail,
    hasPhoto: Boolean(e.photoUrl?.trim()),
    hasPersonalCore: Boolean(e.birthDate && e.city?.trim()),
    hasPersonalContact,
    hasEmergencyContact: input.emergencyCount > 0,
    hasImportantDates: input.importantDatesCount > 0,
  };
}

export function computeProfileCompleteness(facts: ProfileCompletenessFacts): {
  core: ProfileCompletenessLevel;
  extended: ProfileCompletenessLevel;
} {
  const assignmentComplete =
    facts.hasActiveAssignment &&
    facts.hasAssignmentStructure &&
    facts.hasStartDate;

  const core = levelFromSections({
    identity: { weight: 25, complete: facts.hasIdentity },
    assignment: { weight: 45, complete: assignmentComplete },
    workContacts: { weight: 30, complete: facts.hasWorkContact },
  });

  const extended = levelFromSections({
    photo: { weight: 20, complete: facts.hasPhoto },
    personalCore: { weight: 20, complete: facts.hasPersonalCore },
    personalContacts: { weight: 20, complete: facts.hasPersonalContact },
    emergency: { weight: 20, complete: facts.hasEmergencyContact },
    importantDates: { weight: 20, complete: facts.hasImportantDates },
  });

  return { core, extended };
}

/** Permission-aware projection after role-independent scoring. */
export function projectProfileCompleteness(
  scored: {
    core: ProfileCompletenessLevel;
    extended: ProfileCompletenessLevel;
  },
  canViewExtended: boolean,
): {
  core: ProfileCompletenessLevel;
  extended: ProfileCompletenessLevel | null;
} {
  return {
    core: scored.core,
    extended: canViewExtended ? scored.extended : null,
  };
}
