/** Pure set-diff between a current and desired id membership (ticket assignees, ticket asset flags, product capabilities). */
export function diffIds(
  currentIds: readonly string[],
  desiredIds: readonly string[]
): { toAdd: string[]; toRemove: string[] } {
  const current = new Set(currentIds);
  const desired = new Set(desiredIds);
  return {
    toAdd: [...desired].filter((id) => !current.has(id)),
    toRemove: [...current].filter((id) => !desired.has(id)),
  };
}

/** True when every currently-active member is removed while at least one new member is added — a full team replacement, not a partial reshuffle. */
export function isFullTeamSwap(
  currentIds: readonly string[],
  diff: { toAdd: readonly string[]; toRemove: readonly string[] }
): boolean {
  return currentIds.length > 0 && diff.toRemove.length === currentIds.length && diff.toAdd.length > 0;
}
