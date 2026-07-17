import { describe, expect, it } from "vitest";

import { diffIds } from "@/lib/id-diff";

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
