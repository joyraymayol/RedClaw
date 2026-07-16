import { describe, expect, it } from "vitest";

import { diffAssignees } from "@/lib/assignment-diff";

describe("diffAssignees", () => {
  it("adds members not in the current set", () => {
    expect(diffAssignees([], ["a", "b"])).toEqual({ toAdd: ["a", "b"], toRemove: [] });
  });

  it("removes members not in the desired set", () => {
    expect(diffAssignees(["a", "b"], [])).toEqual({ toAdd: [], toRemove: ["a", "b"] });
  });

  it("computes a mixed add/remove diff", () => {
    const { toAdd, toRemove } = diffAssignees(["a", "b"], ["b", "c"]);
    expect(toAdd).toEqual(["c"]);
    expect(toRemove).toEqual(["a"]);
  });

  it("is a no-op when current and desired match, regardless of order", () => {
    expect(diffAssignees(["a", "b"], ["b", "a"])).toEqual({ toAdd: [], toRemove: [] });
  });

  it("dedupes duplicate ids on both sides", () => {
    expect(diffAssignees(["a", "a"], ["a", "b", "b"])).toEqual({ toAdd: ["b"], toRemove: [] });
  });
});
