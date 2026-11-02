const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const { createLog } = require("../utils/logHelper");
const { serializeDecimalFields } = require("../utils/hrSerialize");
const { isValidLatitude, isValidLongitude } = require("../utils/geo");
const { timeToMinutes } = require("../utils/hrTime");

function parseWorkDays(value) {
  if (value === undefined || value === null) return undefined;
  const parts = String(value)
    .split(",")
    .map((part) => parseInt(part.trim(), 10))
    .filter((day) => !Number.isNaN(day) && day >= 1 && day <= 7);
  if (parts.length === 0) return null;
  return [...new Set(parts)].sort((a, b) => a - b).join(",");
}

function validateTimeString(value) {
  if (typeof value !== "string" || !/^\d{1,2}:\d{2}$/.test(value.trim())) {
    return false;
  }
  const minutes = timeToMinutes(value);
  return minutes >= 0 && minutes < 1440;
}

exports.listStoreConfigs = async (req, res) => {
  try {
    const [configs, stores] = await Promise.all([
      prisma.store_hr_configs.findMany({ orderBy: { store_id: "asc" } }),
      prisma.t_toko.findMany({
        orderBy: { id: "asc" },
        select: { id: true, nama_toko: true, alamat: true, maps: true },
      }),
    ]);

    const storeMap = {};
    stores.forEach((store) => {
      storeMap[store.id] = store;
    });

    const data = configs.map((config) => ({
      ...serializeDecimalFields(config),
      toko: storeMap[config.store_id] || { id: config.store_id, nama_toko: `Toko #${config.store_id}` },
    }));

    return res.status(200).json({ status: true, data });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

exports.getStoreConfig = async (req, res) => {
  try {
    const storeId = parseInt(req.params.storeId, 10);
    const config = await prisma.store_hr_configs.findUnique({
      where: { store_id: storeId },
    });
    if (!config) {
      return res.status(404).json({
        status: false,
        message: "Konfigurasi HR untuk toko ini belum dibuat.",
      });
    }
    const store = await prisma.t_toko.findUnique({ where: { id: storeId } });
    return res.status(200).json({
      status: true,
      data: { ...serializeDecimalFields(config), toko: store },
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

exports.updateStoreConfig = async (req, res) => {
  try {
    const storeId = parseInt(req.params.storeId, 10);
    const store = await prisma.t_toko.findUnique({ where: { id: storeId } });
    if (!store) {
      return res.status(404).json({ status: false, message: "Toko tidak ditemukan" });
    }

    const {
      latitude,
      longitude,
      radius_meters,
      work_start_time,
      work_end_time,
      grace_period_minutes,
      late_penalty_per_occurrence,
      missing_checkout_penalty,
      work_days,
    } = req.body;

    const data = {};

    if (latitude !== undefined || longitude !== undefined) {
      const hasLat = latitude !== undefined && latitude !== null && latitude !== "";
      const hasLng = longitude !== undefined && longitude !== null && longitude !== "";
      if (hasLat !== hasLng) {
        return res.status(400).json({
          status: false,
          message: "Latitude dan longitude harus diisi keduanya.",
        });
      }
      if (hasLat) {
        if (!isValidLatitude(Number(latitude)) || !isValidLongitude(Number(longitude))) {
          return res.status(400).json({
            status: false,
            message: "Koordinat lokasi tidak valid.",
          });
        }
        data.latitude = Number(latitude);
        data.longitude = Number(longitude);
      } else {
        data.latitude = null;
        data.longitude = null;
      }
    }

    if (radius_meters !== undefined) {
      const radius = parseInt(radius_meters, 10);
      if (Number.isNaN(radius) || radius < 10 || radius > 1000) {
        return res.status(400).json({
          status: false,
          message: "Radius harus antara 10 sampai 1000 meter.",
        });
      }
      data.radius_meters = radius;
    }

    if (work_start_time !== undefined) {
      if (!validateTimeString(work_start_time)) {
        return res.status(400).json({
          status: false,
          message: "Format jam masuk tidak valid (HH:mm).",
        });
      }
      data.work_start_time = work_start_time.trim();
    }

    if (work_end_time !== undefined) {
      if (!validateTimeString(work_end_time)) {
        return res.status(400).json({
          status: false,
          message: "Format jam pulang tidak valid (HH:mm).",
        });
      }
      data.work_end_time = work_end_time.trim();
    }

    if (grace_period_minutes !== undefined) {
      const grace = parseInt(grace_period_minutes, 10);
      if (Number.isNaN(grace) || grace < 0 || grace > 240) {
        return res.status(400).json({
          status: false,
          message: "Toleransi keterlambatan harus antara 0 sampai 240 menit.",
        });
      }
      data.grace_period_minutes = grace;
    }

    if (late_penalty_per_occurrence !== undefined) {
      const penalty = Number(late_penalty_per_occurrence);
      if (Number.isNaN(penalty) || penalty < 0) {
        return res.status(400).json({
          status: false,
          message: "Denda telat tidak boleh negatif.",
        });
      }
      data.late_penalty_per_occurrence = penalty;
    }

    if (missing_checkout_penalty !== undefined) {
      const penalty = Number(missing_checkout_penalty);
      if (Number.isNaN(penalty) || penalty < 0) {
        return res.status(400).json({
          status: false,
          message: "Denda lupa absen pulang tidak boleh negatif.",
        });
      }
      data.missing_checkout_penalty = penalty;
    }

    if (work_days !== undefined) {
      const parsed = parseWorkDays(work_days);
      if (parsed === null) {
        return res.status(400).json({
          status: false,
          message: "Pilih minimal satu hari kerja.",
        });
      }
      data.work_days = parsed;
    }

    let config = await prisma.store_hr_configs.findUnique({
      where: { store_id: storeId },
    });

    if (config) {
      config = await prisma.store_hr_configs.update({
        where: { store_id: storeId },
        data,
      });
    } else {
      config = await prisma.store_hr_configs.create({
        data: {
          store_id: storeId,
          radius_meters: data.radius_meters !== undefined ? data.radius_meters : 50,
          work_start_time: data.work_start_time !== undefined ? data.work_start_time : "08:00",
          work_end_time: data.work_end_time !== undefined ? data.work_end_time : "17:00",
          grace_period_minutes:
            data.grace_period_minutes !== undefined ? data.grace_period_minutes : 15,
          late_penalty_per_occurrence:
            data.late_penalty_per_occurrence !== undefined ? data.late_penalty_per_occurrence : 0,
          missing_checkout_penalty:
            data.missing_checkout_penalty !== undefined ? data.missing_checkout_penalty : 0,
          work_days: data.work_days !== undefined ? data.work_days : "1,2,3,4,5,6",
          latitude: data.latitude,
          longitude: data.longitude,
        },
      });
    }

    createLog({
      id_toko: storeId,
      id_user: req.user?.userId,
      aksi: "EDIT_HR_STORE_CONFIG",
      keterangan: `Memperbarui konfigurasi HR toko #${storeId} '${store.nama_toko}'`,
    });

    return res.status(200).json({
      status: true,
      message: "Konfigurasi HR toko berhasil disimpan.",
      data: { ...serializeDecimalFields(config), toko: store },
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

exports.listHolidays = async (req, res) => {
  try {
    const storeId = req.query.store_id ? parseInt(req.query.store_id, 10) : null;
    const where = storeId ? { store_id: storeId } : {};
    const holidays = await prisma.holidays.findMany({
      where,
      orderBy: { holiday_date: "asc" },
    });
    return res.status(200).json({ status: true, data: holidays });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

exports.createHoliday = async (req, res) => {
  try {
    const { store_id, holiday_date, name } = req.body;
    const storeId = parseInt(store_id, 10);
    if (Number.isNaN(storeId)) {
      return res.status(400).json({ status: false, message: "Toko wajib dipilih." });
    }
    const store = await prisma.t_toko.findUnique({ where: { id: storeId } });
    if (!store) {
      return res.status(404).json({ status: false, message: "Toko tidak ditemukan" });
    }
    if (!holiday_date || !/^\d{4}-\d{2}-\d{2}$/.test(holiday_date)) {
      return res.status(400).json({ status: false, message: "Format tanggal libur tidak valid." });
    }
    if (!name || !name.trim()) {
      return res.status(400).json({ status: false, message: "Nama hari libur wajib diisi." });
    }

    const existing = await prisma.holidays.findFirst({
      where: {
        store_id: storeId,
        holiday_date: {
          gte: new Date(`${holiday_date}T00:00:00Z`),
          lte: new Date(`${holiday_date}T23:59:59Z`),
        },
      },
    });
    if (existing) {
      return res.status(400).json({
        status: false,
        message: "Tanggal tersebut sudah menjadi hari libur untuk toko ini.",
      });
    }

    const holiday = await prisma.holidays.create({
      data: {
        store_id: storeId,
        holiday_date: new Date(`${holiday_date}T00:00:00Z`),
        name: name.trim(),
      },
    });

    createLog({
      id_toko: storeId,
      id_user: req.user?.userId,
      aksi: "TAMBAH_HR_HOLIDAY",
      keterangan: `Menambah hari libur '${holiday.name}' (${holiday_date}) untuk toko #${storeId}`,
    });

    return res.status(201).json({
      status: true,
      message: "Hari libur berhasil ditambahkan.",
      data: holiday,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

exports.updateHoliday = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = await prisma.holidays.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ status: false, message: "Hari libur tidak ditemukan" });
    }
    const { holiday_date, name } = req.body;
    const data = {};
    if (holiday_date !== undefined) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(holiday_date)) {
        return res.status(400).json({ status: false, message: "Format tanggal libur tidak valid." });
      }
      data.holiday_date = new Date(`${holiday_date}T00:00:00Z`);
    }
    if (name !== undefined) {
      if (!name.trim()) {
        return res.status(400).json({ status: false, message: "Nama hari libur wajib diisi." });
      }
      data.name = name.trim();
    }
    const holiday = await prisma.holidays.update({ where: { id }, data });
    return res.status(200).json({
      status: true,
      message: "Hari libur berhasil diperbarui.",
      data: holiday,
    });
  } catch (error) {
    console.log(error);
    if (error.code === "P2002") {
      return res.status(400).json({
        status: false,
        message: "Tanggal tersebut sudah menjadi hari libur untuk toko ini.",
      });
    }
    return res.status(500).json({ status: false, message: error.message });
  }
};

exports.deleteHoliday = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = await prisma.holidays.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ status: false, message: "Hari libur tidak ditemukan" });
    }
    await prisma.holidays.delete({ where: { id } });

    createLog({
      id_toko: existing.store_id,
      id_user: req.user?.userId,
      aksi: "HAPUS_HR_HOLIDAY",
      keterangan: `Menghapus hari libur '${existing.name}' untuk toko #${existing.store_id}`,
    });

    return res.status(200).json({
      status: true,
      message: "Hari libur berhasil dihapus.",
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

