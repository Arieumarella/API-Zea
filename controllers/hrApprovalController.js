const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const { createLog } = require("../utils/logHelper");
const { listDates, combineDateAndTime, dateString } = require("../utils/hrTime");
const { serializeDecimalFields, photoUrl } = require("../utils/hrSerialize");
const { isDateLockedByFinalPayroll, getStoreConfig, syncLeaveQuota } = require("../utils/hrShared");

const REQUEST_TYPES = ["leave", "overtime", "correction", "loan"];

const MODEL_MAP = {
  leave: "leave_requests",
  overtime: "overtime_requests",
  correction: "attendance_corrections",
  loan: "employee_loans",
};

function serializeRequest(req, row) {
  const serialized = serializeDecimalFields(row);
  serialized.attachment_url = photoUrl(req, row.attachment);
  return serialized;
}

async function getUsersAndStores(rows) {
  const userIds = [...new Set(rows.map((row) => row.user_id).filter(Boolean))];
  const storeIds = [...new Set(rows.map((row) => row.store_id).filter(Boolean))];
  const [users, stores] = await Promise.all([
    prisma.t_user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, username: true, nama: true, jabatan: true },
    }),
    prisma.t_toko.findMany({
      where: { id: { in: storeIds } },
      select: { id: true, nama_toko: true },
    }),
  ]);
  const userMap = {};
  const storeMap = {};
  users.forEach((user) => {
    userMap[user.id] = user;
  });
  stores.forEach((store) => {
    storeMap[store.id] = store.nama_toko;
  });
  return { userMap, storeMap };
}

