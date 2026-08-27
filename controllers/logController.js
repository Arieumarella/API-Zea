const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Get logs with pagination, search filter, and store filter
exports.getLogs = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const take = parseInt(req.query.limit) || 15;
    const skip = (page - 1) * take;
    const search = req.query.search || "";
    const id_toko = req.id_toko || 1;
    const isSuperAdmin = req.user && req.user.role === "SUPER_ADMIN";

    // Super Admin can view logs from all stores or specific store
    const where = {
      ...(isSuperAdmin && req.query.all_stores === "true" ? {} : { id_toko }),
      ...(search
        ? {
            OR: [
              { aksi: { contains: search } },
              { keterangan: { contains: search } },
            ],
          }
        : {}),
    };

    const [logs, total, users, stores] = await Promise.all([
      prisma.t_log.findMany({
        where,
        skip,
        take,
        orderBy: { id: "desc" },
      }),
      prisma.t_log.count({ where }),
      prisma.t_user.findMany({
        select: { id: true, nama: true, username: true },
      }),
      prisma.t_toko.findMany({
        select: { id: true, nama_toko: true },
      }),
    ]);

    const userMap = {};
    users.forEach((u) => (userMap[u.id] = u.nama || u.username));

    const storeMap = {};
    stores.forEach((s) => (storeMap[s.id] = s.nama_toko));

    const enrichedLogs = logs.map((log) => ({
      ...log,
      nama_user: userMap[log.id_user] || "Sistem / Anonim",
      nama_toko: storeMap[log.id_toko] || `Toko #${log.id_toko}`,
    }));

    return res.status(200).json({
      status: true,
      data: enrichedLogs,
      page,
      total,
      totalPages: Math.ceil(total / take),
    });
  } catch (error) {
    console.error("Error fetching logs:", error);
    return res.status(500).json({ status: false, message: error.message });
  }
};
