export const UNGROUPED_GROUP_ID = '__ungrouped__';

export function resolveSkillGroupSelectionAfterReload(
  selected: string | null,
  groups: Array<{ id: string; isActive: boolean }>,
): string | null {
  if (selected === null || selected === UNGROUPED_GROUP_ID) return selected;
  if (groups.some((g) => g.id === selected)) return selected;
  return groups.find((g) => g.isActive)?.id ?? groups[0]?.id ?? null;
}

export function filterSkillsForSelectedGroup<T extends { groupId: string | null }>(
  skills: T[],
  selected: string | null,
): T[] {
  if (selected === UNGROUPED_GROUP_ID) {
    return skills.filter((s) => s.groupId == null);
  }
  if (selected) {
    return skills.filter((s) => s.groupId === selected);
  }
  return skills;
}

export function isCatalogPickerEligible(
  skill: { isActive: boolean; groupId: string | null },
  activeGroupIds: Set<string>,
): boolean {
  return (
    skill.isActive && (skill.groupId == null || activeGroupIds.has(skill.groupId))
  );
}

/** Live membership: UUID or null. Empty form values are ungrouped. */
export function skillGroupIdForRequest(
  formGroupId: string | null,
): string | null {
  return formGroupId || null;
}

export function defaultCreateSkillGroupId(selected: string | null): string | null {
  if (selected && selected !== UNGROUPED_GROUP_ID) return selected;
  return null;
}

export function formGroupIdFromSkill(groupId: string | null): string | null {
  return groupId;
}

/** Keep prior chip order; append newly attached ids; drop ids no longer in membership. */
export function mergeSelectionOrder(
  currentOrder: readonly string[],
  membership: readonly string[],
): string[] {
  const next = new Set(membership);
  const kept = currentOrder.filter((id) => next.has(id));
  const keptSet = new Set(kept);
  return [...kept, ...membership.filter((id) => !keptSet.has(id))];
}
