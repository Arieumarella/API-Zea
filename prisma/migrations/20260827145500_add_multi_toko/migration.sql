-- 1. Create t_toko Table if not exists
CREATE TABLE IF NOT EXISTS `t_toko` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nama_toko` VARCHAR(255) NULL,
    `alamat` TEXT NULL,
    `nomor_telepon_1` VARCHAR(15) NULL,
    `nomor_telepon_2` VARCHAR(15) NULL,
    `nomor_telepon3` VARCHAR(15) NULL,
    `rekening` VARCHAR(20) NULL,
    `nama_rekening` VARCHAR(20) NULL,
    `maps` TEXT NULL,
    `status_aktif` BOOLEAN NULL DEFAULT true,
    `created_at` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 2. Insert default Store #1 (Zea Textile Pusat) if t_toko is empty
INSERT INTO `t_toko` (`id`, `nama_toko`, `alamat`, `nomor_telepon_1`, `nomor_telepon_2`, `nomor_telepon3`, `rekening`, `nama_rekening`, `maps`)
SELECT 1, COALESCE(nama_toko, 'Zea Textile Pusat'), alamat, nomor_telepon_1, nomor_telepon_2, nomor_telepon3, rekening, nama_rekening, maps
FROM `t_profile_toko`
LIMIT 1;

-- If t_profile_toko was empty, ensure ID=1 exists
INSERT IGNORE INTO `t_toko` (`id`, `nama_toko`) VALUES (1, 'Zea Textile Pusat');

-- 3. Add id_toko and role columns to existing tables if not present
SET @dbname = DATABASE();

-- Add id_toko to t_barang
SET @tablename = "t_barang";
SET @columnname = "id_toko";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  "SELECT 1",
  "ALTER TABLE `t_barang` ADD COLUMN `id_toko` INT NULL DEFAULT 1;"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add id_toko to t_log
SET @tablename = "t_log";
SET @columnname = "id_toko";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  "SELECT 1",
  "ALTER TABLE `t_log` ADD COLUMN `id_toko` INT NULL DEFAULT 1;"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add id_toko to t_oprasional
SET @tablename = "t_oprasional";
SET @columnname = "id_toko";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  "SELECT 1",
  "ALTER TABLE `t_oprasional` ADD COLUMN `id_toko` INT NULL DEFAULT 1;"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add id_toko to t_pelanggan
SET @tablename = "t_pelanggan";
SET @columnname = "id_toko";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  "SELECT 1",
  "ALTER TABLE `t_pelanggan` ADD COLUMN `id_toko` INT NULL DEFAULT 1;"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add id_toko to t_saldo
SET @tablename = "t_saldo";
SET @columnname = "id_toko";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  "SELECT 1",
  "ALTER TABLE `t_saldo` ADD COLUMN `id_toko` INT NULL DEFAULT 1;"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add id_toko to t_supplier
SET @tablename = "t_supplier";
SET @columnname = "id_toko";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  "SELECT 1",
  "ALTER TABLE `t_supplier` ADD COLUMN `id_toko` INT NULL DEFAULT 1;"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add id_toko to t_transaksi_keluar
SET @tablename = "t_transaksi_keluar";
SET @columnname = "id_toko";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  "SELECT 1",
  "ALTER TABLE `t_transaksi_keluar` ADD COLUMN `id_toko` INT NULL DEFAULT 1;"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add id_toko to t_transaksi_masuk
SET @tablename = "t_transaksi_masuk";
SET @columnname = "id_toko";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  "SELECT 1",
  "ALTER TABLE `t_transaksi_masuk` ADD COLUMN `id_toko` INT NULL DEFAULT 1;"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add id_toko & role to t_user
SET @tablename = "t_user";
SET @columnname = "id_toko";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  "SELECT 1",
  "ALTER TABLE `t_user` ADD COLUMN `id_toko` INT NULL DEFAULT 1;"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @tablename = "t_user";
SET @columnname = "role";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  "SELECT 1",
  "ALTER TABLE `t_user` ADD COLUMN `role` VARCHAR(50) NULL DEFAULT 'ADMIN_TOKO';"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 4. Backfill all NULL id_toko to 1 for existing records
UPDATE `t_barang` SET `id_toko` = 1 WHERE `id_toko` IS NULL;
UPDATE `t_log` SET `id_toko` = 1 WHERE `id_toko` IS NULL;
UPDATE `t_oprasional` SET `id_toko` = 1 WHERE `id_toko` IS NULL;
UPDATE `t_pelanggan` SET `id_toko` = 1 WHERE `id_toko` IS NULL;
UPDATE `t_saldo` SET `id_toko` = 1 WHERE `id_toko` IS NULL;
UPDATE `t_supplier` SET `id_toko` = 1 WHERE `id_toko` IS NULL;
UPDATE `t_transaksi_keluar` SET `id_toko` = 1 WHERE `id_toko` IS NULL;
UPDATE `t_transaksi_masuk` SET `id_toko` = 1 WHERE `id_toko` IS NULL;
UPDATE `t_user` SET `id_toko` = 1 WHERE `id_toko` IS NULL;
UPDATE `t_user` SET `role` = 'SUPER_ADMIN' WHERE `username` = 'admin' OR `jabatan` LIKE '%owner%' OR `jabatan` LIKE '%pemilik%';
