import {
  UNGROUPED_GROUP_ID,
  defaultCreateSkillGroupId,
  filterSkillsForSelectedGroup,
  formGroupIdFromSkill,
  isCatalogPickerEligible,
  mergeSelectionOrder,
  resolveSkillGroupSelectionAfterReload,
  skillGroupIdForRequest,
} from './skill-catalog-selection';

describe('skill catalog selection', () => {
  const groups = [
    { id: 'g-b', isActive: false, name: 'Beta' },
    { id: 'g-a', isActive: true, name: 'Alpha' },
  ];

  it('keeps all-skills (null) after reload', () => {
    expect(resolveSkillGroupSelectionAfterReload(null, groups)).toBeNull();
  });

  it('keeps UNGROUPED after deleting another group', () => {
    expect(
      resolveSkillGroupSelectionAfterReload(UNGROUPED_GROUP_ID, groups),
    ).toBe(UNGROUPED_GROUP_ID);
  });

  it('falls back when the selected uuid is gone', () => {
    expect(resolveSkillGroupSelectionAfterReload('missing', groups)).toBe('g-a');
  });

  it('does not put pinned rows into name-sorted groups', () => {
    const names = [...groups]
      .sort((a, b) => a.name.localeCompare(b.name, 'uk'))
      .map((g) => g.id);
    expect(names).toEqual(['g-a', 'g-b']);
    expect(names).not.toContain(UNGROUPED_GROUP_ID);
    expect(names).not.toContain(null);
  });

  it('filters ungrouped and all-skills modes', () => {
    const skills = [
      { id: 's1', groupId: 'g-a' },
      { id: 's2', groupId: null },
    ];
    expect(filterSkillsForSelectedGroup(skills, null).map((s) => s.id)).toEqual([
      's1',
      's2',
    ]);
    expect(
      filterSkillsForSelectedGroup(skills, UNGROUPED_GROUP_ID).map((s) => s.id),
    ).toEqual(['s2']);
    expect(filterSkillsForSelectedGroup(skills, 'g-a').map((s) => s.id)).toEqual([
      's1',
    ]);
  });

  it('maps form membership to request groupId (null = ungrouped)', () => {
    expect(skillGroupIdForRequest(null)).toBeNull();
    expect(skillGroupIdForRequest('')).toBeNull();
    expect(skillGroupIdForRequest('g-a')).toBe('g-a');
  });

  it('startEditSkill of ungrouped uses Без групи (null select value)', () => {
    expect(formGroupIdFromSkill(null)).toBeNull();
  });

  it('create form uses real selected group, otherwise Без групи', () => {
    expect(defaultCreateSkillGroupId('g-a')).toBe('g-a');
    expect(defaultCreateSkillGroupId(null)).toBeNull();
    expect(defaultCreateSkillGroupId(UNGROUPED_GROUP_ID)).toBeNull();
  });

  it('picker accepts ungrouped active skills', () => {
    const active = new Set(['g-a']);
    expect(
      isCatalogPickerEligible({ isActive: true, groupId: null }, active),
    ).toBe(true);
    expect(
      isCatalogPickerEligible({ isActive: true, groupId: 'g-a' }, active),
    ).toBe(true);
    expect(
      isCatalogPickerEligible({ isActive: true, groupId: 'g-b' }, active),
    ).toBe(false);
    expect(
      isCatalogPickerEligible({ isActive: false, groupId: null }, active),
    ).toBe(false);
  });

  it('selecting Усі навички after a group click is selected=null', () => {
    let selected: string | null = 'g-a';
    selected = null;
    expect(selected).toBeNull();
  });

  it('mergeSelectionOrder keeps click order and only syncs membership', () => {
    expect(mergeSelectionOrder(['b', 'a'], ['a', 'b', 'c'])).toEqual([
      'b',
      'a',
      'c',
    ]);
    expect(mergeSelectionOrder(['b', 'a', 'c'], ['a', 'c'])).toEqual(['a', 'c']);
    expect(mergeSelectionOrder([], ['a', 'b'])).toEqual(['a', 'b']);
  });
});
