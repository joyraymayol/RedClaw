-- updateAssignees' full-team-swap path bumps an IN_PROGRESS ticket to
-- ON_HOLD when every currently-active technician is replaced in the same
-- edit — none of the existing hold reasons fit this case.

-- AlterEnum
ALTER TYPE "HoldReason" ADD VALUE 'TEAM_REPLACED';
