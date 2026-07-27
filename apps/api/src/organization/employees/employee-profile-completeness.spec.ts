import {
  buildProfileCompletenessFacts,
  computeProfileCompleteness,
  projectProfileCompleteness,
  type ProfileCompletenessFacts,
} from './employee-profile-completeness';

const fullCoreFacts = (): ProfileCompletenessFacts => ({
  hasIdentity: true,
  hasActiveAssignment: true,
  hasAssignmentStructure: true,
  hasStartDate: true,
  hasWorkContact: true,
  hasPhoto: false,
  hasPersonalCore: false,
  hasPersonalContact: false,
  hasEmergencyContact: false,
  hasImportantDates: false,
});

describe('computeProfileCompleteness', () => {
  it('core is 100 without voluntary data; extended is below 100', () => {
    const result = computeProfileCompleteness(fullCoreFacts());
    expect(result.core.percent).toBe(100);
    expect(result.core.incompleteSections).toEqual([]);
    expect(result.extended.percent).toBe(0);
    expect(result.extended.incompleteSections).toEqual(
      expect.arrayContaining([
        'photo',
        'personalCore',
        'personalContacts',
        'emergency',
        'importantDates',
      ]),
    );
  });

  it('legacy employee.phoneNumber counts as work contact without work_phone row', () => {
    const facts = buildProfileCompletenessFacts({
      employee: {
        firstName: 'А',
        lastName: 'Б',
        employeeNumber: 'E1',
        phoneNumber: '+380501112233',
        workEmail: null,
        personalPhoneNumber: null,
        photoUrl: null,
        birthDate: null,
        city: null,
      },
      contacts: [],
      emergencyCount: 0,
      importantDatesCount: 0,
      assignment: {
        status: 'active',
        departmentId: 'd1',
        positionId: null,
        startDate: '2024-01-01',
      },
    });
    expect(facts.hasWorkContact).toBe(true);
    expect(computeProfileCompleteness(facts).core.sections.workContacts.complete).toBe(
      true,
    );
  });

  it('inactive assignment is not complete even if structure and startDate exist', () => {
    const facts = buildProfileCompletenessFacts({
      employee: {
        firstName: 'А',
        lastName: 'Б',
        employeeNumber: 'E1',
        phoneNumber: '+380501112233',
        workEmail: null,
        personalPhoneNumber: null,
        photoUrl: null,
        birthDate: null,
        city: null,
      },
      contacts: [],
      emergencyCount: 0,
      importantDatesCount: 0,
      assignment: {
        status: 'ended',
        departmentId: 'd1',
        positionId: 'p1',
        startDate: '2024-01-01',
      },
    });
    expect(facts.hasActiveAssignment).toBe(false);
    const result = computeProfileCompleteness(facts);
    expect(result.core.sections.assignment.complete).toBe(false);
    expect(result.core.incompleteSections).toContain('assignment');
  });

  it('same facts yield identical core percent (role-independent)', () => {
    const facts = fullCoreFacts();
    const a = computeProfileCompleteness(facts).core.percent;
    const b = computeProfileCompleteness({ ...facts }).core.percent;
    expect(a).toBe(b);
    expect(a).toBe(100);
  });
});

describe('projectProfileCompleteness', () => {
  it('manager on another employee gets extended null; core unchanged', () => {
    const scored = computeProfileCompleteness(fullCoreFacts());
    const forManager = projectProfileCompleteness(scored, false);
    const forAdmin = projectProfileCompleteness(scored, true);
    expect(forManager.core.percent).toBe(forAdmin.core.percent);
    expect(forManager.extended).toBeNull();
    expect(forAdmin.extended?.percent).toBe(scored.extended.percent);
  });
});
