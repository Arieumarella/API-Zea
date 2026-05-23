-- CreateTable
CREATE TABLE `t_barang` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `kd_barang` VARCHAR(255) NULL,
    `nama_barang` VARCHAR(255) NULL,
    `jml_yard` DECIMAL(12, 2) NULL,
    `jml_rol` DECIMAL(12, 2) NULL,
    `created_at` DATETIME(0) NULL,
    `updated_at` DATETIME(0) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `t_berjangka_keluar` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `id_transaksi` INTEGER NULL,
    `tgl_jatuh_tempo` DATE NULL,
    `jml_bayar` DECIMAL(15, 2) NULL,
    `created_at` DATETIME(0) NULL,
    `updated_at` DATETIME(0) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `t_berjangka_masuk` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `id_transaksi` INTEGER NULL,
    `tgl_jatuh_tempo` DATE NULL,
    `jml_bayar` DECIMAL(15, 2) NULL,
    `created_at` DATETIME(0) NULL,
    `updated_at` DATETIME(0) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `t_log` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `id_user` INTEGER NULL,
    `aksi` VARCHAR(255) NULL,
    `keterangan` TEXT NULL,
    `created_at` DATETIME(0) NULL,
    `updated_at` DATETIME(0) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `t_oprasional` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `id_user` INTEGER NULL,
    `nama_baya` VARCHAR(255) NULL,
    `tanggal` DATE NULL,
    `jml_biaya` DECIMAL(15, 2) NULL,
    `created_at` DATETIME(0) NULL,
    `updated_at` DATETIME(0) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `t_pelanggan` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nama` VARCHAR(255) NULL,
    `no_tlp` VARCHAR(255) NULL,
    `created_at` DATETIME(0) NULL,
    `updated_at` DATETIME(0) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `t_profile_toko` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nama_toko` VARCHAR(255) NULL,
    `alamat` TEXT NULL,
    `nomor_telepon_1` VARCHAR(15) NULL,
    `nomor_telepon_2` VARCHAR(15) NULL,
    `nomor_telepon3` VARCHAR(15) NULL,
    `rekening` VARCHAR(20) NULL,
    `nama_rekening` VARCHAR(20) NULL,
    `maps` TEXT NULL,
    `created_at` DATETIME(0) NULL,
    `updated_at` DATETIME(0) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `t_saldo` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `jml_saldo` DECIMAL(15, 2) NULL,
    `created_at` DATETIME(0) NULL,
    `updated_at` DATETIME(0) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `t_supplier` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nama` VARCHAR(255) NULL,
    `no_tlp` VARCHAR(15) NULL,
    `created_at` DATETIME(0) NULL,
    `updated_at` DATETIME(0) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `t_transaksi_keluar` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `id_pelanggan` INTEGER NULL,
    `id_user` INTEGER NULL,
    `tgl_transaksi` DATE NULL,
    `total_transaksi` DECIMAL(15, 2) NULL,
    `status_pembayaran` VARCHAR(255) NULL,
    `tenor` INTEGER NULL,
    `tipe_discount` VARCHAR(255) NULL,
    `jml_discount` DECIMAL(15, 2) NULL,
    `tipe_ppn` VARCHAR(255) NULL,
    `jml_ppn` DECIMAL(15, 2) NULL,
    `catatan` TEXT NULL,
    `created_at` DATETIME(0) NULL,
    `updated_at` DATETIME(0) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `t_transaksi_keluar_detail` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `id_transaksi_keluar` INTEGER NULL,
    `id_barang` INTEGER NULL,
    `jml_yard` DECIMAL(12, 2) NULL,
    `jml_rol` DECIMAL(12, 2) NULL,
    `harga_satuan` DECIMAL(15, 2) NULL,
    `jml_yard_retur` DECIMAL(12, 2) NULL,
    `jml_rol_retur` DECIMAL(12, 2) NULL,
    `created_at` DATETIME(0) NULL,
    `updated_at` DATETIME(0) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `t_transaksi_masuk` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `id_supplier` INTEGER NULL,
    `id_user` INTEGER NULL,
    `tgl_transaksi` DATE NULL,
    `total_transaksi` DECIMAL(15, 2) NULL,
    `status_pembayaran` VARCHAR(255) NULL,
    `tenor` INTEGER NULL,
    `tipe_discount` VARCHAR(255) NOT NULL,
    `jml_discount` DECIMAL(15, 2) NULL,
    `tipe_ppn` VARCHAR(255) NULL,
    `jml_ppn` DECIMAL(15, 2) NULL,
    `catatan` TEXT NULL,
    `created_at` DATETIME(0) NULL,
    `updated_at` DATETIME(0) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `t_transaksi_masuk_detail` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `id_transaksi_masuk` INTEGER NULL,
    `id_barang` INTEGER NULL,
    `jml_yard` DECIMAL(12, 2) NULL,
    `jml_rol` DECIMAL(12, 2) NULL,
    `harga_satuan` DECIMAL(15, 2) NULL,
    `jml_yard_retur` DECIMAL(12, 2) NULL,
    `jml_rol_retur` DECIMAL(12, 2) NULL,
    `created_at` DATETIME(0) NULL,
    `updated_at` DATETIME(0) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `t_user` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(255) NULL,
    `password` VARCHAR(255) NULL,
    `nama` VARCHAR(255) NULL,
    `jabatan` VARCHAR(255) NULL,
    `no_tlp` VARCHAR(15) NULL,
    `created_at` DATETIME(0) NULL,
    `updated_at` DATETIME(0) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
