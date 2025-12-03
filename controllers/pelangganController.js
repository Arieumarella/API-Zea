const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Get pelanggan with pagination and search
exports.getPelanggan = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const take = 10;
    const skip = (page - 1) * take;
    const search = req.query.search || "";
    const whereFind = search ? { nama: { contains: search } } : {};
    const whereCount = search ? { nama: { contains: search } } : {};
    const [pelanggan, total] = await Promise.all([
      prisma.t_pelanggan.findMany({
        skip,
        take,
        where: whereFind,
        orderBy: { id: "desc" },
      }),
      prisma.t_pelanggan.count({ where: whereCount }),
    ]);
    return res.status(200).json({
      status: true,
      data: pelanggan,
      page,
      total,
      totalPages: Math.ceil(total / take),
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

// Get all pelanggan without pagination
exports.getAllPelanggan = async (req, res) => {
  try {
    const pelanggan = await prisma.t_pelanggan.findMany({
      orderBy: { id: "asc" },
    });
    return res.status(200).json({
      status: true,
      data: pelanggan,
      total: pelanggan.length,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

// Get pelanggan by id
exports.getPelangganById = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const pelanggan = await prisma.t_pelanggan.findUnique({ where: { id } });
    if (!pelanggan) {
      return res
        .status(404)
        .json({ status: false, message: "Pelanggan tidak ditemukan" });
    }
    return res.status(200).json({ status: true, pelanggan });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

// Create pelanggan
exports.createPelanggan = async (req, res) => {
  try {
    const { nama, no_tlp } = req.body;
    const pelanggan = await prisma.t_pelanggan.create({
      data: {
        nama,
        no_tlp,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
    return res.status(201).json({ status: true, pelanggan });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

// Update pelanggan
exports.updatePelanggan = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { nama, no_tlp } = req.body;
    const pelanggan = await prisma.t_pelanggan.findUnique({ where: { id } });
    if (!pelanggan) {
      return res
        .status(404)
        .json({ status: false, message: "Pelanggan tidak ditemukan" });
    }
    const updatedPelanggan = await prisma.t_pelanggan.update({
      where: { id },
      data: {
        nama,
        no_tlp,
        updated_at: new Date(),
      },
    });
    return res.status(200).json({ status: true, pelanggan: updatedPelanggan });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

// Delete pelanggan
exports.deletePelanggan = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const pelanggan = await prisma.t_pelanggan.findUnique({ where: { id } });
    if (!pelanggan) {
      return res
        .status(404)
        .json({ status: false, message: "Pelanggan tidak ditemukan" });
    }
    // Cek relasi di transaksi keluar
    const usedInTransKeluar = await prisma.t_transaksi_keluar.findFirst({
      where: { id_pelanggan: id },
    });
    if (usedInTransKeluar) {
      return res.status(400).json({
        status: false,
        message:
          "Pelanggan tidak bisa dihapus karena sudah digunakan di transaksi keluar",
      });
    }
    await prisma.t_pelanggan.delete({ where: { id } });
    return res
      .status(200)
      .json({ status: true, message: "Pelanggan berhasil dihapus" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};
