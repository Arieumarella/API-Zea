const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Get suppliers with pagination and search
exports.getSuppliers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const take = 10;
    const skip = (page - 1) * take;
    const search = req.query.search || "";
    const where = search ? { nama: { contains: search } } : {};
    const [suppliers, total] = await Promise.all([
      prisma.t_supplier.findMany({
        skip,
        take,
        where,
        orderBy: { id: "desc" },
      }),
      prisma.t_supplier.count({ where }),
    ]);
    return res.status(200).json({
      status: true,
      data: suppliers,
      page,
      total,
      totalPages: Math.ceil(total / take),
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

// Get all suppliers (no pagination)
exports.getAllSuppliers = async (req, res) => {
  try {
    const suppliers = await prisma.t_supplier.findMany({
      orderBy: { id: "desc" },
      select: {
        id: true,
        nama: true,
        no_tlp: true,
        created_at: true,
        updated_at: true,
      },
    });
    return res.status(200).json({ status: true, data: suppliers });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

// Get supplier by id
exports.getSupplierById = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const supplier = await prisma.t_supplier.findUnique({ where: { id } });
    if (!supplier) {
      return res
        .status(404)
        .json({ status: false, message: "Supplier tidak ditemukan" });
    }
    return res.status(200).json({ status: true, supplier });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

// Create supplier
exports.createSupplier = async (req, res) => {
  try {
    const { nama, no_tlp } = req.body;
    const supplier = await prisma.t_supplier.create({
      data: {
        nama,
        no_tlp,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
    return res.status(201).json({ status: true, supplier });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

// Update supplier
exports.updateSupplier = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { nama, no_tlp } = req.body;
    const supplier = await prisma.t_supplier.findUnique({ where: { id } });
    if (!supplier) {
      return res
        .status(404)
        .json({ status: false, message: "Supplier tidak ditemukan" });
    }
    const updatedSupplier = await prisma.t_supplier.update({
      where: { id },
      data: {
        nama,
        no_tlp,
        updated_at: new Date(),
      },
    });
    return res.status(200).json({ status: true, supplier: updatedSupplier });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

// Delete supplier
exports.deleteSupplier = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const supplier = await prisma.t_supplier.findUnique({ where: { id } });
    if (!supplier) {
      return res
        .status(404)
        .json({ status: false, message: "Supplier tidak ditemukan" });
    }
    // Cek relasi di transaksi masuk
    const usedInTransMasuk = await prisma.t_transaksi_masuk.findFirst({
      where: { id_supplier: id },
    });
    if (usedInTransMasuk) {
      return res.status(400).json({
        status: false,
        message:
          "Supplier tidak bisa dihapus karena sudah digunakan di transaksi masuk",
      });
    }
    await prisma.t_supplier.delete({ where: { id } });
    return res
      .status(200)
      .json({ status: true, message: "Supplier berhasil dihapus" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};
