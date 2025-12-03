const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Create transaksi masuk with details
exports.createTransaksiMasuk = async (req, res) => {
  try {
    const {
      id_supplier,
      tgl_transaksi,
      tipe_discount,
      jml_discount,
      tipe_ppn,
      jml_ppn,
      catatan,
      details,
      status_pembayaran,
      tenor,
      tanggal_tenor,
    } = req.body;

    console.log(req.body);

    const id_user = req.user && req.user.userId ? req.user.userId : null;

    if (!Array.isArray(details) || details.length === 0) {
      return res
        .status(400)
        .json({ status: false, message: "Details transaksi kosong" });
    }

    // validate required fields minimally
    if (!tgl_transaksi) {
      return res
        .status(400)
        .json({ status: false, message: "tgl_transaksi wajib diisi" });
    }

    // Hitung subtotal dari details
    let subtotal = 0;
    for (const d of details) {
      const qty = Number(d.jml_yard || 0);
      const price = Number(d.harga_satuan || 0);
      if (isNaN(qty) || isNaN(price)) {
        return res.status(400).json({
          status: false,
          message: "Detail transaksi mengandung nilai yang tidak valid",
        });
      }

      subtotal += qty * price;
    }

    // Hitung discount
    const discType = tipe_discount || "";
    const discVal = Number(jml_discount || 0);
    let discountAmount = 0;
    if (discVal && discVal > 0) {
      if (discType === "persen") {
        discountAmount = (subtotal * discVal) / 100;
      } else {
        discountAmount = discVal;
      }
    }

    // Hitung ppn (berdasarkan subtotal setelah discount)
    const ppnType = tipe_ppn || "";
    const ppnVal = Number(jml_ppn || 0);
    const taxable = subtotal - discountAmount;
    let ppnAmount = 0;
    if (ppnVal && ppnVal > 0) {
      if (ppnType === "persen") {
        ppnAmount = (taxable * ppnVal) / 100;
      } else {
        ppnAmount = ppnVal;
      }
    }

    const computedTotal = taxable + ppnAmount;
    console.log(computedTotal);

    // Use transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx) => {
      // create parent transaksi
      const trx = await tx.t_transaksi_masuk.create({
        data: {
          id_supplier: id_supplier || null,
          id_user: id_user || null,
          tgl_transaksi: new Date(tgl_transaksi),
          total_transaksi: computedTotal,
          status_pembayaran: status_pembayaran || "",
          tenor: Number(tenor) || null,
          tipe_discount: tipe_discount || null,
          jml_discount: discVal || null,
          tipe_ppn: tipe_ppn || null,
          jml_ppn: ppnVal || null,
          catatan: catatan || null,
          created_at: new Date(),
          updated_at: new Date(),
        },
      });

      // create details and update barang stock (jml_yard += detail.jml_yard)
      for (const d of details) {
        const id_barang = d.id_barang || null;
        const jml_yard = Number(d.jml_yard || 0);
        const jml_rol = Number(d.jml_rol || 0);
        const harga_satuan =
          d.harga_satuan != null ? Number(d.harga_satuan) : null;

        await tx.t_transaksi_masuk_detail.create({
          data: {
            id_transaksi_masuk: trx.id,
            id_barang: id_barang,
            jml_yard: jml_yard,
            jml_rol: jml_rol,
            harga_satuan: harga_satuan,
            created_at: new Date(),
            updated_at: new Date(),
          },
        });

        if (id_barang) {
          // increment jml_yard on barang; if null, set to jml_yard
          const existing = await tx.t_barang.findUnique({
            where: { id: id_barang },
          });
          if (existing) {
            const current =
              existing.jml_yard != null ? Number(existing.jml_yard) : 0;
            const newJml = current + jml_yard;

            const currentRol =
              existing.jml_rol != null ? Number(existing.jml_rol) : 0;
            const newJmlRol = currentRol + jml_rol;

            await tx.t_barang.update({
              where: { id: id_barang },
              data: {
                jml_yard: newJml,
                jml_rol: newJmlRol,
                updated_at: new Date(),
              },
            });
          }
        }
      }

      // Kurangi t_saldo.id = 1 sebesar total transaksi (mewakili pembayaran pembelian)
      if (status_pembayaran != "1") {
        try {
          const saldoRec = await tx.t_saldo.findUnique({ where: { id: 1 } });
          if (saldoRec) {
            const currentSaldo =
              saldoRec.jml_saldo != null ? Number(saldoRec.jml_saldo) : 0;
            const newSaldo = currentSaldo - computedTotal;
            await tx.t_saldo.update({
              where: { id: 1 },
              data: { jml_saldo: newSaldo, updated_at: new Date() },
            });
          } else {
            // jika belum ada record saldo, buat baru dengan nilai negatif atau sesuai total
            await tx.t_saldo.create({
              data: {
                jml_saldo: -computedTotal,
                created_at: new Date(),
                updated_at: new Date(),
              },
            });
          }
        } catch (e) {
          // jika update/create saldo gagal, batalkan transaksi dengan lempar error
          throw new Error("Gagal memperbarui saldo: " + e.message);
        }
      }

      // Pembayaran Bertempo
      if (status_pembayaran === "1") {
        // Validasi: jika tenor dikirim, tanggal_tenor harus sesuai jumlahnya
        const newTenor = Number(tenor) || 0;

        if (newTenor > 0) {
          if (Array.isArray(tanggal_tenor)) {
            // Gunakan tanggal_tenor jika ada
            if (tanggal_tenor.length !== newTenor) {
              throw new Error(
                `Jumlah tanggal_tenor (${tanggal_tenor.length}) harus sesuai dengan tenor (${newTenor})`
              );
            }

            for (const tanggal of tanggal_tenor) {
              const tgl_jatuh_tempo = new Date(tanggal);

              await tx.t_berjangka_masuk.create({
                data: {
                  id_transaksi: trx.id,
                  tgl_jatuh_tempo: tgl_jatuh_tempo,
                  jml_bayar: 0,
                  created_at: new Date(),
                  updated_at: new Date(),
                },
              });
            }
          } else {
            // Jika tenor ada tapi tanggal_tenor tidak, buat tenor sesuai jumlah tenor
            for (let i = 0; i < newTenor; i++) {
              await tx.t_berjangka_masuk.create({
                data: {
                  id_transaksi: trx.id,
                  tgl_jatuh_tempo: new Date(),
                  jml_bayar: 0,
                  created_at: new Date(),
                  updated_at: new Date(),
                },
              });
            }
          }
        }
      }

      return trx;
    });

    return res.status(201).json({
      status: true,
      message: "Transaksi masuk dibuat",
      data: {
        id: result.id,
        subtotal,
        discountAmount,
        ppnAmount,
        total_transaksi: computedTotal,
      },
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

// List transaksi masuk (pagination, optional search by supplier or date range)
exports.getTransaksiMasuk = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const take = 10;
    const skip = (page - 1) * take;
    const search = req.query.search || ""; // search by supplier name not available here, so use supplier id
    const supplierId = req.query.supplierId
      ? parseInt(req.query.supplierId)
      : null;
    const waktuAwal = req.query.waktuAwal
      ? new Date(req.query.waktuAwal)
      : null;
    const waktuAkhir = req.query.waktuAkhir
      ? new Date(req.query.waktuAkhir)
      : null;

    let where = {};
    if (supplierId) where.id_supplier = supplierId;
    if (waktuAwal && waktuAkhir)
      where.tgl_transaksi = { gte: waktuAwal, lte: waktuAkhir };
    else if (waktuAwal) where.tgl_transaksi = { gte: waktuAwal };
    else if (waktuAkhir) where.tgl_transaksi = { lte: waktuAkhir };

    const [data, total] = await Promise.all([
      prisma.t_transaksi_masuk.findMany({
        skip,
        take,
        where,
        orderBy: { id: "desc" },
      }),
      prisma.t_transaksi_masuk.count({ where }),
    ]);

    // Ambil data supplier dan user secara terpisah (schema belum punya relation field)
    const supplierIds = Array.from(
      new Set(data.map((d) => d.id_supplier).filter(Boolean))
    );
    const userIds = Array.from(
      new Set(data.map((d) => d.id_user).filter(Boolean))
    );

    const [suppliers, users] = await Promise.all([
      supplierIds.length
        ? prisma.t_supplier.findMany({
            where: { id: { in: supplierIds } },
            select: { id: true, nama: true },
          })
        : [],
      userIds.length
        ? prisma.t_user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, nama: true, username: true },
          })
        : [],
    ]);

    const supplierMap = Object.fromEntries(
      suppliers.map((s) => [s.id, s.nama])
    );
    const userMap = Object.fromEntries(
      users.map((u) => [u.id, { id: u.id, nama: u.nama, username: u.username }])
    );

    // Ambil data berjangka masuk untuk semua transaksi
    const transaksiIds = data.map((d) => d.id);
    const berjangkaList =
      transaksiIds.length > 0
        ? await prisma.t_berjangka_masuk.findMany({
            where: { id_transaksi: { in: transaksiIds } },
          })
        : [];

    // Ambil semua detail untuk transaksi-transaksi ini (supaya kita bisa sertakan retur di list)
    const detailsList =
      transaksiIds.length > 0
        ? await prisma.t_transaksi_masuk_detail.findMany({
            where: { id_transaksi_masuk: { in: transaksiIds } },
          })
        : [];

    // Ambil data barang untuk semua details
    const detailBarangIds = Array.from(
      new Set(detailsList.map((d) => d.id_barang).filter(Boolean))
    );
    const detailBarangList =
      detailBarangIds.length > 0
        ? await prisma.t_barang.findMany({
            where: { id: { in: detailBarangIds } },
            select: {
              id: true,
              kd_barang: true,
              nama_barang: true,
              jml_yard: true,
              jml_rol: true,
            },
          })
        : [];

    const barangMapForDetails = Object.fromEntries(
      detailBarangList.map((b) => [
        b.id,
        {
          id: b.id,
          kd_barang: b.kd_barang,
          nama_barang: b.nama_barang,
          jml_yard: b.jml_yard != null ? Number(b.jml_yard) : 0,
          jml_rol: b.jml_rol != null ? Number(b.jml_rol) : 0,
        },
      ])
    );

    // Buat map details berdasarkan id_transaksi
    const detailsMap = {};
    for (const d of detailsList) {
      if (!detailsMap[d.id_transaksi_masuk])
        detailsMap[d.id_transaksi_masuk] = [];
      detailsMap[d.id_transaksi_masuk].push({
        id: d.id,
        id_barang: d.id_barang,
        barang: d.id_barang ? barangMapForDetails[d.id_barang] || null : null,
        jml_yard: d.jml_yard != null ? Number(d.jml_yard) : 0,
        jml_rol: d.jml_rol != null ? Number(d.jml_rol) : 0,
        jml_yard_retur: d.jml_yard_retur != null ? Number(d.jml_yard_retur) : 0,
        jml_rol_retur: d.jml_rol_retur != null ? Number(d.jml_rol_retur) : 0,
        harga_satuan: d.harga_satuan != null ? Number(d.harga_satuan) : 0,
        created_at: d.created_at,
        updated_at: d.updated_at,
      });
    }

    // Buat map berjangka berdasarkan id_transaksi
    const berjangkaMap = {};
    for (const item of berjangkaList) {
      if (!berjangkaMap[item.id_transaksi]) {
        berjangkaMap[item.id_transaksi] = [];
      }
      berjangkaMap[item.id_transaksi].push({
        id: item.id,
        tgl_jatuh_tempo: item.tgl_jatuh_tempo,
        jml_bayar: item.jml_bayar != null ? Number(item.jml_bayar) : 0,
        created_at: item.created_at,
        updated_at: item.updated_at,
      });
    }

    const transformed = data.map((item) => ({
      id: item.id,
      tgl_transaksi: item.tgl_transaksi,
      status_pembayaran: item.status_pembayaran,
      tenor: item.tenor,
      supplier: item.id_supplier
        ? { id: item.id_supplier, nama: supplierMap[item.id_supplier] || null }
        : null,
      total_transaksi:
        item.total_transaksi != null ? Number(item.total_transaksi) : 0,
      penginput: item.id_user ? userMap[item.id_user] || null : null,
      details: detailsMap[item.id] || [],
      berjangka: berjangkaMap[item.id] || [],
      created_at: item.created_at,
      updated_at: item.updated_at,
    }));

    return res.status(200).json({
      status: true,
      data: transformed,
      page,
      total,
      totalPages: Math.ceil(total / take),
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

// Update transaksi masuk
exports.updateTransaksiMasuk = async (req, res) => {
  try {
    console.log(req.body);

    const id = parseInt(req.params.id);
    const {
      id_supplier,
      tgl_transaksi,
      tipe_discount,
      jml_discount,
      tipe_ppn,
      jml_ppn,
      catatan,
      details,
      status_pembayaran,
      tenor,
      tanggal_tenor,
    } = req.body;

    // Validasi
    if (!Array.isArray(details) || details.length === 0) {
      return res
        .status(400)
        .json({ status: false, message: "Details transaksi kosong" });
    }

    if (!tgl_transaksi) {
      return res
        .status(400)
        .json({ status: false, message: "tgl_transaksi wajib diisi" });
    }

    // Cek transaksi lama
    const oldTrx = await prisma.t_transaksi_masuk.findUnique({
      where: { id },
    });
    if (!oldTrx) {
      return res
        .status(404)
        .json({ status: false, message: "Transaksi tidak ditemukan" });
    }

    // Hitung subtotal dari details baru
    let subtotal = 0;
    for (const d of details) {
      const qty = Number(d.jml_yard || 0);
      const price = Number(d.harga_satuan || 0);
      if (isNaN(qty) || isNaN(price)) {
        return res.status(400).json({
          status: false,
          message: "Detail transaksi mengandung nilai yang tidak valid",
        });
      }
      subtotal += qty * price;
    }

    // Hitung discount
    const discType = tipe_discount || "";
    const discVal = Number(jml_discount || 0);
    let discountAmount = 0;
    if (discVal && discVal > 0) {
      if (discType === "persen") {
        discountAmount = (subtotal * discVal) / 100;
      } else {
        discountAmount = discVal;
      }
    }

    // Hitung ppn
    const ppnType = tipe_ppn || "";
    const ppnVal = Number(jml_ppn || 0);
    const taxable = subtotal - discountAmount;
    let ppnAmount = 0;
    if (ppnVal && ppnVal > 0) {
      if (ppnType === "persen") {
        ppnAmount = (taxable * ppnVal) / 100;
      } else {
        ppnAmount = ppnVal;
      }
    }

    const computedTotal = taxable + ppnAmount;
    const oldTotal = oldTrx.total_transaksi
      ? Number(oldTrx.total_transaksi)
      : 0;

    // Gunakan transaction untuk update atomik
    const result = await prisma.$transaction(async (tx) => {
      // Tenor dan pembayaran bertempo
      if (status_pembayaran === "1") {
        // Ambil semua berjangka (baik yang sudah dibayar maupun belum)
        const allBerjangka = await tx.t_berjangka_masuk.findMany({
          where: { id_transaksi: id },
          orderBy: { tgl_jatuh_tempo: "asc" },
        });

        // Pisahkan yang sudah dibayar (jml_bayar > 0) dan belum dibayar
        const paidBerjangka = allBerjangka.filter(
          (b) => b.jml_bayar != null && Number(b.jml_bayar) > 0
        );
        const unpaidBerjangka = allBerjangka.filter(
          (b) => !b.jml_bayar || Number(b.jml_bayar) === 0
        );

        const jmlDataYgAda = allBerjangka.length;
        const newTenor = Number(tenor) || 0;

        // Validasi: tenor baru tidak boleh kurang dari jumlah pembayaran yang sudah dilakukan
        if (newTenor < paidBerjangka.length) {
          throw new Error(
            `Tenor baru (${newTenor}) tidak boleh kurang dari jumlah pembayaran yang sudah dilakukan (${paidBerjangka.length})`
          );
        }

        // Update tanggal jatuh tempo untuk tenor yang ada (baik paid maupun unpaid)
        if (Array.isArray(tanggal_tenor) && tanggal_tenor.length === newTenor) {
          for (
            let i = 0;
            i < allBerjangka.length && i < tanggal_tenor.length;
            i++
          ) {
            const tgl_baru = new Date(tanggal_tenor[i]);
            await tx.t_berjangka_masuk.update({
              where: { id: allBerjangka[i].id },
              data: {
                tgl_jatuh_tempo: tgl_baru,
                updated_at: new Date(),
              },
            });
          }
        }

        // Hitung selisih tenor
        const selisihTenor = newTenor - jmlDataYgAda;

        if (selisihTenor > 0) {
          // Tambah tenor baru (yang belum dibayar)
          for (let i = 0; i < selisihTenor; i++) {
            const indexTanggal = jmlDataYgAda + i;
            const tgl_jatuh_tempo =
              Array.isArray(tanggal_tenor) && tanggal_tenor[indexTanggal]
                ? new Date(tanggal_tenor[indexTanggal])
                : new Date();

            await tx.t_berjangka_masuk.create({
              data: {
                id_transaksi: id,
                tgl_jatuh_tempo: tgl_jatuh_tempo,
                jml_bayar: 0,
                created_at: new Date(),
                updated_at: new Date(),
              },
            });
          }
        } else if (selisihTenor < 0) {
          // Kurangi tenor (hapus yang belum dibayar dulu, jika kurang hapus yang sudah dibayar)
          const jumlahYangHapus = Math.abs(selisihTenor);

          // Hapus dari unpaid dulu
          const unpaidYangHapus = unpaidBerjangka.slice(0, jumlahYangHapus);
          const unpaidIdYangHapus = unpaidYangHapus.map((b) => b.id);

          if (unpaidIdYangHapus.length > 0) {
            await tx.t_berjangka_masuk.deleteMany({
              where: { id: { in: unpaidIdYangHapus } },
            });
          }

          // Jika masih ada yang harus dihapus, hapus dari paid
          const sisaYangHapus = jumlahYangHapus - unpaidBerjangka.length;
          if (sisaYangHapus > 0) {
            const paidYangHapus = paidBerjangka.slice(0, sisaYangHapus);
            const paidIdYangHapus = paidYangHapus.map((b) => b.id);
            if (paidIdYangHapus.length > 0) {
              await tx.t_berjangka_masuk.deleteMany({
                where: { id: { in: paidIdYangHapus } },
              });
            }
          }
        }
      } else {
        // Jika status pembayaran bukan "1" (bukan berjangka), hapus semua berjangka
        const existingBerjangka = await tx.t_berjangka_masuk.findMany({
          where: { id_transaksi: id },
        });
        if (existingBerjangka.length > 0) {
          const allIds = existingBerjangka.map((b) => b.id);
          await tx.t_berjangka_masuk.deleteMany({
            where: { id: { in: allIds } },
          });
        }
      }

      // Ambil detail lama untuk rollback stok (dan untuk fallback nilai retur jika tidak dikirim kembali)
      const oldDetails = await tx.t_transaksi_masuk_detail.findMany({
        where: { id_transaksi_masuk: id },
      });

      // Build map of old details by id and map jumlah retur lama per barang
      const oldDetailById = {};
      const oldReturnedByBarang = {};
      for (const od of oldDetails) {
        oldDetailById[od.id] = od;
        if (od.id_barang) {
          const retYard =
            od.jml_yard_retur != null ? Number(od.jml_yard_retur) : 0;
          oldReturnedByBarang[od.id_barang] =
            (oldReturnedByBarang[od.id_barang] || 0) + retYard;
        }
      }

      // Also create a per-barang queue of old details to match incoming details that lack `id`
      const oldDetailsByBarang = {};
      for (const od of oldDetails) {
        if (od.id_barang) {
          if (!oldDetailsByBarang[od.id_barang])
            oldDetailsByBarang[od.id_barang] = [];
          oldDetailsByBarang[od.id_barang].push(od);
        }
      }

      // Will record which old detail id (if any) was chosen as fallback for each incoming detail index
      const chosenOldDetailByIndex = [];

      // Precompute total return amount from incoming details (use old detail retur when incoming omits it)
      let totalNewReturnAmount = 0;
      for (let idx = 0; idx < details.length; idx++) {
        const d = details[idx];
        const harga_satuan =
          d.harga_satuan != null ? Number(d.harga_satuan) : 0;
        const detailId = d.id ? parseInt(d.id, 10) : null;
        const incomingYardRetur =
          d.jml_yard_retur !== undefined && d.jml_yard_retur !== null
            ? Number(d.jml_yard_retur)
            : null;

        let jml_yard_retur = 0;
        // Prefer incoming explicit value
        if (incomingYardRetur !== null) {
          jml_yard_retur = incomingYardRetur;
          chosenOldDetailByIndex[idx] = detailId || null;
        } else if (detailId && oldDetailById[detailId]) {
          // If incoming didn't specify, but client referenced existing detail by id, use its old retur
          jml_yard_retur = Number(oldDetailById[detailId].jml_yard_retur || 0);
          chosenOldDetailByIndex[idx] = detailId;
        } else if (
          d.id_barang &&
          oldDetailsByBarang[d.id_barang] &&
          oldDetailsByBarang[d.id_barang].length > 0
        ) {
          // No id provided: try to match by id_barang (consume one old detail for that barang)
          const match = oldDetailsByBarang[d.id_barang].shift();
          jml_yard_retur = Number(match.jml_yard_retur || 0);
          chosenOldDetailByIndex[idx] = match.id;
        } else {
          jml_yard_retur = 0;
          chosenOldDetailByIndex[idx] = null;
        }

        totalNewReturnAmount += harga_satuan * (jml_yard_retur || 0);
      }
      const adjustedComputedTotal = computedTotal - totalNewReturnAmount;

      // Update parent transaksi
      const updatedTrx = await tx.t_transaksi_masuk.update({
        where: { id },
        data: {
          id_supplier: id_supplier || null,
          tgl_transaksi: new Date(tgl_transaksi),
          total_transaksi: adjustedComputedTotal,
          status_pembayaran: status_pembayaran || "",
          tenor: Number(tenor) || null,
          tipe_discount: tipe_discount || null,
          jml_discount: discVal || null,
          tipe_ppn: tipe_ppn || null,
          jml_ppn: ppnVal || null,
          catatan: catatan || null,
          updated_at: new Date(),
        },
      });

      // oldDetails, oldDetailById and oldReturnedByBarang already prepared above

      // Rollback stok dan rol dari detail lama
      for (const oldD of oldDetails) {
        if (oldD.id_barang) {
          const existing = await tx.t_barang.findUnique({
            where: { id: oldD.id_barang },
          });
          if (existing) {
            const currentYard =
              existing.jml_yard != null ? Number(existing.jml_yard) : 0;
            const currentRol =
              existing.jml_rol != null ? Number(existing.jml_rol) : 0;
            const oldYard = oldD.jml_yard != null ? Number(oldD.jml_yard) : 0;
            const oldRol = oldD.jml_rol != null ? Number(oldD.jml_rol) : 0;
            const oldYardRetur =
              oldD.jml_yard_retur != null ? Number(oldD.jml_yard_retur) : 0;
            const oldRolRetur =
              oldD.jml_rol_retur != null ? Number(oldD.jml_rol_retur) : 0;

            // Hitung net yang sebelumnya ditambahkan ke stock = pembelian - retur sebelumnya
            const netOldYard = oldYard - oldYardRetur;
            const netOldRol = oldRol - oldRolRetur;

            await tx.t_barang.update({
              where: { id: oldD.id_barang },
              data: {
                jml_yard: currentYard - netOldYard,
                jml_rol: currentRol - netOldRol,
                updated_at: new Date(),
              },
            });
          }
        }
      }

      // Hapus detail lama
      await tx.t_transaksi_masuk_detail.deleteMany({
        where: { id_transaksi_masuk: id },
      });

      // Buat detail baru dan update stok
      // Jika detail baru menyertakan jml_yard_retur/jml_rol_retur, simpan dan gunakan net untuk update stok
      for (let idx = 0; idx < details.length; idx++) {
        const d = details[idx];
        const id_barang = d.id_barang || null;
        const jml_yard = Number(d.jml_yard || 0);
        const jml_rol = Number(d.jml_rol || 0);
        const detailId = d.id ? parseInt(d.id, 10) : null;
        const chosenOldId = chosenOldDetailByIndex[idx] || null;
        const incomingYardRetur =
          d.jml_yard_retur !== undefined && d.jml_yard_retur !== null
            ? Number(d.jml_yard_retur)
            : null;
        const incomingRolRetur =
          d.jml_rol_retur !== undefined && d.jml_rol_retur !== null
            ? Number(d.jml_rol_retur)
            : null;

        const jml_yard_retur =
          incomingYardRetur !== null
            ? incomingYardRetur
            : chosenOldId && oldDetailById[chosenOldId]
            ? Number(oldDetailById[chosenOldId].jml_yard_retur || 0)
            : 0;
        const jml_rol_retur =
          incomingRolRetur !== null
            ? incomingRolRetur
            : chosenOldId && oldDetailById[chosenOldId]
            ? Number(oldDetailById[chosenOldId].jml_rol_retur || 0)
            : 0;
        const harga_satuan =
          d.harga_satuan != null ? Number(d.harga_satuan) : null;

        // Validasi: tidak boleh mengurangi jumlah pembelian di bawah jumlah retur lama untuk barang yang sama
        if (id_barang) {
          const prevReturned = oldReturnedByBarang[id_barang] || 0;
          if (jml_yard < prevReturned) {
            throw new Error(
              `Tidak dapat mengubah jumlah pembelian untuk barang ${id_barang} menjadi ${jml_yard} karena sudah ada retur sebelumnya sebesar ${prevReturned}`
            );
          }
        }

        // Validasi per-detail: retur tidak boleh lebih besar dari pembelian baru
        if (jml_yard_retur > jml_yard) {
          throw new Error(
            `jml_yard_retur (${jml_yard_retur}) tidak boleh lebih besar dari jml_yard (${jml_yard})`
          );
        }
        if (jml_rol_retur > jml_rol) {
          throw new Error(
            `jml_rol_retur (${jml_rol_retur}) tidak boleh lebih besar dari jml_rol (${jml_rol})`
          );
        }

        await tx.t_transaksi_masuk_detail.create({
          data: {
            id_transaksi_masuk: id,
            id_barang: id_barang,
            jml_yard: jml_yard,
            jml_rol: jml_rol,
            jml_yard_retur: jml_yard_retur,
            jml_rol_retur: jml_rol_retur,
            harga_satuan: harga_satuan,
            created_at: new Date(),
            updated_at: new Date(),
          },
        });

        // Update stock berdasarkan net = pembelian - retur (jika retur disertakan)
        if (id_barang) {
          const existing = await tx.t_barang.findUnique({
            where: { id: id_barang },
          });
          if (existing) {
            const currentYard =
              existing.jml_yard != null ? Number(existing.jml_yard) : 0;
            const currentRol =
              existing.jml_rol != null ? Number(existing.jml_rol) : 0;

            const netAddYard = jml_yard - jml_yard_retur;
            const netAddRol = jml_rol - jml_rol_retur;

            const newYard = currentYard + netAddYard;
            const newRol = currentRol + netAddRol;

            await tx.t_barang.update({
              where: { id: id_barang },
              data: {
                jml_yard: newYard,
                jml_rol: newRol,
                updated_at: new Date(),
              },
            });
          }
        }

        // totalNewReturnAmount dihitung sebelumnya, tidak perlu ditambahkan lagi di sini
      }

      // adjustedComputedTotal sudah dihitung sebelumnya sebelum update parent transaksi

      // Update saldo jika status pembayaran bukan "1" (bukan berjangka)
      if (status_pembayaran != "1") {
        const saldoRec = await tx.t_saldo.findUnique({ where: { id: 1 } });
        if (saldoRec) {
          const currentSaldo =
            saldoRec.jml_saldo != null ? Number(saldoRec.jml_saldo) : 0;
          // Tambahkan total lama, kurangi total baru
          const newSaldo = currentSaldo + oldTotal - adjustedComputedTotal;
          await tx.t_saldo.update({
            where: { id: 1 },
            data: { jml_saldo: newSaldo, updated_at: new Date() },
          });
        }
      }

      return updatedTrx;
    });

    return res.status(200).json({
      status: true,
      message: "Transaksi masuk diperbarui",
      data: {
        id: result.id,
        subtotal,
        discountAmount,
        ppnAmount,
        total_transaksi:
          result.total_transaksi != null
            ? Number(result.total_transaksi)
            : computedTotal,
      },
    });
  } catch (error) {
    console.log(error);

    // Jika error adalah validasi business logic
    if (error.message.includes("Tidak dapat mengubah status_pembayaran")) {
      return res.status(400).json({ status: false, message: error.message });
    }

    return res.status(500).json({ status: false, message: error.message });
  }
};

// Get transaksi masuk by id (including details)
exports.getTransaksiMasukById = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const trx = await prisma.t_transaksi_masuk.findUnique({ where: { id } });
    if (!trx)
      return res
        .status(404)
        .json({ status: false, message: "Transaksi tidak ditemukan" });

    // ambil details secara terpisah karena schema tidak punya relasi
    const details = await prisma.t_transaksi_masuk_detail.findMany({
      where: { id_transaksi_masuk: id },
    });

    // ambil supplier dan user (penginput) jika ada
    const supplier = trx.id_supplier
      ? await prisma.t_supplier.findUnique({
          where: { id: trx.id_supplier },
          select: { id: true, nama: true },
        })
      : null;
    const penginput = trx.id_user
      ? await prisma.t_user.findUnique({
          where: { id: trx.id_user },
          select: { id: true, nama: true, username: true },
        })
      : null;

    // ambil data berjangka masuk untuk transaksi ini
    const berjangkaList = await prisma.t_berjangka_masuk.findMany({
      where: { id_transaksi: id },
    });

    // ambil data barang untuk semua detail
    const barangIds = Array.from(
      new Set(details.map((d) => d.id_barang).filter(Boolean))
    );
    const barangList =
      barangIds.length > 0
        ? await prisma.t_barang.findMany({
            where: { id: { in: barangIds } },
            select: {
              id: true,
              kd_barang: true,
              nama_barang: true,
              jml_yard: true,
              jml_rol: true,
              created_at: true,
              updated_at: true,
            },
          })
        : [];

    // buat map barang berdasarkan id
    const barangMap = Object.fromEntries(
      barangList.map((b) => [
        b.id,
        {
          id: b.id,
          kd_barang: b.kd_barang,
          nama_barang: b.nama_barang,
          jml_yard: b.jml_yard != null ? Number(b.jml_yard) : 0,
          jml_rol: b.jml_rol != null ? Number(b.jml_rol) : 0,
          created_at: b.created_at,
          updated_at: b.updated_at,
        },
      ])
    );

    // transformasi numeric fields di details dan tambahkan data barang
    const detailsTransformed = details.map((d) => ({
      id: d.id,
      id_barang: d.id_barang,
      barang: d.id_barang ? barangMap[d.id_barang] || null : null,
      jml_yard: d.jml_yard != null ? Number(d.jml_yard) : 0,
      jml_rol: d.jml_rol != null ? Number(d.jml_rol) : 0,
      jml_yard_retur: d.jml_yard_retur != null ? Number(d.jml_yard_retur) : 0,
      jml_rol_retur: d.jml_rol_retur != null ? Number(d.jml_rol_retur) : 0,
      harga_satuan: d.harga_satuan != null ? Number(d.harga_satuan) : 0,
      created_at: d.created_at,
      updated_at: d.updated_at,
    }));

    // transformasi numeric fields di berjangka
    const berjangkaTransformed = berjangkaList.map((b) => ({
      id: b.id,
      tgl_jatuh_tempo: b.tgl_jatuh_tempo,
      jml_bayar: b.jml_bayar != null ? Number(b.jml_bayar) : 0,
      created_at: b.created_at,
      updated_at: b.updated_at,
    }));

    const response = {
      id: trx.id,
      tgl_transaksi: trx.tgl_transaksi,
      status_pembayaran: trx.status_pembayaran,
      tenor: trx.tenor,
      supplier: supplier ? { id: supplier.id, nama: supplier.nama } : null,
      total_transaksi:
        trx.total_transaksi != null ? Number(trx.total_transaksi) : 0,
      tipe_discount: trx.tipe_discount,
      jml_discount: trx.jml_discount != null ? Number(trx.jml_discount) : 0,
      tipe_ppn: trx.tipe_ppn,
      jml_ppn: trx.jml_ppn != null ? Number(trx.jml_ppn) : 0,
      catatan: trx.catatan,
      penginput: penginput
        ? {
            id: penginput.id,
            nama: penginput.nama,
            username: penginput.username,
          }
        : null,
      details: detailsTransformed,
      berjangka: berjangkaTransformed,
      created_at: trx.created_at,
      updated_at: trx.updated_at,
    };

    return res.status(200).json({ status: true, data: response });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

// Update berjangka masuk (pembayaran cicilan)
exports.updateBerjangkaMasuk = async (req, res) => {
  try {
    const id_transaksi = parseInt(req.params.id);
    const { payments, tanggal_tenor } = req.body;

    // Validasi
    if (!Array.isArray(payments) || payments.length === 0) {
      return res
        .status(400)
        .json({ status: false, message: "Data pembayaran kosong" });
    }

    // Cek transaksi masuk ada atau tidak
    const transaksiMasuk = await prisma.t_transaksi_masuk.findUnique({
      where: { id: id_transaksi },
    });
    if (!transaksiMasuk) {
      return res
        .status(404)
        .json({ status: false, message: "Transaksi masuk tidak ditemukan" });
    }

    // Gunakan transaction untuk update atomik
    const result = await prisma.$transaction(async (tx) => {
      const updatedPayments = [];
      let totalPaymentChange = 0; // Track total perubahan pembayaran untuk saldo

      for (const payment of payments) {
        const id = parseInt(payment.id);
        const jml_bayar =
          payment.jml_bayar !== undefined && payment.jml_bayar !== null
            ? Number(payment.jml_bayar)
            : 0;

        if (isNaN(id)) {
          throw new Error(`ID pembayaran tidak valid: ${payment.id}`);
        }

        if (isNaN(jml_bayar)) {
          throw new Error(`Jumlah bayar tidak valid untuk ID: ${id}`);
        }

        // Cek berjangka record ada atau tidak
        const existingBerjangka = await tx.t_berjangka_masuk.findUnique({
          where: { id },
        });
        if (!existingBerjangka) {
          throw new Error(`Record berjangka dengan ID ${id} tidak ditemukan`);
        }

        // Cek apakah id_transaksi sesuai
        if (existingBerjangka.id_transaksi !== id_transaksi) {
          throw new Error(
            `Record berjangka ID ${id} tidak termasuk dalam transaksi ini`
          );
        }

        // Hitung perubahan pembayaran (pembayaran baru - pembayaran lama)
        const oldPayment = existingBerjangka.jml_bayar
          ? Number(existingBerjangka.jml_bayar)
          : 0;
        const paymentDifference = jml_bayar - oldPayment;
        totalPaymentChange += paymentDifference;

        // Update berjangka
        const updated = await tx.t_berjangka_masuk.update({
          where: { id },
          data: {
            jml_bayar: jml_bayar,
            updated_at: new Date(),
          },
        });

        updatedPayments.push({
          id: updated.id,
          tgl_jatuh_tempo: updated.tgl_jatuh_tempo,
          jml_bayar: updated.jml_bayar != null ? Number(updated.jml_bayar) : 0,
          created_at: updated.created_at,
          updated_at: updated.updated_at,
        });
      }

      // Handle penambahan/pengurangan tenor (tanggal_tenor dikirim)
      if (tanggal_tenor !== undefined) {
        // Ambil semua berjangka existing
        const existingBerjangkaList = await tx.t_berjangka_masuk.findMany({
          where: { id_transaksi: id_transaksi },
          orderBy: { tgl_jatuh_tempo: "asc" },
        });

        // Cek apakah ada pembayaran pada tenor yang akan dihapus
        const hasPaymentInExisting = existingBerjangkaList.some(
          (b) => b.jml_bayar != null && Number(b.jml_bayar) > 0
        );

        if (hasPaymentInExisting && Array.isArray(tanggal_tenor)) {
          // Jika ada pembayaran, cek apakah jumlah tenor berubah
          if (tanggal_tenor.length !== existingBerjangkaList.length) {
            throw new Error(
              "Tidak dapat menambah atau mengurangi tenor karena sudah ada pembayaran berjangka yang tercatat"
            );
          }
        } else if (Array.isArray(tanggal_tenor)) {
          // Jika tidak ada pembayaran, bisa hapus dan buat tenor baru
          await tx.t_berjangka_masuk.deleteMany({
            where: { id_transaksi: id_transaksi },
          });

          // Buat tenor baru
          for (const tanggal of tanggal_tenor) {
            const tgl_jatuh_tempo = new Date(tanggal);
            await tx.t_berjangka_masuk.create({
              data: {
                id_transaksi: id_transaksi,
                tgl_jatuh_tempo: tgl_jatuh_tempo,
                jml_bayar: 0,
                created_at: new Date(),
                updated_at: new Date(),
              },
            });
          }
        }
      }

      // Update saldo jika ada perubahan pembayaran
      if (totalPaymentChange !== 0) {
        const saldoRec = await tx.t_saldo.findUnique({ where: { id: 1 } });
        if (saldoRec) {
          const currentSaldo =
            saldoRec.jml_saldo != null ? Number(saldoRec.jml_saldo) : 0;
          // Kurangi saldo sebesar total perubahan pembayaran
          const newSaldo = currentSaldo - totalPaymentChange;
          await tx.t_saldo.update({
            where: { id: 1 },
            data: { jml_saldo: newSaldo, updated_at: new Date() },
          });
        }
      }

      return updatedPayments;
    });

    return res.status(200).json({
      status: true,
      message: "Data pembayaran berjangka berhasil diperbarui",
      data: result,
    });
  } catch (error) {
    console.log(error);

    // Jika error adalah validasi business logic
    if (
      error.message.includes("Tidak dapat mengubah") ||
      error.message.includes("Tidak dapat menambah")
    ) {
      return res.status(400).json({ status: false, message: error.message });
    }

    return res.status(500).json({ status: false, message: error.message });
  }
};

// Get berjangka masuk by transaksi id
exports.getBerjangkaMasukByTransaksiId = async (req, res) => {
  try {
    const id_transaksi = parseInt(req.params.id);

    // Cek transaksi masuk ada atau tidak
    const transaksiMasuk = await prisma.t_transaksi_masuk.findUnique({
      where: { id: id_transaksi },
    });
    if (!transaksiMasuk) {
      return res
        .status(404)
        .json({ status: false, message: "Transaksi masuk tidak ditemukan" });
    }

    // Ambil semua berjangka untuk transaksi ini
    const berjangkaList = await prisma.t_berjangka_masuk.findMany({
      where: { id_transaksi: id_transaksi },
      orderBy: { tgl_jatuh_tempo: "asc" },
    });

    const transformed = berjangkaList.map((b) => ({
      id: b.id,
      tgl_jatuh_tempo: b.tgl_jatuh_tempo,
      jml_bayar: b.jml_bayar != null ? Number(b.jml_bayar) : 0,
      created_at: b.created_at,
      updated_at: b.updated_at,
    }));

    return res.status(200).json({
      status: true,
      data: transformed,
      message: "Data berjangka masuk berhasil diambil",
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

// Delete transaksi masuk
exports.deleteTransaksiMasuk = async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    // Cek transaksi ada atau tidak
    const transaksiMasuk = await prisma.t_transaksi_masuk.findUnique({
      where: { id },
    });
    if (!transaksiMasuk) {
      return res
        .status(404)
        .json({ status: false, message: "Transaksi masuk tidak ditemukan" });
    }

    // Cek apakah ada pembayaran berjangka yang sudah dilakukan
    const berjangkaList = await prisma.t_berjangka_masuk.findMany({
      where: { id_transaksi: id },
    });

    const hasPayment = berjangkaList.some(
      (b) => b.jml_bayar != null && Number(b.jml_bayar) > 0
    );

    if (hasPayment) {
      return res.status(400).json({
        status: false,
        message:
          "Tidak dapat menghapus transaksi karena sudah ada pembayaran berjangka yang tercatat",
      });
    }

    // Gunakan transaction untuk delete atomik
    await prisma.$transaction(async (tx) => {
      // Ambil detail untuk rollback stok
      const details = await tx.t_transaksi_masuk_detail.findMany({
        where: { id_transaksi_masuk: id },
      });

      // Rollback stok untuk setiap detail
      for (const detail of details) {
        if (detail.id_barang) {
          const existing = await tx.t_barang.findUnique({
            where: { id: detail.id_barang },
          });
          if (existing) {
            const currentYard =
              existing.jml_yard != null ? Number(existing.jml_yard) : 0;
            const currentRol =
              existing.jml_rol != null ? Number(existing.jml_rol) : 0;
            const detailYard =
              detail.jml_yard != null ? Number(detail.jml_yard) : 0;
            const detailRol =
              detail.jml_rol != null ? Number(detail.jml_rol) : 0;

            await tx.t_barang.update({
              where: { id: detail.id_barang },
              data: {
                jml_yard: currentYard - detailYard,
                jml_rol: currentRol - detailRol,
                updated_at: new Date(),
              },
            });
          }
        }
      }

      // Rollback saldo
      const saldoRec = await tx.t_saldo.findUnique({ where: { id: 1 } });
      if (saldoRec) {
        const currentSaldo =
          saldoRec.jml_saldo != null ? Number(saldoRec.jml_saldo) : 0;
        let saldoAdjustment = 0;

        // Jika status pembayaran bukan "1" (bukan berjangka), tambahkan total transaksi
        if (transaksiMasuk.status_pembayaran != "1") {
          const transaksiTotal = transaksiMasuk.total_transaksi
            ? Number(transaksiMasuk.total_transaksi)
            : 0;
          saldoAdjustment += transaksiTotal;
        } else {
          // Jika status pembayaran adalah "1" (berjangka), tambahkan total pembayaran cicilan
          const totalPayment = berjangkaList.reduce((sum, b) => {
            return sum + (b.jml_bayar ? Number(b.jml_bayar) : 0);
          }, 0);
          saldoAdjustment += totalPayment;
        }

        const newSaldo = currentSaldo + saldoAdjustment;
        await tx.t_saldo.update({
          where: { id: 1 },
          data: { jml_saldo: newSaldo, updated_at: new Date() },
        });
      }

      // Hapus semua berjangka
      await tx.t_berjangka_masuk.deleteMany({
        where: { id_transaksi: id },
      });

      // Hapus semua detail
      await tx.t_transaksi_masuk_detail.deleteMany({
        where: { id_transaksi_masuk: id },
      });

      // Hapus transaksi masuk
      await tx.t_transaksi_masuk.delete({
        where: { id },
      });
    });

    return res.status(200).json({
      status: true,
      message: "Transaksi masuk berhasil dihapus",
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

// Create retur for transaksi masuk
exports.createReturTransaksiMasuk = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);

    if (isNaN(id)) {
      return res
        .status(400)
        .json({ status: false, message: "Parameter id tidak valid" });
    }

    const { details } = req.body;

    if (!Array.isArray(details) || details.length === 0) {
      return res
        .status(400)
        .json({ status: false, message: "Details retur kosong" });
    }

    // Cek transaksi masuk ada atau tidak
    const transaksiMasuk = await prisma.t_transaksi_masuk.findUnique({
      where: { id },
    });
    if (!transaksiMasuk) {
      return res
        .status(404)
        .json({ status: false, message: "Transaksi masuk tidak ditemukan" });
    }

    // Gunakan transaction untuk update atomik
    const result = await prisma.$transaction(async (tx) => {
      let totalRefundDelta = 0; // Total refund dari semua detail

      // Process setiap detail retur
      for (const detailRetur of details) {
        const detailId = parseInt(detailRetur.id, 10);
        const newJmlYardRetur = detailRetur.jml_yard_retur
          ? Number(detailRetur.jml_yard_retur)
          : 0;
        const newJmlRolRetur = detailRetur.jml_rol_retur
          ? Number(detailRetur.jml_rol_retur)
          : 0;

        if (isNaN(detailId)) {
          throw new Error(`ID detail retur tidak valid: ${detailRetur.id}`);
        }

        // Cek detail ada atau tidak
        const existingDetail = await tx.t_transaksi_masuk_detail.findUnique({
          where: { id: detailId },
        });

        if (!existingDetail) {
          throw new Error(
            `Detail transaksi masuk dengan ID ${detailId} tidak ditemukan`
          );
        }

        // Validasi: detail harus termasuk dalam transaksi ini
        if (existingDetail.id_transaksi_masuk !== id) {
          throw new Error(
            `Detail ID ${detailId} tidak termasuk dalam transaksi ini`
          );
        }

        // Ambil nilai retur lama
        const oldJmlYardRetur = existingDetail.jml_yard_retur
          ? Number(existingDetail.jml_yard_retur)
          : 0;
        const oldJmlRolRetur = existingDetail.jml_rol_retur
          ? Number(existingDetail.jml_rol_retur)
          : 0;

        // Validasi: jml_yard_retur dan jml_rol_retur tidak boleh melebihi pembelian awal
        const originalJmlYard = existingDetail.jml_yard
          ? Number(existingDetail.jml_yard)
          : 0;
        const originalJmlRol = existingDetail.jml_rol
          ? Number(existingDetail.jml_rol)
          : 0;

        if (newJmlYardRetur > originalJmlYard) {
          throw new Error(
            `Retur yard untuk detail ${detailId} melebihi pembelian awal (${newJmlYardRetur} > ${originalJmlYard})`
          );
        }

        if (newJmlRolRetur > originalJmlRol) {
          throw new Error(
            `Retur rol untuk detail ${detailId} melebihi pembelian awal (${newJmlRolRetur} > ${originalJmlRol})`
          );
        }

        // Hitung delta (perubahan dari retur sebelumnya ke retur baru)
        const deltaYard = newJmlYardRetur - oldJmlYardRetur;
        const deltaRol = newJmlRolRetur - oldJmlRolRetur;

        // Update detail dengan jml_yard_retur dan jml_rol_retur baru
        await tx.t_transaksi_masuk_detail.update({
          where: { id: detailId },
          data: {
            jml_yard_retur: newJmlYardRetur,
            jml_rol_retur: newJmlRolRetur,
            updated_at: new Date(),
          },
        });

        // Update stock t_barang jika ada id_barang
        if (existingDetail.id_barang) {
          const barang = await tx.t_barang.findUnique({
            where: { id: existingDetail.id_barang },
          });

          if (barang) {
            // Kurangi stock sebesar delta retur
            // Jika retur naik (delta positif), stock turun (dikurangi)
            // Jika retur turun (delta negatif), stock naik (ditambah)
            const currentYard =
              barang.jml_yard != null ? Number(barang.jml_yard) : 0;
            const currentRol =
              barang.jml_rol != null ? Number(barang.jml_rol) : 0;

            const newYard = currentYard - deltaYard;
            const newRol = currentRol - deltaRol;

            await tx.t_barang.update({
              where: { id: existingDetail.id_barang },
              data: {
                jml_yard: newYard,
                jml_rol: newRol,
                updated_at: new Date(),
              },
            });
          }
        }

        // Hitung refund delta untuk detail ini (hanya berdasarkan yard, rol tidak berpengaruh)
        const hargaSatuan = existingDetail.harga_satuan
          ? Number(existingDetail.harga_satuan)
          : 0;
        const refundDelta = hargaSatuan * deltaYard;

        totalRefundDelta += refundDelta;
      }

      // Update t_transaksi_masuk.total_transaksi dikurangi totalRefundDelta
      const currentTotal = transaksiMasuk.total_transaksi
        ? Number(transaksiMasuk.total_transaksi)
        : 0;
      const newTotal = currentTotal - totalRefundDelta;

      const updatedTrx = await tx.t_transaksi_masuk.update({
        where: { id },
        data: {
          total_transaksi: newTotal,
          updated_at: new Date(),
        },
      });

      // Update t_saldo id=1 ditambahkan totalRefundDelta (refund masuk ke saldo)
      const saldoRec = await tx.t_saldo.findUnique({ where: { id: 1 } });
      if (saldoRec) {
        const currentSaldo =
          saldoRec.jml_saldo != null ? Number(saldoRec.jml_saldo) : 0;
        const newSaldo = currentSaldo + totalRefundDelta;

        await tx.t_saldo.update({
          where: { id: 1 },
          data: { jml_saldo: newSaldo, updated_at: new Date() },
        });
      } else {
        // Jika belum ada record saldo, buat baru
        await tx.t_saldo.create({
          data: {
            jml_saldo: totalRefundDelta,
            created_at: new Date(),
            updated_at: new Date(),
          },
        });
      }

      return {
        id: updatedTrx.id,
        total_transaksi:
          updatedTrx.total_transaksi != null
            ? Number(updatedTrx.total_transaksi)
            : 0,
        totalRefundDelta: totalRefundDelta,
        detailsProcessed: details.length,
      };
    });

    return res.status(200).json({
      status: true,
      message: "Retur transaksi masuk berhasil diproses",
      data: result,
    });
  } catch (error) {
    console.log(error);

    // Jika error adalah validasi business logic
    if (
      error.message.includes("melebihi") ||
      error.message.includes("tidak ditemukan") ||
      error.message.includes("tidak termasuk")
    ) {
      return res.status(400).json({ status: false, message: error.message });
    }

    return res.status(500).json({ status: false, message: error.message });
  }
};
