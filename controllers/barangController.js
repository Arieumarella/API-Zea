const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Helper untuk generate kode barang unik
async function generateUniqueKodeBarang() {
  let kode;
  let exists = true;
  while (exists) {
    // Format kode: KD + 6 digit random
    kode = "KD-" + Math.floor(100000 + Math.random() * 900000);
    exists = await prisma.t_barang.findFirst({ where: { kd_barang: kode } });
  }
  return kode;
}

// Get barang with pagination and search
exports.getBarang = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const take = 10;
    const skip = (page - 1) * take;
    const search = req.query.search || "";
    const where = search ? { nama_barang: { contains: search } } : {};
    const [barang, total] = await Promise.all([
      prisma.t_barang.findMany({
        skip,
        take,
        where,
        orderBy: { id: "desc" },
      }),
      prisma.t_barang.count({ where }),
    ]);
    return res.status(200).json({
      status: true,
      data: barang,
      page,
      total,
      totalPages: Math.ceil(total / take),
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

// Get barang by id
exports.getBarangById = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res
        .status(400)
        .json({ status: false, message: "Parameter id tidak valid" });
    }
    const barang = await prisma.t_barang.findUnique({ where: { id } });
    if (!barang) {
      return res
        .status(404)
        .json({ status: false, message: "Barang tidak ditemukan" });
    }
    return res.status(200).json({ status: true, barang });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

// Create barang
exports.createBarang = async (req, res) => {
  try {
    const { nama_barang, kd_barang } = req.body;
    if (!nama_barang || nama_barang.trim() === "") {
      return res
        .status(400)
        .json({ status: false, message: "Nama barang wajib diisi" });
    }

    // kd_barang must be provided by the client and must be unique
    if (!kd_barang || String(kd_barang).trim() === "") {
      return res
        .status(400)
        .json({ status: false, message: "kd_barang wajib diisi" });
    }

    const kdClean = String(kd_barang).trim();
    const exists = await prisma.t_barang.findFirst({
      where: { kd_barang: kdClean },
    });
    if (exists) {
      return res
        .status(400)
        .json({ status: false, message: "kd_barang sudah digunakan" });
    }

    const barang = await prisma.t_barang.create({
      data: {
        kd_barang: kdClean,
        nama_barang,
        jml_yard: 0,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
    return res.status(201).json({ status: true, barang });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

// Update barang
exports.updateBarang = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res
        .status(400)
        .json({ status: false, message: "Parameter id tidak valid" });
    }

    const { nama_barang, kd_barang } = req.body;
    const barang = await prisma.t_barang.findUnique({ where: { id } });
    if (!barang) {
      return res
        .status(404)
        .json({ status: false, message: "Barang tidak ditemukan" });
    }
    const dataToUpdate = { updated_at: new Date() };

    if (nama_barang && String(nama_barang).trim() !== "") {
      dataToUpdate.nama_barang = nama_barang;
    }

    if (kd_barang !== undefined) {
      const kdClean = String(kd_barang).trim();
      if (kdClean === "") {
        return res
          .status(400)
          .json({ status: false, message: "kd_barang tidak boleh kosong" });
      }
      if (kdClean !== barang.kd_barang) {
        const exists = await prisma.t_barang.findFirst({
          where: { kd_barang: kdClean },
        });
        if (exists) {
          return res
            .status(400)
            .json({ status: false, message: "kd_barang sudah digunakan" });
        }
      }
      dataToUpdate.kd_barang = kdClean;
    }

    const updatedBarang = await prisma.t_barang.update({
      where: { id },
      data: dataToUpdate,
    });
    return res.status(200).json({ status: true, barang: updatedBarang });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

// Delete barang
exports.deleteBarang = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const barang = await prisma.t_barang.findUnique({ where: { id } });
    if (!barang) {
      return res
        .status(404)
        .json({ status: false, message: "Barang tidak ditemukan" });
    }
    // Cek relasi di transaksi keluar detail
    const usedInKeluar = await prisma.t_transaksi_keluar_detail.findFirst({
      where: { id_barang: id },
    });
    if (usedInKeluar) {
      return res.status(400).json({
        status: false,
        message:
          "Barang tidak bisa dihapus karena sudah digunakan di transaksi keluar",
      });
    }
    // Cek relasi di transaksi masuk detail
    const usedInMasuk = await prisma.t_transaksi_masuk_detail.findFirst({
      where: { id_barang: id },
    });
    if (usedInMasuk) {
      return res.status(400).json({
        status: false,
        message:
          "Barang tidak bisa dihapus karena sudah digunakan di transaksi masuk",
      });
    }
    await prisma.t_barang.delete({ where: { id } });
    return res
      .status(200)
      .json({ status: true, message: "Barang berhasil dihapus" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

// Get all barang (no pagination)
exports.getAllBarang = async (req, res) => {
  try {
    const barang = await prisma.t_barang.findMany({
      orderBy: { id: "desc" },
      select: {
        id: true,
        kd_barang: true,
        nama_barang: true,
        jml_yard: true,
        created_at: true,
        updated_at: true,
      },
    });
    return res.status(200).json({ status: true, data: barang });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

exports.detilKeluar = async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const detailListBarang = await prisma.$queryRaw`
      SELECT 'Barang Keluar' AS sts_barang, tgl_transaksi, jml_yard, jml_rol, harga_satuan, jml_yard*harga_satuan AS total_harga FROM (
      SELECT * FROM t_transaksi_keluar_detail WHERE id_barang=${id}
      ) AS a
      LEFT JOIN t_transaksi_keluar AS b ON a.id_transaksi_keluar=b.id
      ORDER BY tgl_transaksi DESC  
      `;

    const datatransaksiKeluar = (detailListBarang || []).map((row) => ({
      sts_barang: row.sts_barang,
      tgl_transaksi: row.tgl_transaksi,
      jml_yard: Number(row.jml_yard),
      jml_rol: Number(row.jml_rol),
      harga_satuan: Number(row.harga_satuan),
      total_harga: Number(row.total_harga),
    }));

    return res.status(200).json({ status: true, data: datatransaksiKeluar });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

exports.detilMasuk = async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const detailListBarang = await prisma.$queryRaw`
      SELECT 'Barang Masuk' AS sts_barang, tgl_transaksi, jml_yard, jml_rol, harga_satuan, jml_yard*harga_satuan AS total_harga FROM (
      SELECT * FROM t_transaksi_masuk_detail WHERE id_barang=${id}
      ) AS a
      LEFT JOIN t_transaksi_masuk AS b ON a.id_transaksi_masuk=b.id
      ORDER BY tgl_transaksi DESC  
      `;

    const datatransaksiKeluar = (detailListBarang || []).map((row) => ({
      sts_barang: row.sts_barang,
      tgl_transaksi: row.tgl_transaksi,
      jml_yard: Number(row.jml_yard),
      jml_rol: Number(row.jml_rol),
      harga_satuan: Number(row.harga_satuan),
      total_harga: Number(row.total_harga),
    }));

    return res.status(200).json({ status: true, data: datatransaksiKeluar });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

exports.stockBarang = async (req, res) => {
  try {
    // Pagination and optional search (nama_barang)
    const page = parseInt(req.query.page) || 1;
    const take = 10;
    const skip = (page - 1) * take;
    const search = req.query.search || "";

    const where = search ? { nama_barang: { contains: search } } : {};

    // total count
    const total = await prisma.t_barang.count({ where });

    // get paginated barang
    const barang = await prisma.t_barang.findMany({
      where,
      skip,
      take,
      orderBy: { id: "desc" },
      select: {
        id: true,
        kd_barang: true,
        nama_barang: true,
        jml_yard: true,
        jml_rol: true,
        created_at: true,
        updated_at: true,
      },
    });

    const ids = barang.map((b) => b.id);

    // get totals sold per barang for the current page
    let soldAgg = [];
    if (ids.length > 0) {
      soldAgg = await prisma.t_transaksi_keluar_detail.groupBy({
        by: ["id_barang"],
        where: { id_barang: { in: ids } },
        _sum: {
          jml_yard: true,
          jml_rol: true,
        },
      });
    }

    const soldMap = new Map();
    soldAgg.forEach((s) => {
      soldMap.set(s.id_barang, {
        tot_yard_terjual: Number(s._sum.jml_yard || 0),
        tot_rol_terjual: Number(s._sum.jml_rol || 0),
      });
    });

    const stokBarang = barang.map((row) => {
      const sold = soldMap.get(row.id) || {
        tot_yard_terjual: 0,
        tot_rol_terjual: 0,
      };
      return {
        id: row.id,
        kd_barang: row.kd_barang,
        nama_barang: row.nama_barang,
        jml_yard: Number(row.jml_yard || 0),
        jml_rol: Number(row.jml_rol || 0),
        tot_yard_terjual: sold.tot_yard_terjual,
        tot_rol_terjual: sold.tot_rol_terjual,
        created_at: row.created_at,
        updated_at: row.updated_at,
      };
    });

    return res.status(200).json({
      status: true,
      data: stokBarang,
      page,
      total,
      totalPages: Math.ceil(total / take),
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};
