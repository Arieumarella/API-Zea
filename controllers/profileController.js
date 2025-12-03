const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Get profile toko (id = 1)
exports.getProfile = async (req, res) => {
  try {
    const profile = await prisma.t_profile_toko.findUnique({
      where: { id: 1 },
    });
    if (!profile) {
      return res
        .status(404)
        .json({ status: false, message: "Profile toko tidak ditemukan" });
    }
    return res.status(200).json({ status: true, data: profile });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

// Create profile toko (only if not exists)
exports.createProfile = async (req, res) => {
  try {
    const {
      nama_toko,
      alamat,
      nomor_telepon_1,
      nomor_telepon_2,
      nomor_telepon3,
      rekening,
      nama_rekening,
      maps,
    } = req.body;

    const existing = await prisma.t_profile_toko.findUnique({
      where: { id: 1 },
    });
    if (existing) {
      return res
        .status(400)
        .json({ status: false, message: "Profile sudah ada. Gunakan update." });
    }

    const created = await prisma.t_profile_toko.create({
      data: {
        nama_toko: nama_toko || null,
        alamat: alamat || null,
        nomor_telepon_1: nomor_telepon_1 || null,
        nomor_telepon_2: nomor_telepon_2 || null,
        nomor_telepon3: nomor_telepon3 || null,
        rekening: rekening || null,
        nama_rekening: nama_rekening || null,
        maps: maps || null,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    return res
      .status(201)
      .json({ status: true, message: "Profile toko dibuat", data: created });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

// Update profile toko (id = 1). If not exists, create it.
exports.updateProfile = async (req, res) => {
  try {
    const {
      nama_toko,
      alamat,
      nomor_telepon_1,
      nomor_telepon_2,
      nomor_telepon3,
      rekening,
      nama_rekening,
      maps,
    } = req.body;

    const existing = await prisma.t_profile_toko.findUnique({
      where: { id: 1 },
    });

    if (existing) {
      const updated = await prisma.t_profile_toko.update({
        where: { id: 1 },
        data: {
          nama_toko: nama_toko !== undefined ? nama_toko : existing.nama_toko,
          alamat: alamat !== undefined ? alamat : existing.alamat,
          nomor_telepon_1:
            nomor_telepon_1 !== undefined
              ? nomor_telepon_1
              : existing.nomor_telepon_1,
          nomor_telepon_2:
            nomor_telepon_2 !== undefined
              ? nomor_telepon_2
              : existing.nomor_telepon_2,
          nomor_telepon3:
            nomor_telepon3 !== undefined
              ? nomor_telepon3
              : existing.nomor_telepon3,
          rekening: rekening !== undefined ? rekening : existing.rekening,
          nama_rekening:
            nama_rekening !== undefined
              ? nama_rekening
              : existing.nama_rekening,
          maps: maps !== undefined ? maps : existing.maps,
          updated_at: new Date(),
        },
      });
      return res
        .status(200)
        .json({
          status: true,
          message: "Profile toko diperbarui",
          data: updated,
        });
    }

    // jika belum ada, buat baru
    const created = await prisma.t_profile_toko.create({
      data: {
        nama_toko: nama_toko || null,
        alamat: alamat || null,
        nomor_telepon_1: nomor_telepon_1 || null,
        nomor_telepon_2: nomor_telepon_2 || null,
        nomor_telepon3: nomor_telepon3 || null,
        rekening: rekening || null,
        nama_rekening: nama_rekening || null,
        maps: maps || null,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    return res
      .status(201)
      .json({ status: true, message: "Profile toko dibuat", data: created });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

// Delete profile toko (id = 1)
exports.deleteProfile = async (req, res) => {
  try {
    const existing = await prisma.t_profile_toko.findUnique({
      where: { id: 1 },
    });
    if (!existing) {
      return res
        .status(404)
        .json({ status: false, message: "Profile toko tidak ditemukan" });
    }

    await prisma.t_profile_toko.delete({ where: { id: 1 } });
    return res
      .status(200)
      .json({ status: true, message: "Profile toko dihapus" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};
