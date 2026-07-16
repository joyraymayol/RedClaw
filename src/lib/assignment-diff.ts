/** Pure set-diff between a ticket's current and desired technician membership. */
export function diffAssignees(
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
