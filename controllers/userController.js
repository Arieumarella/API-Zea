const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const bcrypt = require("bcryptjs");
const { createLog } = require("../utils/logHelper");


// Get users with pagination (no password)
exports.getUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const take = 10;
    const skip = (page - 1) * take;
    const id_toko = req.id_toko || 1;

    // Super Admin sees all users or filtered by store
    const isSuperAdmin = req.user && req.user.role === "SUPER_ADMIN";
    const where = isSuperAdmin && req.query.all_stores === "true" ? {} : { id_toko };

    const [users, total, stores] = await Promise.all([
      prisma.t_user.findMany({
        where,
        skip,
        take,
        select: {
          id: true,
          id_toko: true,
          role: true,
          username: true,
          nama: true,
          jabatan: true,
          no_tlp: true,
          created_at: true,
          updated_at: true,
        },
      }),
      prisma.t_user.count({ where }),
      prisma.t_toko.findMany({ select: { id: true, nama_toko: true } }),
    ]);

    const storeMap = {};
    stores.forEach((s) => (storeMap[s.id] = s.nama_toko));

    const usersWithStore = users.map((u) => ({
      ...u,
      nama_toko: storeMap[u.id_toko] || `Toko #${u.id_toko}`,
    }));

    return res.status(200).json({
      status: true,
      data: usersWithStore,
      page,
      total,
      totalPages: Math.ceil(total / take),
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};


// Get user by id (no password)
exports.getUserById = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const user = await prisma.t_user.findUnique({
      where: { id },
      select: {
        id: true,
        id_toko: true,
        role: true,
        username: true,
        nama: true,
        jabatan: true,
        no_tlp: true,
        created_at: true,
        updated_at: true,
      },
    });
    if (!user) {
      return res
        .status(404)
        .json({ status: false, message: "User tidak ditemukan" });
    }
    return res.status(200).json({ status: true, user });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

// Create user
exports.createUser = async (req, res) => {
  try {
    const { username, password, nama, jabatan, no_tlp, id_toko, role } = req.body;
    const existingUser = await prisma.t_user.findFirst({ where: { username } });
    if (existingUser) {
      return res
        .status(400)
        .json({ status: false, message: "Username sudah digunakan" });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const isSuperAdmin = req.user && req.user.role === "SUPER_ADMIN";

    // Only Super Admin can specify custom id_toko and role
    const targetTokoId = isSuperAdmin && id_toko ? parseInt(id_toko) : (req.id_toko || 1);
    const targetRole = isSuperAdmin && role ? role : "ADMIN_TOKO";

    const newUser = await prisma.t_user.create({
      data: {
        id_toko: targetTokoId,
        role: targetRole,
        username,
        password: hashedPassword,
        nama,
        jabatan: jabatan || "Staff Admin",
        no_tlp,
        created_at: new Date(),
        updated_at: new Date(),
      },
      select: {
        id: true,
        id_toko: true,
        role: true,
        username: true,
        nama: true,
        jabatan: true,
        no_tlp: true,
        created_at: true,
        updated_at: true,
      },
    });

    createLog({
      id_toko: targetTokoId,
      id_user: req.user?.userId,
      aksi: "TAMBAH_USER",
      keterangan: `Mendaftarkan pengguna baru '${nama}' (${username}) dengan role ${targetRole}`,
    });

    return res.status(201).json({ status: true, user: newUser });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

// Update user
exports.updateUser = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { username, password, nama, jabatan, no_tlp, id_toko, role } = req.body;
    const user = await prisma.t_user.findUnique({ where: { id } });
    if (!user) {
      return res
        .status(404)
        .json({ status: false, message: "User tidak ditemukan" });
    }
    const isSuperAdmin = req.user && req.user.role === "SUPER_ADMIN";

    let updateData = {
      username,
      nama,
      no_tlp,
      updated_at: new Date(),
    };

    // Only Super Admin can modify id_toko, role, and jabatan
    if (isSuperAdmin) {
      if (id_toko) updateData.id_toko = parseInt(id_toko);
      if (role) updateData.role = role;
      if (jabatan) updateData.jabatan = jabatan;
    }

    if (password && password.trim() !== "") {
      updateData.password = await bcrypt.hash(password, 10);
    }
    const updatedUser = await prisma.t_user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        id_toko: true,
        role: true,
        username: true,
        nama: true,
        jabatan: true,
        no_tlp: true,
        updated_at: true,
      },
    });

    createLog({
      id_toko: updatedUser.id_toko || req.id_toko || 1,
      id_user: req.user?.userId,
      aksi: "EDIT_USER",
      keterangan: `Memperbarui akun pengguna #${id} '${updatedUser.nama}'`,
    });

    return res.status(200).json({ status: true, user: updatedUser });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};


// Delete user
exports.deleteUser = async (req, res) => {
  try {
    const isSuperAdmin = req.user && req.user.role === "SUPER_ADMIN";
    if (!isSuperAdmin) {
      return res.status(403).json({
        status: false,
        message: "Hanya Super Admin yang berhak menghapus user",
      });
    }

    const id = parseInt(req.params.id);
    const user = await prisma.t_user.findUnique({ where: { id } });
    if (!user) {
      return res
        .status(404)
        .json({ status: false, message: "User tidak ditemukan" });
    }

    // Cek relasi di transaksi keluar
    const usedInKeluar = await prisma.t_transaksi_keluar.findFirst({
      where: { id_user: id },
    });
    if (usedInKeluar) {
      return res
        .status(400)
        .json({
          status: false,
          message:
            "User tidak bisa dihapus karena sudah digunakan di transaksi keluar",
        });
    }
    // Cek relasi di transaksi masuk
    const usedInMasuk = await prisma.t_transaksi_masuk.findFirst({
      where: { id_user: id },
    });
    if (usedInMasuk) {
      return res
        .status(400)
        .json({
          status: false,
          message:
            "User tidak bisa dihapus karena sudah digunakan di transaksi masuk",
        });
    }
    await prisma.t_user.delete({ where: { id } });

    createLog({
      id_toko: user.id_toko || req.id_toko || 1,
      id_user: req.user?.userId,
      aksi: "HAPUS_USER",
      keterangan: `Menghapus akun pengguna #${id} '${user.nama}' (${user.username})`,
    });

    return res
      .status(200)
      .json({ status: true, message: "User berhasil dihapus" });
  } catch (error) {

    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

