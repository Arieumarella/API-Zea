const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const { createLog } = require("../utils/logHelper");
const { haversineMeters, isValidCoordinates } = require("../utils/geo");
const {
  nowJakarta,
  dateString,
  timeToMinutes,
  combineDateAndTime,
} = require("../utils/hrTime");
const { processSelfie } = require("../utils/selfieUpload");
const {
  serializeDecimalFields,
  photoUrl,
  toNumber,
} = require("../utils/hrSerialize");
const { getStoreConfig, isDateLockedByFinalPayroll } = require("../utils/hrShared");

const VALID_STATUSES = [
  "PRESENT",
  "LATE",
  "SICK",
  "ANNUAL_LEAVE",
  "UNPAID_LEAVE",
  "FIELD_DUTY",
  "ALPHA",
];

function dateStart(value) {
  return new Date(`${value}T00:00:00Z`);
}

function dateEnd(value) {
  return new Date(`${value}T23:59:59Z`);
}

function serializeAttendance(req, attendance) {
  const serialized = serializeDecimalFields(attendance);
  serialized.check_in_photo_url = photoUrl(req, attendance.check_in_photo);
  serialized.check_out_photo_url = photoUrl(req, attendance.check_out_photo);
  return serialized;
}

exports.listAttendances = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const take = parseInt(req.query.take) || 10;
    const skip = (page - 1) * take;
    const storeId = req.query.store_id ? parseInt(req.query.store_id, 10) : null;
    const startDate = req.query.start_date || null;
    const endDate = req.query.end_date || null;
    const status = req.query.status || null;
    const search = req.query.search ? String(req.query.search).trim() : "";

    let userIds = null;
    if (search) {
      const matched = await prisma.t_user.findMany({
        where: {
          OR: [{ nama: { contains: search } }, { username: { contains: search } }],
        },
        select: { id: true },
      });
      userIds = matched.map((user) => user.id);
      if (userIds.length === 0) {
        return res.status(200).json({ status: true, data: [], page, total: 0, totalPages: 0 });
      }
    }

    const where = {};
    if (storeId) where.store_id = storeId;
    if (userIds) where.user_id = { in: userIds };
    if (startDate || endDate) {
      where.attendance_date = {};
      if (startDate) where.attendance_date.gte = dateStart(startDate);
      if (endDate) where.attendance_date.lte = dateEnd(endDate);
    }
    if (status) where.status = status;

    const [attendances, total] = await Promise.all([
      prisma.attendances.findMany({
        where,
        skip,
        take,
        orderBy: [{ attendance_date: "desc" }, { id: "desc" }],
      }),
      prisma.attendances.count({ where }),
    ]);

    const userIdList = [...new Set(attendances.map((attendance) => attendance.user_id))];
    const users = await prisma.t_user.findMany({
      where: { id: { in: userIdList } },
      select: { id: true, username: true, nama: true },
    });
    const userMap = {};
    users.forEach((user) => {
      userMap[user.id] = user;
    });

    const stores = await prisma.t_toko.findMany({
      where: { id: { in: [...new Set(attendances.map((a) => a.store_id))] } },
      select: { id: true, nama_toko: true },
    });
    const storeMap = {};
    stores.forEach((store) => {
      storeMap[store.id] = store.nama_toko;
    });

    const data = attendances.map((attendance) => ({
      ...serializeAttendance(req, attendance),
      user: userMap[attendance.user_id] || null,
      nama_toko: storeMap[attendance.store_id] || `Toko #${attendance.store_id}`,
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

exports.updateAttendance = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const attendance = await prisma.attendances.findUnique({ where: { id } });
    if (!attendance) {
      return res.status(404).json({ status: false, message: "Data absensi tidak ditemukan" });
    }

    const locked = await isDateLockedByFinalPayroll(attendance.user_id, attendance.attendance_date);
    if (locked) {
      return res.status(400).json({
        status: false,
        message: "Absensi ini sudah masuk payroll yang difinalisasi dan tidak bisa diubah.",
      });
    }

    const { check_in_time, check_out_time, status, late_minutes, notes } = req.body;
    const data = {};

    if (check_in_time !== undefined) {
      const parsed = new Date(check_in_time);
      if (Number.isNaN(parsed.getTime())) {
        return res.status(400).json({ status: false, message: "Format jam masuk tidak valid." });
      }
      data.check_in_time = parsed;
    }
    if (check_out_time !== undefined) {
      const parsed = new Date(check_out_time);
      if (Number.isNaN(parsed.getTime())) {
        return res.status(400).json({ status: false, message: "Format jam pulang tidak valid." });
      }
      data.check_out_time = parsed;
    }
    if (status !== undefined) {
      if (!VALID_STATUSES.includes(status)) {
        return res.status(400).json({ status: false, message: "Status absensi tidak valid." });
      }
      data.status = status;
      if (status === "PRESENT" && late_minutes === undefined) {
        data.late_minutes = 0;
      }
    }
    if (late_minutes !== undefined) {
      const parsed = parseInt(late_minutes, 10);
      if (Number.isNaN(parsed) || parsed < 0) {
        return res.status(400).json({ status: false, message: "Menit keterlambatan tidak valid." });
      }
      data.late_minutes = parsed;
    }
    if (notes !== undefined) data.notes = notes;

    const finalCheckIn = data.check_in_time || attendance.check_in_time;
    const finalCheckOut = data.check_out_time !== undefined ? data.check_out_time : attendance.check_out_time;
    if (finalCheckIn && finalCheckOut && new Date(finalCheckOut) <= new Date(finalCheckIn)) {
      return res.status(400).json({
        status: false,
        message: "Jam pulang tidak boleh sebelum atau sama dengan jam masuk.",
      });
    }

    const updated = await prisma.attendances.update({ where: { id }, data });

    createLog({
      id_toko: updated.store_id,
      id_user: req.user?.userId,
      aksi: "EDIT_HR_ATTENDANCE",
      keterangan: `Koreksi absensi #${updated.id} user #${updated.user_id} tanggal ${dateString(updated.attendance_date)}`,
    });

    return res.status(200).json({
      status: true,
      message: "Data absensi berhasil diperbarui.",
      data: serializeAttendance(req, updated),
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

exports.getMyToday = async (req, res) => {
  try {
    const profile = req.employee;
    const today = nowJakarta().format("YYYY-MM-DD");

    const [attendance, config, store] = await Promise.all([
      prisma.attendances.findFirst({
        where: {
          user_id: profile.user_id,
          attendance_date: { gte: dateStart(today), lte: dateEnd(today) },
        },
      }),
      getStoreConfig(profile.store_id),
      prisma.t_toko.findUnique({ where: { id: profile.store_id } }),
    ]);

    return res.status(200).json({
      status: true,
      data: {
        server_time: nowJakarta().toISOString(),
        today,
        attendance: attendance ? serializeAttendance(req, attendance) : null,
        profile: serializeDecimalFields(profile),
        hr_store: {
          id: profile.store_id,
          nama_toko: store ? store.nama_toko : null,
          latitude: toNumber(config?.latitude),
          longitude: toNumber(config?.longitude),
          radius_meters: config?.radius_meters ?? 50,
          work_start_time: config?.work_start_time ?? "08:00",
          work_end_time: config?.work_end_time ?? "17:00",
          grace_period_minutes: config?.grace_period_minutes ?? 15,
          work_days: config?.work_days ?? "1,2,3,4,5,6",
          location_configured: Boolean(config?.latitude && config?.longitude),
        },
      },
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

exports.clock = async (req, res) => {
  try {
    const profile = req.employee;
    const userId = profile.user_id;
    const { type, latitude, longitude, accuracy, store_id, notes } = req.body;

    if (type !== "IN" && type !== "OUT") {
      return res.status(400).json({ status: false, message: "Jenis absen tidak valid." });
    }

    if (!req.file) {
      return res.status(400).json({ status: false, message: "Foto wajib diunggah." });
    }

    if (!isValidCoordinates(Number(latitude), Number(longitude))) {
      return res.status(400).json({ status: false, message: "Koordinat lokasi tidak valid." });
    }

    let storeId = profile.store_id;
    if (profile.allow_any_store_checkin && store_id !== undefined && store_id !== null && store_id !== "") {
      const chosen = parseInt(store_id, 10);
      const chosenStore = await prisma.t_toko.findUnique({
        where: { id: chosen, status_aktif: true },
      });
      const chosenConfig = chosenStore ? await getStoreConfig(chosen) : null;
      if (chosenStore && chosenConfig) {
        storeId = chosen;
      }
    }

    const config = await getStoreConfig(storeId);
    if (!config) {
      return res.status(400).json({
        status: false,
        message: "Konfigurasi HR toko belum diatur. Hubungi admin.",
      });
    }
    if (config.latitude === null || config.longitude === null) {
      return res.status(400).json({
        status: false,
        message: "Lokasi toko belum diatur di sistem. Hubungi admin.",
      });
    }

    const distanceMeters = haversineMeters(
      Number(latitude),
      Number(longitude),
      Number(config.latitude),
      Number(config.longitude)
    );
    if (distanceMeters > config.radius_meters) {
      return res.status(400).json({
        status: false,
        message: `Anda berada di luar area toko (${Math.round(distanceMeters)} m dari batas ${config.radius_meters} m).`,
      });
    }

    const now = nowJakarta();
    const today = now.format("YYYY-MM-DD");
    const photoPath = await processSelfie(req.file.buffer, userId);
    const accuracyNumber = accuracy !== undefined && accuracy !== null && accuracy !== ""
      ? Number(accuracy)
      : null;

    if (type === "IN") {
      const existing = await prisma.attendances.findFirst({
        where: {
          user_id: userId,
          attendance_date: { gte: dateStart(today), lte: dateEnd(today) },
        },
      });
      if (existing) {
        return res.status(400).json({
          status: false,
          message: "Anda sudah absen masuk hari ini.",
        });
      }

      const nowMinutes = now.hour() * 60 + now.minute();
      const startMinutes = timeToMinutes(config.work_start_time);
      let status = "PRESENT";
      let lateMinutes = 0;
      if (nowMinutes > startMinutes + config.grace_period_minutes) {
        status = "LATE";
        lateMinutes = nowMinutes - startMinutes;
      }

      const attendance = await prisma.attendances.create({
        data: {
          user_id: userId,
          store_id: storeId,
          attendance_date: dateStart(today),
          check_in_time: now.toDate(),
          check_in_photo: photoPath,
          check_in_latitude: Number(latitude),
          check_in_longitude: Number(longitude),
          check_in_distance_m: distanceMeters,
          check_in_accuracy_m: accuracyNumber,
          status,
          late_minutes: lateMinutes,
          notes: notes || null,
        },
      });

      return res.status(200).json({
        status: true,
        message:
          status === "LATE"
            ? `Absen masuk tercatat. Anda terlambat ${lateMinutes} menit.`
            : "Absen masuk berhasil tercatat.",
        data: serializeAttendance(req, attendance),
      });
    }

    const existing = await prisma.attendances.findFirst({
      where: {
        user_id: userId,
        attendance_date: { gte: dateStart(today), lte: dateEnd(today) },
      },
    });
    if (!existing || !existing.check_in_time) {
      return res.status(400).json({
        status: false,
        message: "Anda belum absen masuk hari ini.",
      });
    }
    if (existing.check_out_time) {
      return res.status(400).json({
        status: false,
        message: "Anda sudah absen pulang hari ini.",
      });
    }

    const attendance = await prisma.attendances.update({
      where: { id: existing.id },
      data: {
        check_out_time: now.toDate(),
        check_out_photo: photoPath,
        check_out_latitude: Number(latitude),
        check_out_longitude: Number(longitude),
        check_out_distance_m: distanceMeters,
        check_out_accuracy_m: accuracyNumber,
        notes: notes ? [existing.notes, notes].filter(Boolean).join(" | ") : existing.notes,
      },
    });

    return res.status(200).json({
      status: true,
      message: "Absen pulang berhasil tercatat.",
      data: serializeAttendance(req, attendance),
    });
  } catch (error) {
    console.log(error);
    if (error.code === "P2002") {
      return res.status(400).json({
        status: false,
        message: "Anda sudah absen masuk hari ini.",
      });
    }
    return res.status(500).json({ status: false, message: error.message });
  }
};

exports.getMyHistory = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const take = parseInt(req.query.take) || 10;
    const skip = (page - 1) * take;

    const [rows, total] = await Promise.all([
      prisma.attendances.findMany({
        where: { user_id: req.employee.user_id },
        skip,
        take,
        orderBy: [{ attendance_date: "desc" }, { id: "desc" }],
      }),
      prisma.attendances.count({ where: { user_id: req.employee.user_id } }),
    ]);

    return res.status(200).json({
      status: true,
      data: rows.map((row) => serializeAttendance(req, row)),
      page,
      total,
      totalPages: Math.ceil(total / take),
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};


