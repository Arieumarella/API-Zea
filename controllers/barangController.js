const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();


// Get barang with pagination and search
exports.getBarang = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const take = 10;
    const skip = (page - 1) * take;
    const search = req.query.search || "";
    const where = search
      ? {
        OR: [
          { nama_barang: { contains: search } },
          { kd_barang: { contains: search } },
        ],
      }
      : {};
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
      return res.status(400)
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
    const isAll = req.query.all === "true";
    const take = isAll ? undefined : 10;
    const skip = isAll ? undefined : (page - 1) * take;
    const search = req.query.search || "";

    const where = search
      ? {
        OR: [
          { nama_barang: { contains: search } },
          { kd_barang: { contains: search } },
        ],
      }
      : {};

    // total count
    const total = await prisma.t_barang.count({ where });

    // get paginated barang
    const barang = await prisma.t_barang.findMany({
      where,
      ...(isAll ? {} : { skip, take }),
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

    // get totals sold per barang for the current page (net of retur)
    let soldAgg = [];
    if (ids.length > 0) {
      soldAgg = await prisma.$queryRaw`
        SELECT 
          id_barang,
          SUM(COALESCE(jml_yard, 0) - COALESCE(jml_yard_retur, 0)) AS tot_yard,
          SUM(COALESCE(jml_rol, 0) - COALESCE(jml_rol_retur, 0)) AS tot_rol
        FROM t_transaksi_keluar_detail
        WHERE id_barang IN (${ids.join(",")})
        GROUP BY id_barang
      `;
    }

    const soldMap = new Map();
    soldAgg.forEach((s) => {
      soldMap.set(s.id_barang, {
        tot_yard_terjual: Number(s.tot_yard || 0),
        tot_rol_terjual: Number(s.tot_rol || 0),
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

exports.detilSisaStok = async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const incoming = await prisma.$queryRaw`
      SELECT 
        a.id AS detail_id,
        a.id_transaksi_masuk,
        b.tgl_transaksi,
        s.nama AS nama_supplier,
        a.jml_yard,
        a.jml_rol,
        COALESCE(a.jml_yard_retur, 0) AS jml_yard_retur,
        COALESCE(a.jml_rol_retur, 0) AS jml_rol_retur,
        a.harga_satuan
      FROM t_transaksi_masuk_detail AS a
      LEFT JOIN t_transaksi_masuk AS b ON a.id_transaksi_masuk = b.id
      LEFT JOIN t_supplier AS s ON b.id_supplier = s.id
      WHERE a.id_barang = ${id}
      ORDER BY b.tgl_transaksi ASC, a.id ASC
    `;

    const outgoing = await prisma.$queryRaw`
      SELECT 
        a.id AS detail_id,
        a.id_transaksi_keluar,
        b.tgl_transaksi,
        a.jml_yard,
        a.jml_rol,
        COALESCE(a.jml_yard_retur, 0) AS jml_yard_retur,
        COALESCE(a.jml_rol_retur, 0) AS jml_rol_retur
      FROM t_transaksi_keluar_detail AS a
      LEFT JOIN t_transaksi_keluar AS b ON a.id_transaksi_keluar = b.id
      WHERE a.id_barang = ${id}
      ORDER BY b.tgl_transaksi ASC, a.id ASC
    `;

    const batches = incoming.map((item) => ({
      detail_id: item.detail_id,
      id_transaksi_masuk: item.id_transaksi_masuk,
      tgl_transaksi: item.tgl_transaksi,
      nama_supplier: item.nama_supplier || "Umum/Unknown",
      harga_satuan: Number(item.harga_satuan || 0),
      orig_yard: Number(item.jml_yard || 0),
      orig_rol: Number(item.jml_rol || 0),
      jml_yard_retur: Number(item.jml_yard_retur || 0),
      jml_rol_retur: Number(item.jml_rol_retur || 0),
      sisa_yard: Number(item.jml_yard || 0) - Number(item.jml_yard_retur || 0),
      sisa_rol: Number(item.jml_rol || 0) - Number(item.jml_rol_retur || 0),
    }));

    let totalSoldYard = 0;
    let totalSoldRol = 0;
    outgoing.forEach((item) => {
      totalSoldYard += Number(item.jml_yard || 0) - Number(item.jml_yard_retur || 0);
      totalSoldRol += Number(item.jml_rol || 0) - Number(item.jml_rol_retur || 0);
    });

    let remainingSoldYard = totalSoldYard;
    for (let i = 0; i < batches.length; i++) {
      if (remainingSoldYard <= 0) break;
      const batch = batches[i];
      if (batch.sisa_yard > 0) {
        if (remainingSoldYard >= batch.sisa_yard) {
          remainingSoldYard -= batch.sisa_yard;
          batch.sisa_yard = 0;
        } else {
          batch.sisa_yard -= remainingSoldYard;
          remainingSoldYard = 0;
        }
      }
    }

    let remainingSoldRol = totalSoldRol;
    for (let i = 0; i < batches.length; i++) {
      if (remainingSoldRol <= 0) break;
      const batch = batches[i];
      if (batch.sisa_rol > 0) {
        if (remainingSoldRol >= batch.sisa_rol) {
          remainingSoldRol -= batch.sisa_rol;
          batch.sisa_rol = 0;
        } else {
          batch.sisa_rol -= remainingSoldRol;
          remainingSoldRol = 0;
        }
      }
    }

    const activeStockDetails = batches
      .filter((b) => b.sisa_yard > 0 || b.sisa_rol > 0)
      .map((b) => ({
        id_transaksi_masuk: b.id_transaksi_masuk,
        tgl_transaksi: b.tgl_transaksi,
        nama_supplier: b.nama_supplier,
        harga_satuan: b.harga_satuan,
        orig_yard: b.orig_yard,
        orig_rol: b.orig_rol,
        sisa_yard: b.sisa_yard,
        sisa_rol: b.sisa_rol,
        total_nilai_sisa: b.sisa_yard * b.harga_satuan,
      }));

    return res.status(200).json({ status: true, data: activeStockDetails });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};
