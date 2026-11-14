-- AlterTable
ALTER TABLE `employee_profiles` ADD COLUMN `salary_type` ENUM('MONTHLY', 'WEEKLY', 'DAILY') NOT NULL DEFAULT 'MONTHLY';

-- AlterTable
ALTER TABLE `employee_salary_histories` ADD COLUMN `salary_type` ENUM('MONTHLY', 'WEEKLY', 'DAILY') NOT NULL DEFAULT 'MONTHLY';

-- AlterTable
ALTER TABLE `payslips` ADD COLUMN `salary_type_snapshot` ENUM('MONTHLY', 'WEEKLY', 'DAILY') NOT NULL DEFAULT 'MONTHLY',
    ADD COLUMN `base_pay_amount` DECIMAL(15, 2) NULL;
