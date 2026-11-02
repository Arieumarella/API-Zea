const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const { dateString } = require("./hrTime");

async function getStoreConfig(storeId) {
  return prisma.store_hr_configs.findUnique({
    where: { store_id: parseInt(storeId, 10) },
  });
}

async function getStoreWithConfig(storeId) {
  const [store, config] = await Promise.all([
    prisma.t_toko.findUnique({ where: { id: parseInt(storeId, 10) } }),
    getStoreConfig(storeId),
  ]);
  return { store, config };
}

async function isDateLockedByFinalPayroll(userId, date) {
  const target = dateString(date);
  const payslips = await prisma.payslips.findMany({
    where: {
      user_id: parseInt(userId, 10),
      period_start: { lte: new Date(`${target}T23:59:59Z`) },
      period_end: { gte: new Date(`${target}T00:00:00Z`) },
    },
    select: { payroll_id: true },
  });
  if (payslips.length === 0) return false;

  const payrollIds = payslips.map((payslip) => payslip.payroll_id);
  const finalized = await prisma.payrolls.count({
    where: { id: { in: payrollIds }, status: "FINAL" },
  });
  return finalized > 0;
}

async function getStoreNameMap(storeIds) {
  const stores = await prisma.t_toko.findMany({
    where: { id: { in: storeIds } },
    select: { id: true, nama_toko: true },
  });
  const map = {};
  stores.forEach((store) => {
    map[store.id] = store.nama_toko;
  });
  return map;
}

module.exports = {
  getStoreConfig,
  getStoreWithConfig,
  isDateLockedByFinalPayroll,
  getStoreNameMap,
};

