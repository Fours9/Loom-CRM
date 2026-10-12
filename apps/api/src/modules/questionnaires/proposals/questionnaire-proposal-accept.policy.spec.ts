import { Permission } from '../../../platform/permissions/permission.names';
import type { AuthorizationContext } from '../../../platform/access-control/authorization-context';
import {
  canAcceptQuestionnaireProfileProposal,
  classifyProposalProfileWrite,
} from './questionnaire-proposal-accept.policy';
import type { StoredQuestionnaireProposedChange } from './questionnaire-proposed-change';

function authz(input: {
  permissions?: Permission[];
  isAdminEquivalent?: boolean;
}): AuthorizationContext {
  return {
    userId: 'u1',
    accountRole: {
      id: 'r1',
      code: null,
      name: 'Test',
      permissionPreset: 'employee',
      isAdminEquivalent: input.isAdminEquivalent ?? false,
      isSystem: false,
    },
    permissions: input.permissions ?? [],
    surfaces: [],
    isAdminEquivalent: input.isAdminEquivalent ?? false,
    questionnaireTemplateCodes: [],
  };
}

function fieldUpdate(
  section: string,
  field: string,
): StoredQuestionnaireProposedChange {
  return {
    kind: 'field_update',
    section,
    field,
    answerKey: `${section}.${field}`,
    from: null,
    to: 'x',
  };
}

/** Every currently generated field_update pair (seed + contacts projector). */
const GENERATED_FIELD_UPDATES: Array<{
  section: string;
  field: string;
  requirement: 'basic' | 'personal' | 'emergency';
}> = [
  { section: 'overview', field: 'lastName', requirement: 'basic' },
  { section: 'overview', field: 'firstName', requirement: 'basic' },
  { section: 'overview', field: 'middleName', requirement: 'basic' },
  { section: 'header', field: 'preferredName', requirement: 'basic' },
  { section: 'personal', field: 'birthDate', requirement: 'personal' },
  { section: 'personal', field: 'city', requirement: 'personal' },
  { section: 'personal', field: 'preferredLanguage', requirement: 'personal' },
  { section: 'contacts', field: 'workEmail', requirement: 'basic' },
  { section: 'contacts', field: 'workPhone', requirement: 'basic' },
  { section: 'contacts', field: 'workTelegram', requirement: 'basic' },
  { section: 'contacts', field: 'personal_replace', requirement: 'personal' },
  { section: 'contacts', field: 'emergency_replace', requirement: 'emergency' },
  { section: 'employment', field: 'directionId', requirement: 'basic' },
  { section: 'employment', field: 'departmentId', requirement: 'basic' },
  { section: 'employment', field: 'positionId', requirement: 'basic' },
];

describe('classifyProposalProfileWrite', () => {
  it('covers every currently generated field_update pair', () => {
    for (const row of GENERATED_FIELD_UPDATES) {
      expect(classifyProposalProfileWrite(fieldUpdate(row.section, row.field))).toBe(
        row.requirement,
      );
    }
  });

  it('classifies add_skill as skill', () => {
    expect(
      classifyProposalProfileWrite({
        kind: 'add_skill',
        section: 'skills',
        field: 'sewing',
        skillId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
        skillCode: 'sewing',
        labelUa: 'Пошиття',
        proposedLevel: 3,
        sourceScale: { kind: 'range', min: 0, max: 5 },
      }),
    ).toBe('skill');
  });

  it('fails closed on unknown section.field', () => {
    expect(
      classifyProposalProfileWrite(fieldUpdate('employment', 'unknownField')),
    ).toBeNull();
  });
});

describe('canAcceptQuestionnaireProfileProposal', () => {
  const manageProfiles = [
    Permission.EmployeesManageProfiles,
  ];
  const personalWrite = [
    Permission.EmployeesManageProfiles,
    Permission.EmployeesWritePersonal,
  ];
  const emergencyWrite = [
    Permission.EmployeesManageProfiles,
    Permission.EmployeesWriteEmergency,
  ];

  it('adminEq always accepts', () => {
    expect(
      canAcceptQuestionnaireProfileProposal({
        authz: authz({ isAdminEquivalent: true }),
        inManagedDept: false,
        change: fieldUpdate('employment', 'positionId'),
      }),
    ).toBe(true);
  });

  it('unknown mapping → DENY even with ManageProfiles', () => {
    expect(
      canAcceptQuestionnaireProfileProposal({
        authz: authz({ permissions: manageProfiles }),
        inManagedDept: true,
        change: fieldUpdate('employment', 'unknownField'),
      }),
    ).toBe(false);
  });

  it('employment org requires ManageProfiles + managed dept', () => {
    expect(
      canAcceptQuestionnaireProfileProposal({
        authz: authz({ permissions: manageProfiles }),
        inManagedDept: true,
        change: fieldUpdate('employment', 'positionId'),
      }),
    ).toBe(true);
    expect(
      canAcceptQuestionnaireProfileProposal({
        authz: authz({ permissions: manageProfiles }),
        inManagedDept: false,
        change: fieldUpdate('employment', 'positionId'),
      }),
    ).toBe(false);
  });

  it('work contact requires ManageProfiles + managed dept', () => {
    expect(
      canAcceptQuestionnaireProfileProposal({
        authz: authz({ permissions: manageProfiles }),
        inManagedDept: true,
        change: fieldUpdate('contacts', 'workEmail'),
      }),
    ).toBe(true);
    expect(
      canAcceptQuestionnaireProfileProposal({
        authz: authz({ permissions: manageProfiles }),
        inManagedDept: false,
        change: fieldUpdate('contacts', 'workEmail'),
      }),
    ).toBe(false);
  });

  it('personal_replace requires WritePersonal', () => {
    expect(
      canAcceptQuestionnaireProfileProposal({
        authz: authz({ permissions: manageProfiles }),
        inManagedDept: true,
        change: fieldUpdate('contacts', 'personal_replace'),
      }),
    ).toBe(false);
    expect(
      canAcceptQuestionnaireProfileProposal({
        authz: authz({ permissions: personalWrite }),
        inManagedDept: true,
        change: fieldUpdate('contacts', 'personal_replace'),
      }),
    ).toBe(true);
  });

  it('emergency_replace requires WriteEmergency', () => {
    expect(
      canAcceptQuestionnaireProfileProposal({
        authz: authz({ permissions: manageProfiles }),
        inManagedDept: true,
        change: fieldUpdate('contacts', 'emergency_replace'),
      }),
    ).toBe(false);
    expect(
      canAcceptQuestionnaireProfileProposal({
        authz: authz({ permissions: emergencyWrite }),
        inManagedDept: true,
        change: fieldUpdate('contacts', 'emergency_replace'),
      }),
    ).toBe(true);
  });

  it('add_skill requires ManageProfiles', () => {
    const skill: StoredQuestionnaireProposedChange = {
      kind: 'add_skill',
      section: 'skills',
      field: 'sewing',
      skillId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      skillCode: 'sewing',
      labelUa: 'Пошиття',
      proposedLevel: null,
      sourceScale: { kind: 'range', min: 0, max: 5 },
    };
    expect(
      canAcceptQuestionnaireProfileProposal({
        authz: authz({ permissions: [] }),
        inManagedDept: true,
        change: skill,
      }),
    ).toBe(false);
    expect(
      canAcceptQuestionnaireProfileProposal({
        authz: authz({ permissions: manageProfiles }),
        inManagedDept: true,
        change: skill,
      }),
    ).toBe(true);
  });
});
