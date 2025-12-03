const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

exports.getSaldo = async (req, res) => {
  try {
    const saldo = await prisma.t_saldo.findUnique({
      where: { id: 1 },
    });

    if (!saldo) {
      return res.status(404).json({
        status: false,
        message: "Data saldo tidak ditemukan",
      });
    }

    return res.status(200).json({
      status: true,
      data: {
        id: saldo.id,
        jml_saldo: saldo.jml_saldo != null ? Number(saldo.jml_saldo) : 0,
        created_at: saldo.created_at,
        updated_at: saldo.updated_at,
      },
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

exports.getTransaksiPenjualan = async (req, res) => {
  try {
    const result = await prisma.$queryRaw`
      SELECT
        SUM(total_transaksi) AS total_transaksi_keluar
      FROM
        t_transaksi_keluar
      WHERE
        tgl_transaksi >= DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01')
        AND tgl_transaksi <= LAST_DAY(CURRENT_DATE())
    `;

    const totalTransaksiKeluar = result[0]?.total_transaksi_keluar
      ? Number(result[0].total_transaksi_keluar)
      : 0;

    return res.status(200).json({
      status: true,
      data: {
        total_transaksi_keluar: totalTransaksiKeluar,
      },
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

exports.getTransaksiPembelian = async (req, res) => {
  try {
    const result = await prisma.$queryRaw`
      SELECT
    SUM(total_transaksi) AS total_transaksi_masuk
    FROM
        t_transaksi_masuk
    WHERE
    tgl_transaksi >= DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01')
    AND tgl_transaksi <= LAST_DAY(CURRENT_DATE());
    `;

    const totalTransaksiMasuk = result[0]?.total_transaksi_masuk
      ? Number(result[0].total_transaksi_masuk)
      : 0;

    return res.status(200).json({
      status: true,
      data: {
        total_transaksi_masuk: totalTransaksiMasuk,
      },
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

exports.getStokBarang = async (req, res) => {
  try {
    const result = await prisma.$queryRaw`
      SELECT SUM(jml_yard) AS tot_yard, SUM(jml_rol) AS tot_rol FROM t_barang
    `;

    const totalYard = result[0]?.tot_yard ? Number(result[0].tot_yard) : 0;

    const totalRol = result[0]?.tot_rol ? Number(result[0].tot_rol) : 0;

    return res.status(200).json({
      status: true,
      data: {
        total_yard: totalYard,
        total_rol: totalRol,
      },
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

exports.getPalingLaku = async (req, res) => {
  try {
    const { dari, sampai } = req.query;
    if (!dari || !sampai) {
      return res.status(400).json({
        status: false,
        message: "Parameter 'dari' dan 'sampai' wajib diisi",
      });
    }

    const result = await prisma.$queryRaw`
      SELECT b.nama_barang AS nama, terjual, revenue FROM (
        SELECT b.id_barang, SUM(b.jml_yard) AS terjual, SUM(b.jml_yard * b.harga_satuan) AS revenue FROM (SELECT * FROM t_transaksi_keluar WHERE tgl_transaksi >= ${dari} AND tgl_transaksi <= ${sampai}) AS a
        LEFT JOIN (SELECT id_barang, id_transaksi_keluar, jml_yard, harga_satuan FROM t_transaksi_keluar_detail) AS b ON a.id=b.id_transaksi_keluar
        GROUP BY b.id_barang ORDER BY SUM(b.jml_yard) DESC LIMIT 5
        ) AS a
        LEFT JOIN
        (SELECT id, nama_barang FROM t_barang) AS b ON a.id_barang=b.id
    `;

    const data = (result || []).map((row) => ({
      nama: row.nama,
      terjual: Number(row.terjual),
      revenue: Number(row.revenue),
    }));

    return res.status(200).json({ status: true, data });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

exports.getChartPenjualan = async (req, res) => {
  try {
    const { filter } = req.query;
    let data = [];

    if (filter === "harian") {
      // Group by DAYNAME for current week
      const penjualan = await prisma.$queryRaw`
        SELECT DAYNAME(tgl_transaksi) AS label, SUM(total_transaksi) AS penjualan
        FROM t_transaksi_keluar
        WHERE YEARWEEK(tgl_transaksi, 1) = YEARWEEK(CURRENT_DATE(), 1)
        GROUP BY DAYNAME(tgl_transaksi)
      `;
      const pengeluaran = await prisma.$queryRaw`
        SELECT DAYNAME(tgl_transaksi) AS label, SUM(total_transaksi) AS pengeluaran
        FROM t_transaksi_masuk
        WHERE YEARWEEK(tgl_transaksi, 1) = YEARWEEK(CURRENT_DATE(), 1)
        GROUP BY DAYNAME(tgl_transaksi)
      `;
      const oprasional = await prisma.$queryRaw`
        SELECT DAYNAME(created_at) AS label, SUM(jml_biaya) AS pengeluaran
        FROM t_oprasional
        WHERE YEARWEEK(created_at, 1) = YEARWEEK(CURRENT_DATE(), 1)
        GROUP BY DAYNAME(created_at)
      `;
      const labels = [
        "Senin",
        "Selasa",
        "Rabu",
        "Kamis",
        "Jumat",
        "Sabtu",
        "Minggu",
      ];
      data = labels.map((label) => {
        const pen = penjualan.find((x) => x.label === label);
        const peng = pengeluaran.find((x) => x.label === label);
        const opr = oprasional.find((x) => x.label === label);
        return {
          label,
          penjualan: Number(pen?.penjualan || 0),
          pengeluaran:
            Number(peng?.pengeluaran || 0) + Number(opr?.pengeluaran || 0),
        };
      });
    } else if (filter === "mingguan") {
      // Group by week in current month
      const penjualan = await prisma.$queryRaw`
        SELECT CONCAT('Minggu ', WEEK(tgl_transaksi) - WEEK(DATE_FORMAT(tgl_transaksi, '%Y-%m-01')) + 1) AS label,
          SUM(total_transaksi) AS penjualan
        FROM t_transaksi_keluar
        WHERE MONTH(tgl_transaksi) = MONTH(CURRENT_DATE()) AND YEAR(tgl_transaksi) = YEAR(CURRENT_DATE())
        GROUP BY label
      `;
      const pengeluaran = await prisma.$queryRaw`
        SELECT CONCAT('Minggu ', WEEK(tgl_transaksi) - WEEK(DATE_FORMAT(tgl_transaksi, '%Y-%m-01')) + 1) AS label,
          SUM(total_transaksi) AS pengeluaran
        FROM t_transaksi_masuk
        WHERE MONTH(tgl_transaksi) = MONTH(CURRENT_DATE()) AND YEAR(tgl_transaksi) = YEAR(CURRENT_DATE())
        GROUP BY label
      `;
      const oprasional = await prisma.$queryRaw`
        SELECT CONCAT('Minggu ', WEEK(created_at) - WEEK(DATE_FORMAT(created_at, '%Y-%m-01')) + 1) AS label, SUM(jml_biaya) AS pengeluaran
        FROM t_oprasional
        WHERE MONTH(created_at) = MONTH(CURRENT_DATE()) AND YEAR(created_at) = YEAR(CURRENT_DATE())
        GROUP BY label
      `;
      const mingguLabels = [
        "Minggu 1",
        "Minggu 2",
        "Minggu 3",
        "Minggu 4",
        "Minggu 5",
      ];
      data = mingguLabels.map((label) => {
        const pen = penjualan.find((x) => x.label === label);
        const peng = pengeluaran.find((x) => x.label === label);
        const opr = oprasional.find((x) => x.label === label);
        return {
          label,
          penjualan: Number(pen?.penjualan || 0),
          pengeluaran:
            Number(peng?.pengeluaran || 0) + Number(opr?.pengeluaran || 0),
        };
      });
    } else if (filter === "tahunan") {
      // Group by year
      const penjualan = await prisma.$queryRaw`
        SELECT YEAR(tgl_transaksi) AS label, SUM(total_transaksi) AS penjualan
        FROM t_transaksi_keluar
        GROUP BY YEAR(tgl_transaksi)
        ORDER BY label ASC
      `;
      const pengeluaran = await prisma.$queryRaw`
        SELECT YEAR(tgl_transaksi) AS label, SUM(total_transaksi) AS pengeluaran
        FROM t_transaksi_masuk
        GROUP BY YEAR(tgl_transaksi)
        ORDER BY label ASC
      `;
      const oprasional = await prisma.$queryRaw`
        SELECT YEAR(created_at) AS label, SUM(jml_biaya) AS pengeluaran
        FROM t_oprasional
        GROUP BY YEAR(created_at)
      `;
      const tahunLabels = [
        ...new Set([
          ...penjualan.map((x) => x.label),
          ...pengeluaran.map((x) => x.label),
          ...oprasional.map((x) => x.label),
        ]),
      ].sort();
      data = tahunLabels.map((label) => {
        const pen = penjualan.find((x) => x.label === label);
        const peng = pengeluaran.find((x) => x.label === label);
        const opr = oprasional.find((x) => x.label === label);
        return {
          label: String(label),
          penjualan: Number(pen?.penjualan || 0),
          pengeluaran:
            Number(peng?.pengeluaran || 0) + Number(opr?.pengeluaran || 0),
        };
      });
    } else {
      // Default: bulanan (group by month in current year)
      const penjualan = await prisma.$queryRaw`
        SELECT MONTHNAME(tgl_transaksi) AS label, SUM(total_transaksi) AS penjualan
        FROM t_transaksi_keluar
        WHERE YEAR(tgl_transaksi) = YEAR(CURRENT_DATE())
        GROUP BY MONTH(tgl_transaksi)
        ORDER BY MONTH(tgl_transaksi)
      `;
      const pengeluaran = await prisma.$queryRaw`
        SELECT MONTHNAME(tgl_transaksi) AS label, SUM(total_transaksi) AS pengeluaran
        FROM t_transaksi_masuk
        WHERE YEAR(tgl_transaksi) = YEAR(CURRENT_DATE())
        GROUP BY MONTH(tgl_transaksi)
        ORDER BY MONTH(tgl_transaksi)
      `;
      const oprasional = await prisma.$queryRaw`
        SELECT MONTHNAME(created_at) AS label, SUM(jml_biaya) AS pengeluaran
        FROM t_oprasional
        WHERE YEAR(created_at) = YEAR(CURRENT_DATE())
        GROUP BY MONTH(created_at)
        ORDER BY MONTH(created_at)
      `;
      const bulanLabels = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "Mei",
        "Jun",
        "Jul",
        "Agu",
        "Sep",
        "Okt",
        "Nov",
        "Des",
      ];
      data = bulanLabels.map((label) => {
        // Cari label yang diawali nama bulan (karena MONTHNAME bisa "May" dll)
        const pen = penjualan.find((x) => x.label.startsWith(label));
        const peng = pengeluaran.find((x) => x.label.startsWith(label));
        const opr = oprasional.find((x) => x.label.startsWith(label));
        return {
          label,
          penjualan: Number(pen?.penjualan || 0),
          pengeluaran:
            Number(peng?.pengeluaran || 0) + Number(opr?.pengeluaran || 0),
        };
      });
    }

    // Limit bulanan to 12, others to 10 entries
    let limit = 10;
    if (!filter || filter === "bulanan") limit = 12;
    return res.status(200).json({ status: true, data: data.slice(0, limit) });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

exports.getDataOprasional = async (req, res) => {
  try {
    const { dari, sampai } = req.query;
    if (!dari || !sampai) {
      return res.status(400).json({
        status: false,
        message: "Parameter 'dari' dan 'sampai' wajib diisi",
      });
    }

    const result = await prisma.$queryRaw`
      SELECT
    nama_baya AS kategori,
    jml_biaya AS jumlah
    FROM
        t_oprasional
    WHERE
        DATE(created_at) >= ${dari}
        AND DATE(created_at) <= ${sampai}
    ORDER BY
        id DESC;
        `;

    const data = (result || []).map((row) => ({
      kategori: row.kategori,
      jumlah: Number(row.jumlah),
    }));

    return res.status(200).json({ status: true, data });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

exports.getDataPelanggan = async (req, res) => {
  try {
    const { dari, sampai } = req.query;
    if (!dari || !sampai) {
      return res.status(400).json({
        status: false,
        message: "Parameter 'dari' dan 'sampai' wajib diisi",
      });
    }

    const result = await prisma.$queryRaw`
      SELECT b.nama AS nama, pembelian, totalNilai FROM (SELECT id_pelanggan, COUNT(*) AS pembelian, SUM(total_transaksi) AS totalNilai FROM t_transaksi_keluar WHERE tgl_transaksi >= ${dari} AND tgl_transaksi <= ${sampai} GROUP BY id_pelanggan ORDER BY COUNT(*),SUM(total_transaksi) DESC ) AS a
      LEFT JOIN (SELECT * FROM t_pelanggan) AS b ON a.id_pelanggan=b.id LIMIT 8
        `;

    const data = (result || []).map((row) => ({
      nama: row.nama,
      pembelian: Number(row.pembelian),
      totalNilai: Number(row.totalNilai),
    }));

    return res.status(200).json({ status: true, data });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

exports.getJatuhTempoPiutang = async (req, res) => {
  try {
    const transaksiKeluar = await prisma.$queryRaw`
      SELECT b.id AS id, b.id AS nomorTransaksi, c.nama AS pelanggan, b.total_transaksi AS totalHarga, DATEDIFF(a.tgl_jatuh_tempo_awal, CURDATE()) AS hariHitung,
      IF(
              DATEDIFF(a.tgl_jatuh_tempo_awal, CURDATE()) < 3,
              'Urgent',
              IF(
                  DATEDIFF(a.tgl_jatuh_tempo_awal, CURDATE()) < 7,
                  'Segera',
                  'Normal'
              )
      )
      AS STATUS, tgl_jatuh_tempo_awal AS tanggalJatuhTempo FROM (
      SELECT id, id_transaksi, MIN(tgl_jatuh_tempo) AS tgl_jatuh_tempo_awal FROM t_berjangka_keluar WHERE  jml_bayar = 0 GROUP BY id_transaksi
      ) AS a
      LEFT JOIN (SELECT * FROM t_transaksi_keluar) AS b ON a.id_transaksi=b.id
      LEFT JOIN (SELECT * FROM t_pelanggan) AS c ON b.id_pelanggan=c.id
      `;

    const transaksiMasuk = await prisma.$queryRaw`
    SELECT b.id AS id, b.id AS nomorTransaksi, c.nama AS pelanggan, b.total_transaksi AS totalHarga, DATEDIFF(a.tgl_jatuh_tempo_awal, CURDATE()) AS hariHitung,
      IF(
              DATEDIFF(a.tgl_jatuh_tempo_awal, CURDATE()) < 3,
              'Urgent',
              IF(
                  DATEDIFF(a.tgl_jatuh_tempo_awal, CURDATE()) < 7,
                  'Segera',
                  'Normal'
              )
      )
      AS status, tgl_jatuh_tempo_awal AS tanggalJatuhTempo FROM (
      SELECT id, id_transaksi, MIN(tgl_jatuh_tempo) AS tgl_jatuh_tempo_awal FROM t_berjangka_masuk WHERE  jml_bayar = 0 GROUP BY id_transaksi
      ) AS a
      LEFT JOIN (SELECT * FROM t_transaksi_masuk) AS b ON a.id_transaksi=b.id
      LEFT JOIN (SELECT * FROM t_supplier) AS c ON b.id_supplier=c.id  
      `;

    const datatransaksiKeluar = (transaksiKeluar || []).map((row) => ({
      id: row.id,
      nomorTransaksi: row.nomorTransaksi,
      pelanggan: row.pelanggan,
      totalHarga: Number(row.totalHarga),
      hariHitung: Number(row.hariHitung),
      status: row.status,
      tanggalJatuhTempo: row.tanggalJatuhTempo,
    }));

    const datatransaksiMasuk = (transaksiMasuk || []).map((row) => ({
      id: row.id,
      nomorTransaksi: row.nomorTransaksi,
      pelanggan: row.pelanggan,
      totalHarga: Number(row.totalHarga),
      hariHitung: Number(row.hariHitung),
      status: row.status,
      tanggalJatuhTempo: row.tanggalJatuhTempo,
    }));

    return res
      .status(200)
      .json({ status: true, datatransaksiKeluar, datatransaksiMasuk });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};
