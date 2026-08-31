import {
  assignmentDialogSubmitLabel,
  assignmentDialogTitle,
  closeAssignmentDialog,
  createEmploymentAssignmentForm,
  emptyEmploymentAssignmentForm,
  employmentAssignmentFormFromHistory,
  isAssignmentDialogOpen,
  isArchivalNamedValue,
  openCreateAssignmentDialog,
  openEditAssignmentDialog,
  toEmploymentAssignmentWrite,
} from './employment-assignment-dialog.model';

describe('employment-assignment-dialog.model', () => {
  it('keeps create and edit mutually exclusive', () => {
    const created = openCreateAssignmentDialog();
    const edited = openEditAssignmentDialog({
      assignmentId: 'a1',
    });
    expect(created.kind).toBe('create');
    expect(edited.kind).toBe('edit');
    expect(isAssignmentDialogOpen(created)).toBe(true);
    expect(isAssignmentDialogOpen(closeAssignmentDialog())).toBe(false);
  });

  it('labels create vs edit deterministically', () => {
    expect(assignmentDialogTitle(openCreateAssignmentDialog())).toBe(
      'Нове призначення',
    );
    expect(assignmentDialogSubmitLabel(openCreateAssignmentDialog())).toBe(
      'Створити',
    );
    expect(
      assignmentDialogSubmitLabel(
        openEditAssignmentDialog({ assignmentId: 'a1' }),
      ),
    ).toBe('Зберегти');
  });

  it('prefills create startDate with Kyiv business today', () => {
    const form = createEmploymentAssignmentForm(
      new Date('2026-08-24T22:30:00.000Z'),
    );
    expect(form.startDate).toBe('2026-08-25');
    expect(emptyEmploymentAssignmentForm().startDate).toBe('');
  });

  it('omits endDate on create writes and includes it on edit', () => {
    const form = {
      ...emptyEmploymentAssignmentForm(),
      directionId: 'd1',
      endDate: '2026-01-01',
    };
    expect(toEmploymentAssignmentWrite(form, 'create')).not.toHaveProperty(
      'endDate',
    );
    expect(toEmploymentAssignmentWrite(form, 'edit').endDate).toBe('2026-01-01');
  });

  it('hydrates edit form from history without sharing the source object', () => {
    const form = employmentAssignmentFormFromHistory({
      id: 'a1',
      status: 'ended',
      companyId: null,
      directionId: 'd1',
      departmentId: 'dep1',
      positionId: 'p1',
      functionalRole: null,
      managerEmployeeId: null,
      mentorEmployeeId: null,
      hrResponsibleEmployeeId: null,
      workLocation: 'Kyiv',
      workFormat: 'Офіс',
      employmentType: null,
      contractType: null,
      startDate: '2026-01-01',
      endDate: '2026-02-01',
      probationStartDate: null,
      probationEndDate: null,
      comment: 'move',
      activationBlockedReason: null,
      activationCheckedAt: null,
      isDepartmentManager: true,
      managedDepartmentIds: ['dep1'],
      updatedAt: '2026-01-02T00:00:00.000Z',
      department: null,
      position: null,
      company: null,
      direction: null,
    });
    expect(form.directionId).toBe('d1');
    expect(form.workLocation).toBe('Kyiv');
    expect(form.isDepartmentManager).toBe(true);
    expect(form.managedDepartmentIds).toEqual(['dep1']);
    form.workLocation = 'changed';
    expect(form.endDate).toBe('2026-02-01');
  });

  it('includes manager fields in write payload', () => {
    const form = {
      ...emptyEmploymentAssignmentForm(),
      isDepartmentManager: true,
      managedDepartmentIds: ['dep1'],
    };
    expect(toEmploymentAssignmentWrite(form, 'create')).toMatchObject({
      isDepartmentManager: true,
      managedDepartmentIds: ['dep1'],
    });
    expect(
      toEmploymentAssignmentWrite(
        { ...form, isDepartmentManager: false, managedDepartmentIds: ['dep1'] },
        'create',
      ).managedDepartmentIds,
    ).toEqual([]);
  });

  it('marks catalog names missing from the active list as archival', () => {
    expect(isArchivalNamedValue('Офіс', ['Віддалено'])).toBe(true);
    expect(isArchivalNamedValue('Офіс', ['Офіс'])).toBe(false);
    expect(isArchivalNamedValue('', ['Офіс'])).toBe(false);
  });
});
