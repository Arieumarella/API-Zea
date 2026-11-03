const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");

function formatEmployeeCode(userId) {
  return `EMP-${String(userId).padStart(4, "0")}`;
}

function toDateOnly(dateStringValue) {
  if (!dateStringValue) return null;
  const date = new Date(dateStringValue);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return new Date(`${year}-${month}-${day}T00:00:00Z`);
}

async function main() {
  console.log("=== HR default data backfill ===");
  console.log(DRY_RUN ? "Mode: DRY RUN (no database writes)" : "Mode: APPLY");

  const [stores, users, existingConfigs, existingProfiles] = await Promise.all([
    prisma.t_toko.findMany({ orderBy: { id: "asc" } }),
    prisma.t_user.findMany({
      where: { role: "ADMIN_TOKO" },
      orderBy: { id: "asc" },
    }),
    prisma.store_hr_configs.findMany({ select: { store_id: true } }),
    prisma.employee_profiles.findMany({ select: { user_id: true } }),
  ]);

  const configuredStoreIds = new Set(existingConfigs.map((row) => row.store_id));
  const profiledUserIds = new Set(existingProfiles.map((row) => row.user_id));

  const storesToCreate = stores.filter((store) => !configuredStoreIds.has(store.id));
  const usersToCreate = users.filter((user) => !profiledUserIds.has(user.id));

  console.log(`Stores found: ${stores.length}`);
  console.log(`ADMIN_TOKO users found: ${users.length}`);
  console.log(`Store HR configs to create: ${storesToCreate.length}`);
  console.log(`Employee profiles to create: ${usersToCreate.length}`);

  for (const store of storesToCreate) {
    console.log(`  + store_hr_configs for store #${store.id} (${store.nama_toko || "-"})`);
    if (!DRY_RUN) {
      await prisma.store_hr_configs.create({
        data: {
          store_id: store.id,
          radius_meters: 50,
          work_start_time: "08:00",
          work_end_time: "17:00",
          grace_period_minutes: 15,
          late_penalty_per_occurrence: 0,
          missing_checkout_penalty: 0,
          work_days: "1,2,3,4,5,6",
        },
      });
    }
  }

  for (const user of usersToCreate) {
    console.log(
      `  + employee_profiles for user #${user.id} (${user.nama || user.username || "-"}) -> store #${user.id_toko || 1}`
    );
    if (!DRY_RUN) {
      await prisma.employee_profiles.create({
        data: {
          user_id: user.id,
          store_id: user.id_toko || 1,
          employee_code: formatEmployeeCode(user.id),
          position: user.jabatan || "Staff",
          base_salary: 0,
          fixed_meal_allowance: 0,
          fixed_transport_allowance: 0,
          overtime_rate_per_hour: 0,
          annual_leave_quota: 12,
          annual_leave_entitlement: 12,
          leave_quota_year: new Date().getFullYear(),
          join_date: toDateOnly(user.created_at),
          allow_any_store_checkin: false,
          is_active: true,
        },
      });
    }
  }

  console.log("=== Backfill completed ===");
  console.log("Existing POS tables were not modified.");
}

main()
  .catch((error) => {
    console.error("Backfill failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
