-- Additive migration:
-- 1. store_shifts: multi-shift per store.
-- 2. employee_salary_histories: salary/position history.
-- 3. employee_profiles.shift_id: shift assignment.
-- 4. attendances: mobile audit columns (mocked location, device, app version).

CREATE TABLE `store_shifts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `store_id` INTEGER NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `work_start_time` VARCHAR(5) NOT NULL DEFAULT '08:00',
    `work_end_time` VARCHAR(5) NOT NULL DEFAULT '17:00',
    `grace_period_minutes` INTEGER NOT NULL DEFAULT 15,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    INDEX `store_shifts_store_id_idx` (`store_id`),
    PRIMARY KEY (`id`)
);

CREATE TABLE `employee_salary_histories` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `store_id` INTEGER NOT NULL,
    `effective_date` DATE NOT NULL,
    `position` VARCHAR(100) NULL,
    `base_salary` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `notes` TEXT NULL,
    `created_by` INTEGER NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    INDEX `employee_salary_histories_user_id_idx` (`user_id`),
    PRIMARY KEY (`id`)
);

ALTER TABLE `employee_profiles`
  ADD COLUMN `shift_id` INTEGER NULL;

CREATE INDEX `employee_profiles_shift_id_idx` ON `employee_profiles`(`shift_id`);

ALTER TABLE `attendances`
  ADD COLUMN `check_in_is_mocked_location` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `check_out_is_mocked_location` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `device_id` VARCHAR(100) NULL,
  ADD COLUMN `app_version` VARCHAR(20) NULL;
