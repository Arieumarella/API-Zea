const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const POS_MODELS = [
  "t_user",
  "t_toko",
  "t_barang",
  "t_saldo",
  "t_supplier",
  "t_pelanggan",
  "t_oprasional",
  "t_log",
  "t_berjangka_keluar",
  "t_berjangka_masuk",
  "t_transaksi_keluar",
  "t_transaksi_keluar_detail",
  "t_transaksi_masuk",
  "t_transaksi_masuk_detail",
  "t_profile_toko",
];

const HR_MODELS = [
  "store_hr_configs",
  "holidays",
  "employee_profiles",
  "attendances",
  "leave_requests",
  "overtime_requests",
  "attendance_corrections",
  "employee_loans",
  "payrolls",
  "payslips",
];

async function main() {
  console.log("=== Cek data existing (POS) — read-only, tidak mengubah apa pun ===");
  for (const model of POS_MODELS) {
    const count = await prisma[model].count();
    console.log(`${model}: ${count}`);
  }

  console.log("\n=== Cek tabel HR (baru) ===");
  for (const model of HR_MODELS) {
    const count = await prisma[model].count();
    console.log(`${model}: ${count}`);
  }
}

main()
  .catch((error) => {
    console.error("Check failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
