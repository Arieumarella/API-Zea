const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  console.log("=== Running Multi-Toko Database Auto-Migration ===");
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`t_toko\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`nama_toko\` VARCHAR(255) NULL DEFAULT 'Zea Textile Pusat',
        \`alamat\` TEXT NULL,
        \`nomor_telepon_1\` VARCHAR(50) NULL,
        \`nomor_telepon_2\` VARCHAR(50) NULL,
        \`nomor_telepon3\` VARCHAR(50) NULL,
        \`rekening\` VARCHAR(100) NULL,
        \`nama_rekening\` VARCHAR(255) NULL,
        \`maps\` TEXT NULL,
        \`status_aktif\` TINYINT(1) NULL DEFAULT 1,
        \`created_at\` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
        \`updated_at\` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),
        PRIMARY KEY (\`id\`)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    `);

    try {
      await prisma.$executeRawUnsafe(`INSERT IGNORE INTO \`t_toko\` (\`id\`, \`nama_toko\`) VALUES (1, 'Zea Textile Pusat');`);
    } catch (e) {}

    const tables = ['t_barang', 't_log', 't_oprasional', 't_pelanggan', 't_saldo', 't_supplier', 't_transaksi_keluar', 't_transaksi_masuk', 't_user'];
    for (const table of tables) {
      try {
        await prisma.$executeRawUnsafe(`ALTER TABLE \`${table}\` ADD COLUMN \`id_toko\` INT NULL DEFAULT 1;`);
        console.log(`Added column id_toko to table ${table}`);
      } catch (e) {
        // Column already exists
      }
    }

    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE \`t_user\` ADD COLUMN \`role\` VARCHAR(50) NULL DEFAULT 'ADMIN_TOKO';`);
      console.log(`Added column role to table t_user`);
    } catch (e) {
      // Column already exists
    }

    for (const table of tables) {
      try {
        await prisma.$executeRawUnsafe(`UPDATE \`${table}\` SET \`id_toko\` = 1 WHERE \`id_toko\` IS NULL;`);
      } catch (e) {}
    }

    try {
      await prisma.$executeRawUnsafe(`UPDATE \`t_user\` SET \`role\` = 'SUPER_ADMIN' WHERE \`username\` = 'admin' OR \`jabatan\` LIKE '%owner%' OR \`jabatan\` LIKE '%pemilik%';`);
    } catch (e) {}

    console.log("=== Multi-Toko Database Auto-Migration Completed Successfully ===");
  } catch (err) {
    console.error("Auto Migration Warning:", err.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
