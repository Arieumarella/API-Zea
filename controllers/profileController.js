const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Get profile toko based on active req.id_toko
exports.getProfile = async (req, res) => {
  try {
    const id_toko = req.id_toko || 1;
    let profile = await prisma.t_toko.findUnique({
      where: { id: id_toko },
    });
    
    // Fallback to t_profile_toko if t_toko is empty
    if (!profile) {
      profile = await prisma.t_profile_toko.findUnique({ where: { id: 1 } });
    }

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

// Create profile toko
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

    const created = await prisma.t_toko.create({
      data: {
        nama_toko: nama_toko || "Toko Baru",
        alamat: alamat || null,
        nomor_telepon_1: nomor_telepon_1 || null,
        nomor_telepon_2: nomor_telepon_2 || null,
        nomor_telepon3: nomor_telepon3 || null,
        rekening: rekening || null,
        nama_rekening: nama_rekening || null,
        maps: maps || null,
        status_aktif: true,
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

// Update profile toko based on req.id_toko
exports.updateProfile = async (req, res) => {
  try {
    const id_toko = req.id_toko || 1;
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

    const existing = await prisma.t_toko.findUnique({
      where: { id: id_toko },
    });

    if (existing) {
      const updated = await prisma.t_toko.update({
        where: { id: id_toko },
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

    const created = await prisma.t_toko.create({
      data: {
        id: id_toko,
        nama_toko: nama_toko || null,
        alamat: alamat || null,
        nomor_telepon_1: nomor_telepon_1 || null,
        nomor_telepon_2: nomor_telepon_2 || null,
        nomor_telepon3: nomor_telepon3 || null,
        rekening: rekening || null,
        nama_rekening: nama_rekening || null,
        maps: maps || null,
        status_aktif: true,
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

// Delete profile toko
exports.deleteProfile = async (req, res) => {
  try {
    const id_toko = req.id_toko || 1;
    const existing = await prisma.t_toko.findUnique({
      where: { id: id_toko },
    });
    if (!existing) {
      return res
        .status(404)
        .json({ status: false, message: "Profile toko tidak ditemukan" });
    }

    await prisma.t_toko.update({
      where: { id: id_toko },
      data: { status_aktif: false, updated_at: new Date() },
    });
    return res
      .status(200)
      .json({ status: true, message: "Profile toko dinonaktifkan" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

