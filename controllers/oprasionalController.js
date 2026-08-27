const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { createLog } = require("../utils/logHelper");


// Get oprasional with pagination and search
exports.getOprasional = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const isAll = req.query.all === "true";
    const take = isAll ? undefined : 10;
    const skip = isAll ? undefined : (page - 1) * take;
    const search = req.query.search || "";
    const id_toko = req.id_toko || 1;

    const waktuAwal = req.query.waktuAwal
      ? new Date(req.query.waktuAwal)
      : null;
    let waktuAkhir = null;
    if (req.query.waktuAkhir) {
      waktuAkhir = new Date(req.query.waktuAkhir);
      waktuAkhir.setHours(23, 59, 59, 999);
    }
    let where = { id_toko };
    if (search) {
      where.nama_baya = { contains: search };
    }
    if (waktuAwal && waktuAkhir) {
      where.OR = [
        {
          tanggal: { gte: waktuAwal, lte: waktuAkhir }
        },
        {
          tanggal: null,
          created_at: { gte: waktuAwal, lte: waktuAkhir }
        }
      ];
    } else if (waktuAwal) {
      where.OR = [
        {
          tanggal: { gte: waktuAwal }
        },
        {
          tanggal: null,
          created_at: { gte: waktuAwal }
        }
      ];
    } else if (waktuAkhir) {
      where.OR = [
        {
          tanggal: { lte: waktuAkhir }
        },
        {
          tanggal: null,
          created_at: { lte: waktuAkhir }
        }
      ];
    }
    const [oprasional, total] = await Promise.all([
      prisma.t_oprasional.findMany({
        ...(isAll ? {} : { skip, take }),
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
      tanggal: item.tanggal,
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
    const id_toko = req.id_toko || 1;
    const oprasional = await prisma.t_oprasional.findFirst({ where: { id, id_toko } });
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
    const { nama_baya, jml_biaya, tanggal } = req.body;
    const id_user = req.user.userId;
    const id_toko = req.id_toko || 1;

    // Ambil saldo terakhir untuk toko ini
    let saldo = await prisma.t_saldo.findFirst({ where: { id_toko }, orderBy: { id: "asc" } });
    if (!saldo) {
      saldo = await prisma.t_saldo.create({
        data: { id_toko, jml_saldo: 0, created_at: new Date(), updated_at: new Date() }
      });
    }

    if (Number(saldo.jml_saldo) < Number(jml_biaya)) {
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
        id_toko,
        id_user,
        nama_baya,
        tanggal: tanggal ? new Date(tanggal) : null,
        jml_biaya,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
    createLog({
      id_toko,
      id_user,
      aksi: "TAMBAH_OPRASIONAL",
      keterangan: `Mencatat pengeluaran operasional '${nama_baya}' sebesar Rp ${Number(jml_biaya).toLocaleString('id-ID')}`,
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
    const { nama_baya, jml_biaya, tanggal } = req.body;
    const id_user = req.user.userId;
    const id_toko = req.id_toko || 1;

    const oprasional = await prisma.t_oprasional.findFirst({ where: { id, id_toko } });
    if (!oprasional) {
      return res
        .status(404)
        .json({ status: false, message: "Oprasional tidak ditemukan" });
    }
    // Hitung selisih biaya
    const selisih = Number(jml_biaya) - Number(oprasional.jml_biaya);
    // Ambil saldo terakhir
    const saldo = await prisma.t_saldo.findFirst({ where: { id_toko }, orderBy: { id: "asc" } });
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
        tanggal: tanggal ? new Date(tanggal) : null,
        jml_biaya,
        updated_at: new Date(),
      },
    });

    createLog({
      id_toko,
      id_user,
      aksi: "EDIT_OPRASIONAL",
      keterangan: `Memperbarui biaya operasional #${id} '${updatedOprasional.nama_baya}' sebesar Rp ${Number(jml_biaya).toLocaleString('id-ID')}`,
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
    const id_toko = req.id_toko || 1;
    const oprasional = await prisma.t_oprasional.findFirst({ where: { id, id_toko } });
    if (!oprasional) {
      return res
        .status(404)
        .json({ status: false, message: "Oprasional tidak ditemukan" });
    }
    // Kembalikan saldo
    const saldo = await prisma.t_saldo.findFirst({ where: { id_toko }, orderBy: { id: "asc" } });
    if (saldo) {
      const newSaldo = Number(saldo.jml_saldo) + Number(oprasional.jml_biaya);
      await prisma.t_saldo.update({
        where: { id: saldo.id },
        data: {
          jml_saldo: newSaldo,
          updated_at: new Date(),
        },
      });
    }
    await prisma.t_oprasional.delete({ where: { id } });

    createLog({
      id_toko,
      id_user: req.user?.userId,
      aksi: "HAPUS_OPRASIONAL",
      keterangan: `Menghapus biaya operasional #${id} '${oprasional.nama_baya}' sebesar Rp ${Number(oprasional.jml_biaya).toLocaleString('id-ID')}`,
    });

    return res
      .status(200)
      .json({ status: true, message: "Oprasional berhasil dihapus" });
  } catch (error) {

    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

