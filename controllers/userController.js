const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const bcrypt = require("bcryptjs");

// Get users with pagination (no password)
exports.getUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const take = 10;
    const skip = (page - 1) * take;
    const [users, total] = await Promise.all([
      prisma.t_user.findMany({
        skip,
        take,
        select: {
          id: true,
          username: true,
          nama: true,
          jabatan: true,
          no_tlp: true,
          created_at: true,
          updated_at: true,
        },
      }),
      prisma.t_user.count(),
    ]);
    return res.status(200).json({
      status: true,
      data: users,
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
    const { username, password, nama, jabatan, no_tlp } = req.body;
    const existingUser = await prisma.t_user.findFirst({ where: { username } });
    if (existingUser) {
      return res
        .status(400)
        .json({ status: false, message: "Username sudah digunakan" });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await prisma.t_user.create({
      data: {
        username,
        password: hashedPassword,
        nama,
        jabatan,
        no_tlp,
        created_at: new Date(),
        updated_at: new Date(),
      },
      select: {
        id: true,
        username: true,
        nama: true,
        jabatan: true,
        no_tlp: true,
        created_at: true,
        updated_at: true,
      },
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
    const { username, password, nama, jabatan, no_tlp } = req.body;
    const user = await prisma.t_user.findUnique({ where: { id } });
    if (!user) {
      return res
        .status(404)
        .json({ status: false, message: "User tidak ditemukan" });
    }
    let updateData = {
      username,
      nama,
      jabatan,
      no_tlp,
      updated_at: new Date(),
    };
    if (password && password.trim() !== "") {
      updateData.password = await bcrypt.hash(password, 10);
    }
    const updatedUser = await prisma.t_user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        username: true,
        nama: true,
        jabatan: true,
        no_tlp: true,
        updated_at: true,
      },
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
    return res
      .status(200)
      .json({ status: true, message: "User berhasil dihapus" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};
