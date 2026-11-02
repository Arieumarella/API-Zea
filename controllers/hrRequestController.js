const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const { saveAttachment } = require("../utils/attachmentUpload");
const { minutesBetweenInclusive } = require("../utils/hrTime");
const { serializeDecimalFields, photoUrl } = require("../utils/hrSerialize");

const LEAVE_TYPES = ["SICK", "ANNUAL_LEAVE", "UNPAID_LEAVE", "FIELD_DUTY"];
const CORRECTION_TYPES = ["LATE_DISPENSATION", "MISSING_CHECKOUT"];

function isValidDateString(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isValidTimeString(value) {
  return typeof value === "string" && /^\d{1,2}:\d{2}$/.test(value.trim());
}

function paginationFromQuery(req) {
  const page = parseInt(req.query.page) || 1;
  const take = parseInt(req.query.take) || 10;
  return { page, take, skip: (page - 1) * take };
}

function serializeRequest(req, row) {
  const serialized = serializeDecimalFields(row);
  serialized.attachment_url = photoUrl(req, row.attachment);
  return serialized;
}

exports.createLeaveRequest = async (req, res) => {
  try {
    const { type, start_date, end_date, reason } = req.body;
    if (!LEAVE_TYPES.includes(type)) {
      return res.status(400).json({ status: false, message: "Jenis cuti tidak valid." });
    }
    if (!isValidDateString(start_date) || !isValidDateString(end_date)) {
      return res.status(400).json({ status: false, message: "Format tanggal tidak valid." });
    }
    if (new Date(end_date) < new Date(start_date)) {
      return res.status(400).json({ status: false, message: "Tanggal selesai tidak boleh sebelum tanggal mulai." });
    }
    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ status: false, message: "Alasan wajib diisi." });
    }
    if (type === "SICK" && !req.file) {
      return res.status(400).json({
        status: false,
        message: "Surat keterangan sakit wajib dilampirkan.",
      });
    }

    const attachmentPath = req.file
      ? await saveAttachment(req.file.buffer, req.file.originalname, req.employee.user_id)
      : null;

    const request = await prisma.leave_requests.create({
      data: {
        user_id: req.employee.user_id,
        store_id: req.employee.store_id,
        type,
        start_date: new Date(`${start_date}T00:00:00Z`),
        end_date: new Date(`${end_date}T00:00:00Z`),
        reason: String(reason).trim(),
        attachment: attachmentPath,
        status: "PENDING",
      },
    });

    return res.status(201).json({
      status: true,
      message: "Pengajuan cuti berhasil dikirim.",
      data: serializeRequest(req, request),
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

exports.listMyLeaveRequests = async (req, res) => {
  try {
    const { page, take, skip } = paginationFromQuery(req);
    const status = req.query.status || null;
    const where = { user_id: req.employee.user_id };
    if (status) where.status = status;

    const [rows, total] = await Promise.all([
      prisma.leave_requests.findMany({
        where,
        skip,
        take,
        orderBy: { id: "desc" },
      }),
      prisma.leave_requests.count({ where }),
    ]);

    return res.status(200).json({
      status: true,
      data: rows.map((row) => serializeRequest(req, row)),
      page,
      total,
      totalPages: Math.ceil(total / take),
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

exports.createOvertimeRequest = async (req, res) => {
  try {
    const { overtime_date, start_time, end_time, reason } = req.body;
    if (!isValidDateString(overtime_date)) {
      return res.status(400).json({ status: false, message: "Format tanggal lembur tidak valid." });
    }
    if (!isValidTimeString(start_time) || !isValidTimeString(end_time)) {
      return res.status(400).json({ status: false, message: "Format jam lembur tidak valid (HH:mm)." });
    }
    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ status: false, message: "Alasan lembur wajib diisi." });
    }
    const minutes = minutesBetweenInclusive(start_time.trim(), end_time.trim());
    if (minutes <= 0) {
      return res.status(400).json({ status: false, message: "Jam selesai harus setelah jam mulai." });
    }
    const durationHours = Math.round((minutes / 60) * 100) / 100;

    const request = await prisma.overtime_requests.create({
      data: {
        user_id: req.employee.user_id,
        store_id: req.employee.store_id,
        overtime_date: new Date(`${overtime_date}T00:00:00Z`),
        start_time: start_time.trim(),
        end_time: end_time.trim(),
        duration_hours: durationHours,
        reason: String(reason).trim(),
        status: "PENDING",
      },
    });

    return res.status(201).json({
      status: true,
      message: "Pengajuan lembur berhasil dikirim.",
      data: serializeDecimalFields(request),
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

exports.listMyOvertimeRequests = async (req, res) => {
  try {
    const { page, take, skip } = paginationFromQuery(req);
    const status = req.query.status || null;
    const where = { user_id: req.employee.user_id };
    if (status) where.status = status;

    const [rows, total] = await Promise.all([
      prisma.overtime_requests.findMany({
        where,
        skip,
        take,
        orderBy: { id: "desc" },
      }),
      prisma.overtime_requests.count({ where }),
    ]);

    return res.status(200).json({
      status: true,
      data: rows.map((row) => serializeDecimalFields(row)),
      page,
      total,
      totalPages: Math.ceil(total / take),
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

exports.createCorrectionRequest = async (req, res) => {
  try {
    const { attendance_date, correction_type, requested_check_in_time, requested_check_out_time, reason } = req.body;
    if (!isValidDateString(attendance_date)) {
      return res.status(400).json({ status: false, message: "Format tanggal absensi tidak valid." });
    }
    if (!CORRECTION_TYPES.includes(correction_type)) {
      return res.status(400).json({ status: false, message: "Jenis koreksi tidak valid." });
    }
    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ status: false, message: "Alasan koreksi wajib diisi." });
    }
    if (correction_type === "LATE_DISPENSATION" && !isValidTimeString(requested_check_in_time)) {
      return res.status(400).json({
        status: false,
        message: "Jam masuk yang diajukan wajib diisi (HH:mm).",
      });
    }
    if (correction_type === "MISSING_CHECKOUT" && !isValidTimeString(requested_check_out_time)) {
      return res.status(400).json({
        status: false,
        message: "Jam pulang yang diajukan wajib diisi (HH:mm).",
      });
    }

    const existingAttendance = await prisma.attendances.findFirst({
      where: {
        user_id: req.employee.user_id,
        attendance_date: {
          gte: new Date(`${attendance_date}T00:00:00Z`),
          lte: new Date(`${attendance_date}T23:59:59Z`),
        },
      },
    });

    const attachmentPath = req.file
      ? await saveAttachment(req.file.buffer, req.file.originalname, req.employee.user_id)
      : null;

    const request = await prisma.attendance_corrections.create({
      data: {
        user_id: req.employee.user_id,
        store_id: req.employee.store_id,
        attendance_date: new Date(`${attendance_date}T00:00:00Z`),
        correction_type,
        requested_check_in_time: requested_check_in_time ? requested_check_in_time.trim() : null,
        requested_check_out_time: requested_check_out_time ? requested_check_out_time.trim() : null,
        reason: String(reason).trim(),
        attachment: attachmentPath,
        status: "PENDING",
      },
    });

    return res.status(201).json({
      status: true,
      message: existingAttendance
        ? "Pengajuan koreksi absensi berhasil dikirim."
        : "Pengajuan dikirim, namun tidak ada absensi pada tanggal tersebut. Admin dapat menolak atau membuat koreksi manual.",
      data: serializeRequest(req, request),
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

exports.listMyCorrectionRequests = async (req, res) => {
  try {
    const { page, take, skip } = paginationFromQuery(req);
    const status = req.query.status || null;
    const where = { user_id: req.employee.user_id };
    if (status) where.status = status;

    const [rows, total] = await Promise.all([
      prisma.attendance_corrections.findMany({
        where,
        skip,
        take,
        orderBy: { id: "desc" },
      }),
      prisma.attendance_corrections.count({ where }),
    ]);

    return res.status(200).json({
      status: true,
      data: rows.map((row) => serializeRequest(req, row)),
      page,
      total,
      totalPages: Math.ceil(total / take),
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

exports.createLoanRequest = async (req, res) => {
  try {
    const { total_amount, monthly_installment, loan_date, reason } = req.body;
    if (!isValidDateString(loan_date)) {
      return res.status(400).json({ status: false, message: "Format tanggal kasbon tidak valid." });
    }
    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ status: false, message: "Alasan kasbon wajib diisi." });
    }
    const total = Number(total_amount);
    const installment = Number(monthly_installment);
    if (Number.isNaN(total) || total <= 0) {
      return res.status(400).json({ status: false, message: "Jumlah kasbon harus lebih dari 0." });
    }
    if (Number.isNaN(installment) || installment <= 0 || installment > total) {
      return res.status(400).json({
        status: false,
        message: "Cicilan bulanan harus lebih dari 0 dan tidak melebihi jumlah kasbon.",
      });
    }

    const pendingLoan = await prisma.employee_loans.findFirst({
      where: { user_id: req.employee.user_id, status: "PENDING" },
    });
    if (pendingLoan) {
      return res.status(400).json({
        status: false,
        message: "Masih ada pengajuan kasbon yang menunggu persetujuan.",
      });
    }

    const loan = await prisma.employee_loans.create({
      data: {
        user_id: req.employee.user_id,
        store_id: req.employee.store_id,
        total_amount: total,
        monthly_installment: installment,
        remaining_balance: 0,
        loan_date: new Date(`${loan_date}T00:00:00Z`),
        reason: String(reason).trim(),
        status: "PENDING",
      },
    });

    return res.status(201).json({
      status: true,
      message: "Pengajuan kasbon berhasil dikirim.",
      data: serializeDecimalFields(loan),
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

exports.listMyLoans = async (req, res) => {
  try {
    const { page, take, skip } = paginationFromQuery(req);
    const status = req.query.status || null;
    const where = { user_id: req.employee.user_id };
    if (status) where.status = status;

    const [rows, total] = await Promise.all([
      prisma.employee_loans.findMany({
        where,
        skip,
        take,
        orderBy: { id: "desc" },
      }),
      prisma.employee_loans.count({ where }),
    ]);

    return res.status(200).json({
      status: true,
      data: rows.map((row) => serializeDecimalFields(row)),
      page,
      total,
      totalPages: Math.ceil(total / take),
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};


