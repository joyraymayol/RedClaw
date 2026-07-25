import { describe, expect, it } from "vitest";

import { canCreateNewSetupTicket } from "@/lib/production-plan-tickets";

const t1 = new Date("2026-07-01T00:00:00Z");
const t2 = new Date("2026-07-10T00:00:00Z");

describe("canCreateNewSetupTicket", () => {
  it("allows creation when the row has no ticket yet", () => {
    expect(canCreateNewSetupTicket(null, null)).toBe(true);
  });

  it("blocks creation while the latest ticket is still open and the row hasn't changed since", () => {
    expect(
      canCreateNewSetupTicket({ status: "OPEN", createdAt: t1 }, null)
    ).toBe(false);
  });

  it("blocks creation while the latest ticket is Closed and the row hasn't changed since", () => {
    expect(
      canCreateNewSetupTicket({ status: "CLOSED", createdAt: t1 }, null)
    ).toBe(false);
  });

  it("blocks creation when the row's last change predates the latest ticket", () => {
    expect(
      canCreateNewSetupTicket({ status: "OPEN", createdAt: t2 }, t1)
    ).toBe(false);
  });

  it("allows creation once the row changed after the latest (open) ticket was raised", () => {
    expect(
      canCreateNewSetupTicket({ status: "OPEN", createdAt: t1 }, t2)
    ).toBe(true);
  });

  it("allows creation once the row changed after the latest (Closed) ticket was raised", () => {
    expect(
      canCreateNewSetupTicket({ status: "CLOSED", createdAt: t1 }, t2)
    ).toBe(true);
  });

  it("always allows creation when the latest ticket was Cancelled, regardless of row changes", () => {
    expect(
      canCreateNewSetupTicket({ status: "CANCELLED", createdAt: t2 }, null)
    ).toBe(true);
    expect(
      canCreateNewSetupTicket({ status: "CANCELLED", createdAt: t2 }, t1)
    ).toBe(true);
  });
});
