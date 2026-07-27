import { describe, expect, it } from "vitest";

import { diffIds, isFullTeamSwap } from "@/lib/id-diff";

describe("diffIds", () => {
  it("adds ids not in the current set", () => {
    expect(diffIds([], ["a", "b"])).toEqual({ toAdd: ["a", "b"], toRemove: [] });
  });

  it("removes ids not in the desired set", () => {
    expect(diffIds(["a", "b"], [])).toEqual({ toAdd: [], toRemove: ["a", "b"] });
  });

  it("computes a mixed add/remove diff", () => {
    const { toAdd, toRemove } = diffIds(["a", "b"], ["b", "c"]);
    expect(toAdd).toEqual(["c"]);
    expect(toRemove).toEqual(["a"]);
  });

  it("is a no-op when current and desired match, regardless of order", () => {
    expect(diffIds(["a", "b"], ["b", "a"])).toEqual({ toAdd: [], toRemove: [] });
  });

  it("dedupes duplicate ids on both sides", () => {
    expect(diffIds(["a", "a"], ["a", "b", "b"])).toEqual({ toAdd: ["b"], toRemove: [] });
  });
});

describe("isFullTeamSwap", () => {
  it("is true when every current member is removed and new members are added", () => {
    const currentIds = ["a", "b"];
    expect(isFullTeamSwap(currentIds, diffIds(currentIds, ["c", "d"]))).toBe(true);
  });

  it("is false when at least one original member survives", () => {
    const currentIds = ["a", "b"];
    expect(isFullTeamSwap(currentIds, diffIds(currentIds, ["b", "c"]))).toBe(false);
  });

  it("is false for an add-only change with no removals", () => {
    const currentIds = ["a"];
    expect(isFullTeamSwap(currentIds, diffIds(currentIds, ["a", "b"]))).toBe(false);
  });

  it("is false when there was no current membership to replace", () => {
    expect(isFullTeamSwap([], diffIds([], ["a"]))).toBe(false);
  });

  it("is false for a no-op diff", () => {
    const currentIds = ["a", "b"];
    expect(isFullTeamSwap(currentIds, diffIds(currentIds, ["b", "a"]))).toBe(false);
  });
});
