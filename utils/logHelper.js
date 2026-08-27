const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

/**
 * Creates an activity log entry asynchronously (non-blocking)
 * @param {Object} params
 * @param {number} [params.id_toko]
 * @param {number} [params.id_user]
 * @param {string} [params.aksi]
 * @param {string} [params.keterangan]
 */
exports.createLog = async ({ id_toko, id_user, aksi, keterangan }) => {
  try {
    await prisma.t_log.create({
      data: {
        id_toko: id_toko ? parseInt(id_toko) : 1,
        id_user: id_user ? parseInt(id_user) : null,
        aksi: aksi || "AKSI",
        keterangan: keterangan || "",
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
  } catch (error) {
    console.error("Error writing activity log:", error.message);
  }
};
