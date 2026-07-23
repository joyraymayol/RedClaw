import { z } from "zod";

import { Department } from "@/generated/prisma/enums";

export { Department };

// Display labels for the Department enum (the DB stores the enum value).
// Editing a label never needs a migration; adding/removing a department does
// (it's a real enum now, so authorization can rely on it).
export const DEPARTMENT_LABELS: Record<Department, string> = {
  PRODUCTION: "Production",
  MAINTENANCE: "Maintenance",
  QUALITY_ASSURANCE: "Quality Assurance",
  WAREHOUSE: "Warehouse",
  ADMINISTRATION: "Administration",
};

export const DEPARTMENTS = Object.keys(DEPARTMENT_LABELS) as Department[];

// Map from enum value -> display label, for base-ui Select `items` props and
// for rendering a stored department.
export const DEPARTMENT_ITEMS: Record<string, string> = DEPARTMENT_LABELS;

export function departmentLabel(d: Department | null | undefined): string {
  return d ? DEPARTMENT_LABELS[d] : "—";
}

export const POSITIONS = [
  "Operator",
  "Technician",
  "Line Leader",
  "Supervisor",
  "Engineer",
  "Manager",
  "Staff",
] as const;

export const departmentSchema = z.enum(DEPARTMENTS as [Department, ...Department[]]);
export const positionSchema = z.enum(POSITIONS);

export type Position = (typeof POSITIONS)[number];
