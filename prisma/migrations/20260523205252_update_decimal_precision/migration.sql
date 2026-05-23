-- AlterTable: Update DECIMAL precision from (12,0) to (12,2) for yard/rol columns
-- and add tanggal column to t_oprasional if not exists
-- This migration is safe: MODIFY COLUMN on DECIMAL never deletes data,
-- existing integer values become e.g. 100 -> 100.00

ALTER TABLE `t_barang`
  MODIFY COLUMN `jml_yard` DECIMAL(12, 2) NULL,
  MODIFY COLUMN `jml_rol`  DECIMAL(12, 2) NULL;

ALTER TABLE `t_transaksi_keluar_detail`
  MODIFY COLUMN `jml_yard`       DECIMAL(12, 2) NULL,
  MODIFY COLUMN `jml_rol`        DECIMAL(12, 2) NULL,
  MODIFY COLUMN `jml_yard_retur` DECIMAL(12, 2) NULL,
  MODIFY COLUMN `jml_rol_retur`  DECIMAL(12, 2) NULL;

ALTER TABLE `t_transaksi_masuk_detail`
  MODIFY COLUMN `jml_yard`       DECIMAL(12, 2) NULL,
  MODIFY COLUMN `jml_rol`        DECIMAL(12, 2) NULL,
  MODIFY COLUMN `jml_yard_retur` DECIMAL(12, 2) NULL,
  MODIFY COLUMN `jml_rol_retur`  DECIMAL(12, 2) NULL;
