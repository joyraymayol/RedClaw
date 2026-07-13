import { z } from "zod";

// Placeholder lists — replace with the real org structure from the
// maintenance admin before employee onboarding starts. Values are stored
// as plain strings in the DB, so editing these lists never needs a migration.
export const DEPARTMENTS = [
  "Production",
  "Maintenance",
  "Quality Assurance",
  "Warehouse",
  "Administration",
] as const;

export const POSITIONS = [
  "Operator",
  "Technician",
  "Line Leader",
  "Supervisor",
  "Engineer",
  "Manager",
  "Staff",
] as const;

export const departmentSchema = z.enum(DEPARTMENTS);
export const positionSchema = z.enum(POSITIONS);

export type Department = (typeof DEPARTMENTS)[number];
export type Position = (typeof POSITIONS)[number];
