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
