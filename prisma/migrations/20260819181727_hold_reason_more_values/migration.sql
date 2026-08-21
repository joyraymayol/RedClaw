-- Expands the on-hold reasons a technician can pick beyond the original
-- three (parts/vendor/other) to cover more of the real reasons a repair
-- stalls, matching the updated hold-reason dropdown.

-- AlterEnum
ALTER TYPE "HoldReason" ADD VALUE 'WAITING_EXTERNAL_TECHNICIAN';
ALTER TYPE "HoldReason" ADD VALUE 'WAITING_TOOLS_EQUIPMENT';
ALTER TYPE "HoldReason" ADD VALUE 'PRODUCTION_SCHEDULE_CONFLICT';
ALTER TYPE "HoldReason" ADD VALUE 'FURTHER_DIAGNOSIS_REQUIRED';
