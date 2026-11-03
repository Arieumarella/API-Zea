-- Additive migration: leave quota per year + resignation date.
-- Existing rows are initialized lazily by the application without changing
-- their current annual_leave_quota value (leave_quota_year = 0 means "not initialized").

ALTER TABLE `employee_profiles`
  ADD COLUMN `annual_leave_entitlement` INTEGER NOT NULL DEFAULT 12,
  ADD COLUMN `leave_quota_year` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `resign_date` DATE NULL;