exports.summary = async (req, res) => {
  try {
    const [leave, overtime, correction, loan] = await Promise.all([
      prisma.leave_requests.count({ where: { status: "PENDING" } }),
      prisma.overtime_requests.count({ where: { status: "PENDING" } }),
      prisma.attendance_corrections.count({ where: { status: "PENDING" } }),
      prisma.employee_loans.count({ where: { status: "PENDING" } }),
    ]);
    return res.status(200).json({
      status: true,
      data: {
        leave: leave,
        overtime: overtime,
        correction: correction,
        loan: loan,
        total: leave + overtime + correction + loan,
      },
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

exports.listApprovals = async (req, res) => {
  try {
    const type = req.query.type || "leave";
    if (!REQUEST_TYPES.includes(type)) {
      return res.status(400).json({ status: false, message: "Jenis approval tidak valid." });
    }
    const page = parseInt(req.query.page) || 1;
    const take = parseInt(req.query.take) || 10;
    const skip = (page - 1) * take;
    const status = req.query.status || null;
    const storeId = req.query.store_id ? parseInt(req.query.store_id, 10) : null;

    const where = {};
    if (status) where.status = status;
    if (storeId) where.store_id = storeId;

    const model = prisma[MODEL_MAP[type]];
    const [rows, total] = await Promise.all([
      model.findMany({ where, skip, take, orderBy: { id: "desc" } }),
      model.count({ where }),
    ]);

    const { userMap, storeMap } = await getUsersAndStores(rows);

    const data = rows.map((row) => ({
      ...serializeRequest(req, row),
      user: userMap[row.user_id] || null,
      nama_toko: storeMap[row.store_id] || `Toko #${row.store_id}`,
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

exports.getApproval = async (req, res) => {
  try {
    const type = req.params.type;
    const id = parseInt(req.params.id, 10);
    if (!REQUEST_TYPES.includes(type)) {
      return res.status(400).json({ status: false, message: "Jenis approval tidak valid." });
    }
    const model = prisma[MODEL_MAP[type]];
    const row = await model.findUnique({ where: { id } });
    if (!row) {
      return res.status(404).json({ status: false, message: "Data pengajuan tidak ditemukan" });
    }
    const { userMap, storeMap } = await getUsersAndStores([row]);
    return res.status(200).json({
      status: true,
      data: {
        ...serializeRequest(req, row),
        user: userMap[row.user_id] || null,
        nama_toko: storeMap[row.store_id] || `Toko #${row.store_id}`,
      },
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

async function approveLeave(request, adminNotes, adminUserId) {
  const dates = listDates(
    dateString(request.start_date),
    dateString(request.end_date)
  );

  const conflicting = await prisma.attendances.findFirst({
    where: {
      user_id: request.user_id,
      status: { in: ["PRESENT", "LATE"] },
      attendance_date: {
        gte: new Date(`${dates[0]}T00:00:00Z`),
        lte: new Date(`${dates[dates.length - 1]}T23:59:59Z`),
      },
    },
  });
  if (conflicting) {
    throw Object.assign(new Error("Ada absensi hadir pada rentang tanggal cuti tersebut."), { statusCode: 400 });
  }

  for (const date of dates) {
    if (await isDateLockedByFinalPayroll(request.user_id, date)) {
      throw Object.assign(
        new Error("Rentang tanggal sudah masuk payroll yang difinalisasi."),
        { statusCode: 400 }
      );
    }
  }

  if (request.type === "ANNUAL_LEAVE") {
    const rawProfile = await prisma.employee_profiles.findUnique({
      where: { user_id: request.user_id },
    });
    const days = dates.length;
    if (!rawProfile) {
      throw Object.assign(new Error("Pegawai belum memiliki profil HR."), { statusCode: 400 });
    }
    const profile = await syncLeaveQuota(rawProfile);
    if (profile.annual_leave_quota < days) {
      throw Object.assign(
        new Error(`Kuota cuti tahunan tidak mencukupi (sisa ${profile.annual_leave_quota} hari).`),
        { statusCode: 400 }
      );
    }
    await prisma.employee_profiles.update({
      where: { user_id: request.user_id },
      data: { annual_leave_quota: profile.annual_leave_quota - days },
    });
  }

  for (const date of dates) {
    try {
      await prisma.attendances.create({
        data: {
          user_id: request.user_id,
          store_id: request.store_id,
          attendance_date: new Date(`${date}T00:00:00Z`),
          status: request.type,
          late_minutes: 0,
          notes: `Cuti disetujui: ${request.reason}`,
        },
      });
    } catch (error) {
      if (error.code !== "P2002") throw error;
    }
  }
}

async function approveCorrection(request, adminNotes) {
  const attendance = await prisma.attendances.findFirst({
    where: {
      user_id: request.user_id,
      attendance_date: {
        gte: new Date(`${dateString(request.attendance_date)}T00:00:00Z`),
        lte: new Date(`${dateString(request.attendance_date)}T23:59:59Z`),
      },
    },
  });
  if (!attendance) {
    throw Object.assign(
      new Error("Tidak ada absensi pada tanggal tersebut."),
      { statusCode: 400 }
    );
  }
  if (await isDateLockedByFinalPayroll(request.user_id, request.attendance_date)) {
    throw Object.assign(
      new Error("Tanggal tersebut sudah masuk payroll yang difinalisasi."),
      { statusCode: 400 }
    );
  }

  if (request.correction_type === "LATE_DISPENSATION") {
    if (!attendance.check_in_time) {
      throw Object.assign(new Error("Pegawai belum absen masuk pada tanggal tersebut."), { statusCode: 400 });
    }
    await prisma.attendances.update({
      where: { id: attendance.id },
      data: {
        status: "PRESENT",
        late_minutes: 0,
        notes: attendance.notes
          ? `${attendance.notes} | Dispensasi keterlambatan disetujui`
          : "Dispensasi keterlambatan disetujui",
      },
    });
  } else {
    if (!attendance.check_in_time) {
      throw Object.assign(new Error("Pegawai belum absen masuk pada tanggal tersebut."), { statusCode: 400 });
    }
    if (attendance.check_out_time) {
      throw Object.assign(new Error("Absensi tersebut sudah memiliki jam pulang."), { statusCode: 400 });
    }
    const checkOut = combineDateAndTime(
      dateString(request.attendance_date),
      request.requested_check_out_time || "17:00"
    );
    if (!checkOut || checkOut <= new Date(attendance.check_in_time)) {
      throw Object.assign(
        new Error("Jam pulang yang diajukan tidak valid (harus setelah jam masuk)."),
        { statusCode: 400 }
      );
    }
    await prisma.attendances.update({
      where: { id: attendance.id },
      data: {
        check_out_time: checkOut,
        notes: attendance.notes
          ? `${attendance.notes} | Koreksi lupa absen pulang disetujui`
          : "Koreksi lupa absen pulang disetujui",
      },
    });
  }
}

exports.action = async (req, res) => {
  try {
    const type = req.params.type;
    const id = parseInt(req.params.id, 10);
    const { action, admin_notes } = req.body;

    if (!REQUEST_TYPES.includes(type)) {
      return res.status(400).json({ status: false, message: "Jenis approval tidak valid." });
    }
    if (action !== "approve" && action !== "reject") {
      return res.status(400).json({ status: false, message: "Aksi tidak valid." });
    }
    if (action === "reject" && (!admin_notes || !String(admin_notes).trim())) {
      return res.status(400).json({ status: false, message: "Alasan penolakan wajib diisi." });
    }

    const model = prisma[MODEL_MAP[type]];
    const request = await model.findUnique({ where: { id } });
    if (!request) {
      return res.status(404).json({ status: false, message: "Data pengajuan tidak ditemukan" });
    }
    if (request.status !== "PENDING") {
      return res.status(400).json({ status: false, message: "Pengajuan ini sudah diproses." });
    }

    try {
      if (action === "approve") {
        if (type === "leave") {
          await approveLeave(request, admin_notes, req.user.userId);
        } else if (type === "correction") {
          await approveCorrection(request, admin_notes);
        } else if (type === "loan") {
          await prisma.employee_loans.update({
            where: { id },
            data: {
              status: "APPROVED_ACTIVE",
              remaining_balance: request.total_amount,
              approved_by: req.user.userId,
              approved_at: new Date(),
              admin_notes: admin_notes || null,
            },
          });
        }
      }

      const updated = await model.update({
        where: { id },
        data:
          action === "approve"
            ? { status: type === "loan" ? "APPROVED_ACTIVE" : "APPROVED", approved_by: req.user.userId, approved_at: new Date(), admin_notes: admin_notes || null }
            : { status: "REJECTED", approved_by: req.user.userId, approved_at: new Date(), admin_notes: String(admin_notes).trim() },
      });

      createLog({
        id_toko: request.store_id,
        id_user: req.user?.userId,
        aksi: action === "approve" ? "APPROVE_HR_REQUEST" : "REJECT_HR_REQUEST",
        keterangan: `${action === "approve" ? "Menyetujui" : "Menolak"} pengajuan ${type} #${id} user #${request.user_id}`,
      });

      return res.status(200).json({
        status: true,
        message: action === "approve" ? "Pengajuan berhasil disetujui." : "Pengajuan berhasil ditolak.",
        data: serializeRequest(req, updated),
      });
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({ status: false, message: error.message });
      }
      throw error;
    }
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

