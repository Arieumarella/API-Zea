-- Additive HR & payroll schema.
-- This migration only creates new tables and indexes.
-- It does not alter, update, or delete any existing table or row.

CREATE TABLE `store_hr_configs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `store_id` INTEGER NOT NULL,
    `latitude` DECIMAL(10, 7) NULL,
    `longitude` DECIMAL(10, 7) NULL,
    `radius_meters` INTEGER NOT NULL DEFAULT 50,
    `work_start_time` VARCHAR(5) NOT NULL DEFAULT '08:00',
    `work_end_time` VARCHAR(5) NOT NULL DEFAULT '17:00',
    `grace_period_minutes` INTEGER NOT NULL DEFAULT 15,
    `late_penalty_per_occurrence` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `missing_checkout_penalty` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `work_days` VARCHAR(20) NOT NULL DEFAULT '1,2,3,4,5,6',
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `store_hr_configs_store_id_key`(`store_id`),
    INDEX `store_hr_configs_store_id_idx`(`store_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `holidays` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `store_id` INTEGER NOT NULL,
    `holiday_date` DATE NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `holidays_store_id_holiday_date_key`(`store_id`, `holiday_date`),
    INDEX `holidays_store_id_holiday_date_idx`(`store_id`, `holiday_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `employee_profiles` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `store_id` INTEGER NOT NULL,
    `employee_code` VARCHAR(50) NULL,
    `nik` VARCHAR(30) NULL,
    `position` VARCHAR(100) NULL,
    `base_salary` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `fixed_meal_allowance` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `fixed_transport_allowance` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `overtime_rate_per_hour` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `bank_account` VARCHAR(50) NULL,
    `bank_name` VARCHAR(100) NULL,
    `annual_leave_quota` INTEGER NOT NULL DEFAULT 12,
    `join_date` DATE NULL,
    `allow_any_store_checkin` BOOLEAN NOT NULL DEFAULT false,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `employee_profiles_user_id_key`(`user_id`),
    UNIQUE INDEX `employee_profiles_employee_code_key`(`employee_code`),
    INDEX `employee_profiles_store_id_idx`(`store_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `attendances` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `store_id` INTEGER NOT NULL,
    `attendance_date` DATE NOT NULL,
    `check_in_time` DATETIME(0) NULL,
    `check_in_photo` VARCHAR(255) NULL,
    `check_in_latitude` DECIMAL(10, 7) NULL,
    `check_in_longitude` DECIMAL(10, 7) NULL,
    `check_in_distance_m` DECIMAL(10, 2) NULL,
    `check_in_accuracy_m` DECIMAL(10, 2) NULL,
    `check_out_time` DATETIME(0) NULL,
    `check_out_photo` VARCHAR(255) NULL,
    `check_out_latitude` DECIMAL(10, 7) NULL,
    `check_out_longitude` DECIMAL(10, 7) NULL,
    `check_out_distance_m` DECIMAL(10, 2) NULL,
    `check_out_accuracy_m` DECIMAL(10, 2) NULL,
    `status` ENUM('PRESENT', 'LATE', 'SICK', 'ANNUAL_LEAVE', 'UNPAID_LEAVE', 'FIELD_DUTY', 'ALPHA') NOT NULL,
    `late_minutes` INTEGER NOT NULL DEFAULT 0,
    `notes` TEXT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `attendances_user_id_attendance_date_key`(`user_id`, `attendance_date`),
    INDEX `attendances_store_id_attendance_date_idx`(`store_id`, `attendance_date`),
    INDEX `attendances_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `leave_requests` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `store_id` INTEGER NOT NULL,
    `type` ENUM('SICK', 'ANNUAL_LEAVE', 'UNPAID_LEAVE', 'FIELD_DUTY') NOT NULL,
    `start_date` DATE NOT NULL,
    `end_date` DATE NOT NULL,
    `reason` TEXT NOT NULL,
    `attachment` VARCHAR(255) NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `approved_by` INTEGER NULL,
    `approved_at` DATETIME(0) NULL,
    `admin_notes` TEXT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),

    INDEX `leave_requests_user_id_status_idx`(`user_id`, `status`),
    INDEX `leave_requests_store_id_start_date_idx`(`store_id`, `start_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `overtime_requests` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `store_id` INTEGER NOT NULL,
    `overtime_date` DATE NOT NULL,
    `start_time` VARCHAR(5) NOT NULL,
    `end_time` VARCHAR(5) NOT NULL,
    `duration_hours` DECIMAL(5, 2) NOT NULL,
    `reason` TEXT NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `approved_by` INTEGER NULL,
    `approved_at` DATETIME(0) NULL,
    `admin_notes` TEXT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),

    INDEX `overtime_requests_user_id_status_idx`(`user_id`, `status`),
    INDEX `overtime_requests_store_id_overtime_date_idx`(`store_id`, `overtime_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `attendance_corrections` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `store_id` INTEGER NOT NULL,
    `attendance_date` DATE NOT NULL,
    `correction_type` ENUM('LATE_DISPENSATION', 'MISSING_CHECKOUT') NOT NULL,
    `requested_check_in_time` VARCHAR(5) NULL,
    `requested_check_out_time` VARCHAR(5) NULL,
    `reason` TEXT NOT NULL,
    `attachment` VARCHAR(255) NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `approved_by` INTEGER NULL,
    `approved_at` DATETIME(0) NULL,
    `admin_notes` TEXT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),

    INDEX `attendance_corrections_user_id_status_idx`(`user_id`, `status`),
    INDEX `attendance_corrections_store_id_attendance_date_idx`(`store_id`, `attendance_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `employee_loans` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `store_id` INTEGER NOT NULL,
    `total_amount` DECIMAL(15, 2) NOT NULL,
    `monthly_installment` DECIMAL(15, 2) NOT NULL,
    `remaining_balance` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `loan_date` DATE NOT NULL,
    `reason` TEXT NOT NULL,
    `status` ENUM('PENDING', 'APPROVED_ACTIVE', 'REJECTED', 'PAID_OFF') NOT NULL DEFAULT 'PENDING',
    `approved_by` INTEGER NULL,
    `approved_at` DATETIME(0) NULL,
    `admin_notes` TEXT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),

    INDEX `employee_loans_user_id_status_idx`(`user_id`, `status`),
    INDEX `employee_loans_store_id_loan_date_idx`(`store_id`, `loan_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `payrolls` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `store_id` INTEGER NULL,
    `period_name` VARCHAR(100) NOT NULL,
    `cutoff_start_date` DATE NOT NULL,
    `cutoff_end_date` DATE NOT NULL,
    `status` ENUM('DRAFT', 'FINAL') NOT NULL DEFAULT 'DRAFT',
    `total_employees` INTEGER NOT NULL DEFAULT 0,
    `total_gross` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `total_deduction` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `total_net` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `generated_by` INTEGER NULL,
    `finalized_at` DATETIME(0) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),

    INDEX `payrolls_store_id_cutoff_start_date_idx`(`store_id`, `cutoff_start_date`),
    INDEX `payrolls_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `payslips` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `payroll_id` INTEGER NOT NULL,
    `user_id` INTEGER NOT NULL,
    `store_id` INTEGER NOT NULL,
    `store_name_snapshot` VARCHAR(255) NULL,
    `employee_code_snapshot` VARCHAR(50) NULL,
    `employee_name_snapshot` VARCHAR(255) NULL,
    `position_snapshot` VARCHAR(100) NULL,
    `bank_account_snapshot` VARCHAR(50) NULL,
    `bank_name_snapshot` VARCHAR(100) NULL,
    `period_start` DATE NOT NULL,
    `period_end` DATE NOT NULL,
    `base_salary` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `fixed_meal_allowance` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `fixed_transport_allowance` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `overtime_rate_per_hour` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `total_working_days` INTEGER NOT NULL DEFAULT 0,
    `total_present_days` INTEGER NOT NULL DEFAULT 0,
    `total_late_count` INTEGER NOT NULL DEFAULT 0,
    `total_absent_days` INTEGER NOT NULL DEFAULT 0,
    `total_unpaid_leave_days` INTEGER NOT NULL DEFAULT 0,
    `total_missing_checkout_count` INTEGER NOT NULL DEFAULT 0,
    `total_overtime_hours` DECIMAL(8, 2) NOT NULL DEFAULT 0,
    `meal_allowance_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `transport_allowance_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `overtime_pay` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `late_deduction_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `absence_deduction_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `unpaid_leave_deduction_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `missing_checkout_deduction_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `loan_deduction_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `other_deduction_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `bonus_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `gross_salary` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `total_deduction` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `net_salary` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `loan_breakdown` JSON NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `payslips_payroll_id_user_id_key`(`payroll_id`, `user_id`),
    INDEX `payslips_user_id_idx`(`user_id`),
    INDEX `payslips_store_id_idx`(`store_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
