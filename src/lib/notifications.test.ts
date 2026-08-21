import { beforeEach, describe, expect, it, vi } from "vitest";

// The module imports the prisma singleton for its read helpers; stub it so
// importing the module never constructs a real client. The emit helpers and
// resolvers under test all take a transaction client as an argument, so they
// never touch this singleton.
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import type { Prisma } from "@/generated/prisma/client";
import {
  adminRecipients,
  createNotification,
  maintenanceLeads,
  maintenanceStaff,
  notifyUsers,
  planApprovers,
  qaLeads,
  supervisors,
} from "@/lib/notifications";

function makeTx() {
  const create = vi.fn().mockResolvedValue(undefined);
  const createMany = vi.fn().mockResolvedValue({ count: 0 });
  const userFindMany = vi.fn().mockResolvedValue([]);
  const approverFindMany = vi.fn().mockResolvedValue([]);
  const tx = {
    notification: { create, createMany },
    user: { findMany: userFindMany },
    productionPlanApprover: { findMany: approverFindMany },
  } as unknown as Prisma.TransactionClient;
  return { tx, create, createMany, userFindMany, approverFindMany };
}

const payload = { type: "TICKET_ASSIGNED", title: "Assigned to TKT-1", linkPath: "/tickets/1" } as const;

describe("createNotification", () => {
  let h: ReturnType<typeof makeTx>;
  beforeEach(() => {
    h = makeTx();
  });

  it("skips the write when the recipient is the actor", async () => {
    await createNotification(h.tx, "user-1", { ...payload, actorId: "user-1" });
    expect(h.create).not.toHaveBeenCalled();
  });

  it("writes when the recipient differs from the actor", async () => {
    await createNotification(h.tx, "user-2", { ...payload, actorId: "user-1" });
    expect(h.create).toHaveBeenCalledTimes(1);
    expect(h.create.mock.calls[0][0].data).toMatchObject({
      userId: "user-2",
      actorId: "user-1",
      type: "TICKET_ASSIGNED",
      title: "Assigned to TKT-1",
      linkPath: "/tickets/1",
      body: null,
    });
  });

  it("writes when there is no actor (system event)", async () => {
    await createNotification(h.tx, "user-2", payload);
    expect(h.create).toHaveBeenCalledTimes(1);
    expect(h.create.mock.calls[0][0].data.actorId).toBeNull();
  });
});

describe("notifyUsers", () => {
  let h: ReturnType<typeof makeTx>;
  beforeEach(() => {
    h = makeTx();
  });

  it("de-duplicates recipients and drops the actor", async () => {
    await notifyUsers(h.tx, ["a", "a", "b", "actor"], { ...payload, actorId: "actor" });
    expect(h.createMany).toHaveBeenCalledTimes(1);
    const rows = h.createMany.mock.calls[0][0].data as { userId: string }[];
    expect(rows.map((r) => r.userId)).toEqual(["a", "b"]);
  });

  it("is a no-op when no recipients remain after filtering", async () => {
    await notifyUsers(h.tx, ["actor", "actor"], { ...payload, actorId: "actor" });
    expect(h.createMany).not.toHaveBeenCalled();
  });

  it("is a no-op for an empty recipient list", async () => {
    await notifyUsers(h.tx, [], payload);
    expect(h.createMany).not.toHaveBeenCalled();
  });
});

describe("recipient resolvers", () => {
  let h: ReturnType<typeof makeTx>;
  beforeEach(() => {
    h = makeTx();
  });

  it("adminRecipients queries ACTIVE ADMIN+HEAD and maps ids", async () => {
    h.userFindMany.mockResolvedValueOnce([{ id: "x" }, { id: "y" }]);
    const ids = await adminRecipients(h.tx);
    expect(ids).toEqual(["x", "y"]);
    expect(h.userFindMany.mock.calls[0][0].where).toEqual({
      status: "ACTIVE",
      role: { in: ["ADMIN", "HEAD"] },
    });
  });

  it("maintenanceLeads matches ADMIN or Maintenance HEAD/SUPERVISOR", async () => {
    await maintenanceLeads(h.tx);
    expect(h.userFindMany.mock.calls[0][0].where).toEqual({
      status: "ACTIVE",
      OR: [
        { role: "ADMIN" },
        { department: "MAINTENANCE", role: { in: ["HEAD", "SUPERVISOR"] } },
      ],
    });
  });

  it("maintenanceStaff matches every active Maintenance-department user, any role", async () => {
    await maintenanceStaff(h.tx);
    expect(h.userFindMany.mock.calls[0][0].where).toEqual({
      status: "ACTIVE",
      department: "MAINTENANCE",
    });
  });

  it("qaLeads matches ADMIN or QA HEAD/SUPERVISOR", async () => {
    await qaLeads(h.tx);
    expect(h.userFindMany.mock.calls[0][0].where).toEqual({
      status: "ACTIVE",
      OR: [
        { role: "ADMIN" },
        { department: "QUALITY_ASSURANCE", role: { in: ["HEAD", "SUPERVISOR"] } },
      ],
    });
  });

  it("planApprovers filters to active approvers and maps userId", async () => {
    h.approverFindMany.mockResolvedValueOnce([{ userId: "p1" }, { userId: "p2" }]);
    const ids = await planApprovers(h.tx);
    expect(ids).toEqual(["p1", "p2"]);
    expect(h.approverFindMany.mock.calls[0][0].where).toEqual({
      user: { status: "ACTIVE" },
    });
  });

  it("supervisors matches SUPERVISOR/HEAD, department-agnostic, no ADMIN bypass", async () => {
    await supervisors(h.tx);
    expect(h.userFindMany.mock.calls[0][0].where).toEqual({
      status: "ACTIVE",
      role: { in: ["SUPERVISOR", "HEAD"] },
    });
  });
});
