const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Get oprasional with pagination and search
exports.getOprasional = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const take = 10;
    const skip = (page - 1) * take;
    const search = req.query.search || "";
    const waktuAwal = req.query.waktuAwal
      ? new Date(req.query.waktuAwal)
      : null;
    const waktuAkhir = req.query.waktuAkhir
      ? new Date(req.query.waktuAkhir)
      : null;
    let where = {};
    if (search) {
      where.nama_baya = { contains: search };
    }
    if (waktuAwal && waktuAkhir) {
      where.created_at = { gte: waktuAwal, lte: waktuAkhir };
    } else if (waktuAwal) {
      where.created_at = { gte: waktuAwal };
    } else if (waktuAkhir) {
      where.created_at = { lte: waktuAkhir };
    }
    const [oprasional, total] = await Promise.all([
      prisma.t_oprasional.findMany({
        skip,
        take,
        where,
        orderBy: { id: "desc" },
      }),
      prisma.t_oprasional.count({ where }),
    ]);

    // Ambil data user secara terpisah
    const userIds = Array.from(
      new Set(oprasional.map((d) => d.id_user).filter(Boolean))
    );
    const users =
      userIds.length > 0
        ? await prisma.t_user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, nama: true, username: true },
          })
        : [];

    const userMap = Object.fromEntries(
      users.map((u) => [u.id, { id: u.id, nama: u.nama, username: u.username }])
    );

    // Map user ke hasil
    const data = oprasional.map((item) => ({
      id: item.id,
      nama_baya: item.nama_baya,
      jml_biaya: item.jml_biaya != null ? Number(item.jml_biaya) : 0,
      penginput: item.id_user ? userMap[item.id_user] || null : null,
      created_at: item.created_at,
      updated_at: item.updated_at,
    }));

    return res.status(200).json({
      status: true,
      data,
      page,
      total,
      totalPages: Math.ceil(total / take),
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

// Get oprasional by id
exports.getOprasionalById = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const oprasional = await prisma.t_oprasional.findUnique({ where: { id } });
    if (!oprasional) {
      return res
        .status(404)
        .json({ status: false, message: "Oprasional tidak ditemukan" });
    }
    return res.status(200).json({ status: true, oprasional });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

// Create oprasional
exports.createOprasional = async (req, res) => {
  try {
    const { nama_baya, jml_biaya } = req.body;
    const id_user = req.user.userId;
    // Ambil saldo terakhir
    const saldo = await prisma.t_saldo.findFirst({ orderBy: { id: "desc" } });
    if (!saldo || Number(saldo.jml_saldo) < Number(jml_biaya)) {
      return res
        .status(400)
        .json({ status: false, message: "Saldo tidak cukup" });
    }
    // Kurangi saldo
    const newSaldo = Number(saldo.jml_saldo) - Number(jml_biaya);
    await prisma.t_saldo.update({
      where: { id: saldo.id },
      data: {
        jml_saldo: newSaldo,
        updated_at: new Date(),
      },
    });
    // Simpan data oprasional
    const oprasional = await prisma.t_oprasional.create({
      data: {
        id_user,
        nama_baya,
        jml_biaya,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
    return res.status(201).json({ status: true, oprasional });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

// Update oprasional
exports.updateOprasional = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { nama_baya, jml_biaya } = req.body;
    const id_user = req.user.userId;
    const oprasional = await prisma.t_oprasional.findUnique({ where: { id } });
    if (!oprasional) {
      return res
        .status(404)
        .json({ status: false, message: "Oprasional tidak ditemukan" });
    }
    // Hitung selisih biaya
    const selisih = Number(jml_biaya) - Number(oprasional.jml_biaya);
    // Ambil saldo terakhir
    const saldo = await prisma.t_saldo.findFirst({ orderBy: { id: "desc" } });
    if (!saldo) {
      return res
        .status(400)
        .json({ status: false, message: "Saldo tidak ditemukan" });
    }
    let newSaldo = Number(saldo.jml_saldo);
    if (selisih > 0) {
      // Jika biaya bertambah, saldo harus cukup
      if (newSaldo < selisih) {
        return res.status(400).json({
          status: false,
          message: "Saldo tidak cukup untuk perubahan",
        });
      }
      newSaldo = newSaldo - selisih;
    } else if (selisih < 0) {
      // Jika biaya berkurang, saldo bertambah
      newSaldo = newSaldo + Math.abs(selisih);
    }
    await prisma.t_saldo.update({
      where: { id: saldo.id },
      data: {
        jml_saldo: newSaldo,
        updated_at: new Date(),
      },
    });
    // Update data oprasional
    const updatedOprasional = await prisma.t_oprasional.update({
      where: { id },
      data: {
        id_user,
        nama_baya,
        jml_biaya,
        updated_at: new Date(),
      },
    });
    return res
      .status(200)
      .json({ status: true, oprasional: updatedOprasional });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

// Delete oprasional
exports.deleteOprasional = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const oprasional = await prisma.t_oprasional.findUnique({ where: { id } });
    if (!oprasional) {
      return res
        .status(404)
        .json({ status: false, message: "Oprasional tidak ditemukan" });
    }
    // Kembalikan saldo
    const saldo = await prisma.t_saldo.findFirst({ orderBy: { id: "desc" } });
    const newSaldo = Number(saldo.jml_saldo) + Number(oprasional.jml_biaya);
    await prisma.t_saldo.update({
      where: { id: saldo.id },
      data: {
        jml_saldo: newSaldo,
        updated_at: new Date(),
      },
    });
    await prisma.t_oprasional.delete({ where: { id } });
    return res
      .status(200)
      .json({ status: true, message: "Oprasional berhasil dihapus" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};
