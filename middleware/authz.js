const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { syncLeaveQuota } = require("../utils/hrShared");

function hrEnabled(req, res, next) {
  if (process.env.HR_MODULE_ENABLED === "false") {
    return res.status(503).json({
      status: false,
      message: "Modul HR sedang dinonaktifkan.",
    });
  }
  next();
}

function requireSuperAdmin(req, res, next) {
  if (!req.user || req.user.role !== "SUPER_ADMIN") {
    return res.status(403).json({
      status: false,
      message: "Hanya Super Admin yang dapat mengakses fitur ini.",
    });
  }
  next();
}

async function requireEmployee(req, res, next) {
  try {
    const userId = req.user && req.user.userId ? parseInt(req.user.userId, 10) : 0;
    const profile = await prisma.employee_profiles.findUnique({
      where: { user_id: userId },
    });
    if (!profile) {
      return res.status(403).json({
        status: false,
        message: "Akun Anda tidak terdaftar sebagai pegawai. Hubungi admin untuk pendaftaran.",
      });
    }
    if (!profile.is_active) {
      return res.status(403).json({
        status: false,
        message: "Status pegawai Anda tidak aktif. Hubungi admin.",
      });
    }
    req.employee = await syncLeaveQuota(profile);
    next();
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
}

module.exports = { hrEnabled, requireSuperAdmin, requireEmployee };
