const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { createLog } = require("../utils/logHelper");


// Get list of all stores
exports.getAllToko = async (req, res) => {
  try {
    const stores = await prisma.t_toko.findMany({
      orderBy: { id: "asc" },
    });
    return res.status(200).json({
      status: true,
      data: stores,
    });
  } catch (error) {
    console.error("Error in getAllToko:", error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

// Get single store by ID
exports.getTokoById = async (req, res) => {
  try {
    const { id } = req.params;
    const store = await prisma.t_toko.findUnique({
      where: { id: parseInt(id) },
    });
    if (!store) {
      return res.status(404).json({ status: false, message: "Toko tidak ditemukan" });
    }
    return res.status(200).json({
      status: true,
      data: store,
    });
  } catch (error) {
    console.error("Error in getTokoById:", error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

// Create a new store and initialize its starting cash balance in t_saldo
exports.createToko = async (req, res) => {
  try {
    const isSuperAdmin = req.user && req.user.role === "SUPER_ADMIN";
    if (!isSuperAdmin) {
      return res.status(403).json({
        status: false,
        message: "Hanya Super Admin yang berhak menambahkan cabang toko baru",
      });
    }

    const {
      nama_toko,
      alamat,
      nomor_telepon_1,
      nomor_telepon_2,
      nomor_telepon3,
      rekening,
      nama_rekening,
      maps,
      saldo_awal,
    } = req.body;

    if (!nama_toko) {
      return res.status(400).json({ status: false, message: "Nama toko wajib diisi" });
    }

    // Create Store record
    const newStore = await prisma.t_toko.create({
      data: {
        nama_toko,
        alamat,
        nomor_telepon_1,
        nomor_telepon_2,
        nomor_telepon3,
        rekening,
        nama_rekening,
        maps,
        status_aktif: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    // Initialize cash balance (t_saldo) for this new store
    await prisma.t_saldo.create({
      data: {
        id_toko: newStore.id,
        jml_saldo: saldo_awal ? parseFloat(saldo_awal) : 0,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    createLog({
      id_toko: newStore.id,
      id_user: req.user?.userId,
      aksi: "TAMBAH_TOKO",
      keterangan: `Mendaftarkan cabang toko baru '${nama_toko}' dengan kas awal Rp ${Number(saldo_awal || 0).toLocaleString('id-ID')}`,
    });

    return res.status(201).json({
      status: true,
      message: "Toko baru berhasil ditambahkan",
      data: newStore,
    });
  } catch (error) {
    console.error("Error in createToko:", error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

// Update store profile
exports.updateToko = async (req, res) => {
  try {
    const isSuperAdmin = req.user && req.user.role === "SUPER_ADMIN";
    if (!isSuperAdmin) {
      return res.status(403).json({
        status: false,
        message: "Hanya Super Admin yang berhak memperbarui profil cabang toko",
      });
    }

    const { id } = req.params;
    const {
      nama_toko,
      alamat,
      nomor_telepon_1,
      nomor_telepon_2,
      nomor_telepon3,
      rekening,
      nama_rekening,
      maps,
      status_aktif,
    } = req.body;

    const existingStore = await prisma.t_toko.findUnique({
      where: { id: parseInt(id) },
    });

    if (!existingStore) {
      return res.status(404).json({ status: false, message: "Toko tidak ditemukan" });
    }

    const updatedStore = await prisma.t_toko.update({
      where: { id: parseInt(id) },
      data: {
        nama_toko: nama_toko !== undefined ? nama_toko : existingStore.nama_toko,
        alamat: alamat !== undefined ? alamat : existingStore.alamat,
        nomor_telepon_1: nomor_telepon_1 !== undefined ? nomor_telepon_1 : existingStore.nomor_telepon_1,
        nomor_telepon_2: nomor_telepon_2 !== undefined ? nomor_telepon_2 : existingStore.nomor_telepon_2,
        nomor_telepon3: nomor_telepon3 !== undefined ? nomor_telepon3 : existingStore.nomor_telepon3,
        rekening: rekening !== undefined ? rekening : existingStore.rekening,
        nama_rekening: nama_rekening !== undefined ? nama_rekening : existingStore.nama_rekening,
        maps: maps !== undefined ? maps : existingStore.maps,
        status_aktif: status_aktif !== undefined ? status_aktif : existingStore.status_aktif,
        updated_at: new Date(),
      },
    });

    createLog({
      id_toko: updatedStore.id,
      id_user: req.user?.userId,
      aksi: "EDIT_TOKO",
      keterangan: `Memperbarui informasi profil toko #${updatedStore.id} '${updatedStore.nama_toko}'`,
    });

    return res.status(200).json({
      status: true,
      message: "Profil toko berhasil diperbarui",
      data: updatedStore,
    });
  } catch (error) {
    console.error("Error in updateToko:", error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

// Deactivate store
exports.deleteToko = async (req, res) => {
  try {
    const isSuperAdmin = req.user && req.user.role === "SUPER_ADMIN";
    if (!isSuperAdmin) {
      return res.status(403).json({
        status: false,
        message: "Hanya Super Admin yang berhak menonaktifkan cabang toko",
      });
    }

    const { id } = req.params;
    const existingStore = await prisma.t_toko.findUnique({
      where: { id: parseInt(id) },
    });

    if (!existingStore) {
      return res.status(404).json({ status: false, message: "Toko tidak ditemukan" });
    }

    await prisma.t_toko.update({
      where: { id: parseInt(id) },
      data: {
        status_aktif: false,
        updated_at: new Date(),
      },
    });

    return res.status(200).json({
      status: true,
      message: "Toko berhasil dinonaktifkan",
    });
  } catch (error) {
    console.error("Error in deleteToko:", error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

