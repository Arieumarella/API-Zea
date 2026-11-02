const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const { createLog } = require("../utils/logHelper");
const { calculatePayrollForEmployee, round2 } = require("../utils/payrollCalculator");
const { serializeDecimalFields, serializePayslip } = require("../utils/hrSerialize");
const { getStoreNameMap } = require("../utils/hrShared");
const { dateString } = require("../utils/hrTime");

function isValidDateString(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function dateStart(value) {
  return new Date(`${value}T00:00:00Z`);
}

function dateEnd(value) {
  return new Date(`${value}T23:59:59Z`);
}

exports.generate = async (req, res) => {
  try {
    const { store_id, period_name, cutoff_start_date, cutoff_end_date } = req.body;
    if (!isValidDateString(cutoff_start_date) || !isValidDateString(cutoff_end_date)) {
      return res.status(400).json({ status: false, message: "Format tanggal periode tidak valid." });
    }
    if (new Date(cutoff_end_date) < new Date(cutoff_start_date)) {
      return res.status(400).json({ status: false, message: "Tanggal akhir periode tidak boleh sebelum tanggal awal." });
    }
    if (!period_name || !String(period_name).trim()) {
      return res.status(400).json({ status: false, message: "Nama periode wajib diisi." });
    }

    const targetStoreId =
      store_id !== undefined && store_id !== null && store_id !== ""
        ? parseInt(store_id, 10)
        : null;

    if (targetStoreId !== null) {
      const store = await prisma.t_toko.findUnique({ where: { id: targetStoreId } });
      if (!store) {
        return res.status(404).json({ status: false, message: "Toko tidak ditemukan" });
      }
    }

    const profileWhere = { is_active: true };
    if (targetStoreId !== null) {
      profileWhere.store_id = targetStoreId;
    }

    const profiles = await prisma.employee_profiles.findMany({
      where: profileWhere,
      orderBy: { id: "asc" },
    });
    if (profiles.length === 0) {
      return res.status(400).json({
        status: false,
        message: "Tidak ada pegawai aktif pada cakupan yang dipilih.",
      });
    }

    const storeIds = [...new Set(profiles.map((profile) => profile.store_id))];
    const configs = await prisma.store_hr_configs.findMany({
      where: { store_id: { in: storeIds } },
    });
    const configMap = {};
    configs.forEach((config) => {
      configMap[config.store_id] = config;
    });
    const storeMap = await getStoreNameMap(storeIds);

    const missingConfigStores = storeIds.filter(
      (storeId) => !configMap[storeId]
    );
    if (missingConfigStores.length > 0) {
      const names = missingConfigStores
        .map((storeId) => storeMap[storeId] || `Toko #${storeId}`)
        .join(", ");
      return res.status(400).json({
        status: false,
        message: `Konfigurasi HR belum diatur untuk: ${names}.`,
      });
    }

    const duplicate = await prisma.payrolls.findFirst({
      where: {
        store_id: targetStoreId,
        cutoff_start_date: {
          gte: dateStart(cutoff_start_date),
          lte: dateEnd(cutoff_start_date),
        },
        cutoff_end_date: {
          gte: dateStart(cutoff_end_date),
          lte: dateEnd(cutoff_end_date),
        },
      },
    });
    if (duplicate) {
      return res.status(400).json({
        status: false,
        message: `Payroll dengan periode tersebut sudah ada (status ${duplicate.status}).`,
      });
    }

    const userIds = profiles.map((profile) => profile.user_id);

    const [pendingLeave, pendingOvertime, pendingCorrection, pendingLoan] =
      await Promise.all([
        prisma.leave_requests.count({
          where: {
            status: "PENDING",
            user_id: { in: userIds },
            start_date: { lte: dateEnd(cutoff_end_date) },
            end_date: { gte: dateStart(cutoff_start_date) },
          },
        }),
        prisma.overtime_requests.count({
          where: {
            status: "PENDING",
            user_id: { in: userIds },
            overtime_date: {
              gte: dateStart(cutoff_start_date),
              lte: dateEnd(cutoff_end_date),
            },
          },
        }),
        prisma.attendance_corrections.count({
          where: {
            status: "PENDING",
            user_id: { in: userIds },
            attendance_date: {
              gte: dateStart(cutoff_start_date),
              lte: dateEnd(cutoff_end_date),
            },
          },
        }),
        prisma.employee_loans.count({
          where: { status: "PENDING", user_id: { in: userIds } },
        }),
      ]);

    if (pendingLeave + pendingOvertime + pendingCorrection + pendingLoan > 0) {
      return res.status(409).json({
        status: false,
        blocked: true,
        message:
          "Masih ada pengajuan yang belum diproses pada periode ini. Selesaikan di Pusat Approval terlebih dahulu.",
        details: {
          leave: pendingLeave,
          overtime: pendingOvertime,
          correction: pendingCorrection,
          loan: pendingLoan,
        },
      });
    }

    const users = await prisma.t_user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, username: true, nama: true },
    });
    const userMap = {};
    users.forEach((user) => {
      userMap[user.id] = user;
    });

    const payslipRows = [];
    let totalGross = 0;
    let totalDeduction = 0;
    let totalNet = 0;

    for (const profile of profiles) {
      const config = configMap[profile.store_id];
      const [attendances, overtime, loans, holidays] = await Promise.all([
        prisma.attendances.findMany({
          where: {
            user_id: profile.user_id,
            attendance_date: {
              gte: dateStart(cutoff_start_date),
              lte: dateEnd(cutoff_end_date),
            },
          },
        }),
        prisma.overtime_requests.findMany({
          where: {
            user_id: profile.user_id,
            status: "APPROVED",
            overtime_date: {
              gte: dateStart(cutoff_start_date),
              lte: dateEnd(cutoff_end_date),
            },
          },
        }),
        prisma.employee_loans.findMany({
          where: {
            user_id: profile.user_id,
            status: "APPROVED_ACTIVE",
            remaining_balance: { gt: 0 },
          },
          orderBy: [{ loan_date: "asc" }, { id: "asc" }],
        }),
        prisma.holidays.findMany({
          where: {
            store_id: profile.store_id,
            holiday_date: {
              gte: dateStart(cutoff_start_date),
              lte: dateEnd(cutoff_end_date),
            },
          },
        }),
      ]);

      const calculation = calculatePayrollForEmployee({
        profile: {
          base_salary: Number(profile.base_salary),
          fixed_meal_allowance: Number(profile.fixed_meal_allowance),
          fixed_transport_allowance: Number(profile.fixed_transport_allowance),
          overtime_rate_per_hour: Number(profile.overtime_rate_per_hour),
        },
        config: {
          work_days: config.work_days,
          late_penalty_per_occurrence: Number(config.late_penalty_per_occurrence),
          missing_checkout_penalty: Number(config.missing_checkout_penalty),
        },
        periodStart: cutoff_start_date,
        periodEnd: cutoff_end_date,
        attendanceRows: attendances,
        overtimeRows: overtime,
        loans,
        holidays: holidays.map((holiday) => dateString(holiday.holiday_date)),
      });

      const user = userMap[profile.user_id] || {};

      payslipRows.push({
        user_id: profile.user_id,
        store_id: profile.store_id,
        store_name_snapshot: storeMap[profile.store_id] || null,
        employee_code_snapshot: profile.employee_code,
        employee_name_snapshot: user.nama || user.username || null,
        position_snapshot: profile.position,
        bank_account_snapshot: profile.bank_account,
        bank_name_snapshot: profile.bank_name,
        period_start: dateStart(cutoff_start_date),
        period_end: dateEnd(cutoff_end_date),
        base_salary: Number(profile.base_salary),
        fixed_meal_allowance: Number(profile.fixed_meal_allowance),
        fixed_transport_allowance: Number(profile.fixed_transport_allowance),
        overtime_rate_per_hour: Number(profile.overtime_rate_per_hour),
        total_working_days: calculation.totalWorkingDays,
        total_present_days: calculation.totalPresentDays,
        total_late_count: calculation.totalLateCount,
        total_absent_days: calculation.totalAbsentDays,
        total_unpaid_leave_days: calculation.totalUnpaidLeaveDays,
        total_missing_checkout_count: calculation.totalMissingCheckoutCount,
        total_overtime_hours: calculation.totalOvertimeHours,
        meal_allowance_amount: calculation.mealAllowanceAmount,
        transport_allowance_amount: calculation.transportAllowanceAmount,
        overtime_pay: calculation.overtimePay,
        late_deduction_amount: calculation.lateDeductionAmount,
        absence_deduction_amount: calculation.absenceDeductionAmount,
        unpaid_leave_deduction_amount: calculation.unpaidLeaveDeductionAmount,
        missing_checkout_deduction_amount: calculation.missingCheckoutDeductionAmount,
        loan_deduction_amount: calculation.loanDeductionAmount,
        other_deduction_amount: calculation.otherDeductionAmount,
        bonus_amount: calculation.bonusAmount,
        gross_salary: calculation.grossSalary,
        total_deduction: calculation.totalDeduction,
        net_salary: calculation.netSalary,
        loan_breakdown: calculation.loanBreakdown,
      });

      totalGross = round2(totalGross + calculation.grossSalary);
      totalDeduction = round2(totalDeduction + calculation.totalDeduction);
      totalNet = round2(totalNet + calculation.netSalary);
    }

    const payroll = await prisma.$transaction(async (tx) => {
      const created = await tx.payrolls.create({
        data: {
          store_id: targetStoreId,
          period_name: String(period_name).trim(),
          cutoff_start_date: dateStart(cutoff_start_date),
          cutoff_end_date: dateEnd(cutoff_end_date),
          status: "DRAFT",
          total_employees: payslipRows.length,
          total_gross: totalGross,
          total_deduction: totalDeduction,
          total_net: totalNet,
          generated_by: req.user.userId,
        },
      });

      await tx.payslips.createMany({
        data: payslipRows.map((row) => ({ ...row, payroll_id: created.id })),
      });

      return created;
    });

    createLog({
      id_toko: targetStoreId || req.id_toko || 1,
      id_user: req.user?.userId,
      aksi: "GENERATE_HR_PAYROLL",
      keterangan: `Generate payroll draft #${payroll.id} '${period_name}' (${cutoff_start_date} s/d ${cutoff_end_date}) untuk ${payslipRows.length} pegawai`,
    });

    return res.status(201).json({
      status: true,
      message: "Payroll draft berhasil dibuat.",
      data: {
        id: payroll.id,
        total_employees: payroll.total_employees,
        total_gross: totalGross,
        total_deduction: totalDeduction,
        total_net: totalNet,
      },
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

exports.listPayrolls = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const take = parseInt(req.query.take) || 10;
    const skip = (page - 1) * take;
    const status = req.query.status || null;
    const where = {};
    if (status) where.status = status;

    const [payrolls, total] = await Promise.all([
      prisma.payrolls.findMany({
        where,
        skip,
        take,
        orderBy: { id: "desc" },
      }),
      prisma.payrolls.count({ where }),
    ]);

    const storeIds = payrolls.map((payroll) => payroll.store_id).filter(Boolean);
    const storeMap = await getStoreNameMap([...new Set(storeIds)]);

    const data = payrolls.map((payroll) => ({
      ...serializeDecimalFields(payroll),
      nama_toko: payroll.store_id ? storeMap[payroll.store_id] || `Toko #${payroll.store_id}` : "Semua Toko",
      cutoff_start: dateString(payroll.cutoff_start_date),
      cutoff_end: dateString(payroll.cutoff_end_date),
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

exports.getPayroll = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const payroll = await prisma.payrolls.findUnique({ where: { id } });
    if (!payroll) {
      return res.status(404).json({ status: false, message: "Payroll tidak ditemukan" });
    }

    const payslips = await prisma.payslips.findMany({
      where: { payroll_id: id },
      orderBy: { id: "asc" },
    });

    const userIds = payslips.map((payslip) => payslip.user_id);
    const users = await prisma.t_user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, username: true, nama: true },
    });
    const userMap = {};
    users.forEach((user) => {
      userMap[user.id] = user;
    });

    const storeIds = payroll.store_id
      ? [payroll.store_id]
      : [...new Set(payslips.map((payslip) => payslip.store_id))];
    const storeMap = await getStoreNameMap(storeIds);

    return res.status(200).json({
      status: true,
      data: {
        ...serializeDecimalFields(payroll),
        nama_toko: payroll.store_id ? storeMap[payroll.store_id] || `Toko #${payroll.store_id}` : "Semua Toko",
        cutoff_start: dateString(payroll.cutoff_start_date),
        cutoff_end: dateString(payroll.cutoff_end_date),
        payslips: payslips.map((payslip) => ({
          ...serializePayslip(payslip),
          user: userMap[payslip.user_id] || null,
          nama_toko: storeMap[payslip.store_id] || payslip.store_name_snapshot || null,
        })),
      },
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

exports.updatePayslip = async (req, res) => {
  try {
    const payrollId = parseInt(req.params.id, 10);
    const payslipId = parseInt(req.params.payslipId, 10);

    const payroll = await prisma.payrolls.findUnique({ where: { id: payrollId } });
    if (!payroll) {
      return res.status(404).json({ status: false, message: "Payroll tidak ditemukan" });
    }
    if (payroll.status !== "DRAFT") {
      return res.status(400).json({ status: false, message: "Payroll yang sudah difinalisasi tidak bisa diedit." });
    }
    const payslip = await prisma.payslips.findUnique({ where: { id: payslipId } });
    if (!payslip || payslip.payroll_id !== payrollId) {
      return res.status(404).json({ status: false, message: "Slip gaji tidak ditemukan" });
    }

    const { bonus_amount, other_deduction_amount } = req.body;
    const data = {};
    if (bonus_amount !== undefined) {
      const bonus = Number(bonus_amount);
      if (Number.isNaN(bonus) || bonus < 0) {
        return res.status(400).json({ status: false, message: "Bonus tidak boleh negatif." });
      }
      data.bonus_amount = bonus;
    }
    if (other_deduction_amount !== undefined) {
      const other = Number(other_deduction_amount);
      if (Number.isNaN(other) || other < 0) {
        return res.status(400).json({ status: false, message: "Potongan lain tidak boleh negatif." });
      }
      data.other_deduction_amount = other;
    }

    const bonus = data.bonus_amount !== undefined ? data.bonus_amount : Number(payslip.bonus_amount);
    const other = data.other_deduction_amount !== undefined ? data.other_deduction_amount : Number(payslip.other_deduction_amount);

    const gross = round2(
      Number(payslip.base_salary) +
        Number(payslip.meal_allowance_amount) +
        Number(payslip.transport_allowance_amount) +
        Number(payslip.overtime_pay) +
        bonus
    );
    const totalDeduction = round2(
      Number(payslip.late_deduction_amount) +
        Number(payslip.absence_deduction_amount) +
        Number(payslip.unpaid_leave_deduction_amount) +
        Number(payslip.missing_checkout_deduction_amount) +
        Number(payslip.loan_deduction_amount) +
        other
    );
    const net = round2(gross - totalDeduction);

    const updated = await prisma.payslips.update({
      where: { id: payslipId },
      data: {
        ...data,
        gross_salary: gross,
        total_deduction: totalDeduction,
        net_salary: net,
      },
    });

    const [totals] = await prisma.$queryRawUnsafe(
      `SELECT COALESCE(SUM(gross_salary), 0) AS gross, COALESCE(SUM(total_deduction), 0) AS deduction, COALESCE(SUM(net_salary), 0) AS net FROM payslips WHERE payroll_id = ${payrollId}`
    );
    await prisma.payrolls.update({
      where: { id: payrollId },
      data: {
        total_gross: round2(Number(totals.gross)),
        total_deduction: round2(Number(totals.deduction)),
        total_net: round2(Number(totals.net)),
      },
    });

    return res.status(200).json({
      status: true,
      message: "Slip gaji berhasil diperbarui.",
      data: serializePayslip(updated),
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

exports.finalize = async (req, res) => {
  try {
    const payrollId = parseInt(req.params.id, 10);
    const payroll = await prisma.payrolls.findUnique({ where: { id: payrollId } });
    if (!payroll) {
      return res.status(404).json({ status: false, message: "Payroll tidak ditemukan" });
    }
    if (payroll.status === "FINAL") {
      return res.status(400).json({ status: false, message: "Payroll sudah difinalisasi." });
    }

    const payslips = await prisma.payslips.findMany({
      where: { payroll_id: payrollId },
    });

    const loanUpdates = [];
    payslips.forEach((payslip) => {
      let breakdown = payslip.loan_breakdown;
      if (typeof breakdown === "string") {
        try {
          breakdown = JSON.parse(breakdown);
        } catch (error) {
          breakdown = [];
        }
      }
      (Array.isArray(breakdown) ? breakdown : []).forEach((item) => {
        if (item && item.loan_id && Number(item.amount) > 0) {
          loanUpdates.push({
            loan_id: Number(item.loan_id),
            amount: Number(item.amount),
          });
        }
      });
    });

    await prisma.$transaction(async (tx) => {
      for (const update of loanUpdates) {
        const loan = await tx.employee_loans.findUnique({
          where: { id: update.loan_id },
        });
        if (!loan || loan.status !== "APPROVED_ACTIVE") continue;
        const remaining = round2(
          Math.max(0, Number(loan.remaining_balance) - update.amount)
        );
        await tx.employee_loans.update({
          where: { id: loan.id },
          data: {
            remaining_balance: remaining,
            status: remaining <= 0.005 ? "PAID_OFF" : "APPROVED_ACTIVE",
          },
        });
      }

      const [totals] = await tx.$queryRawUnsafe(
        `SELECT COALESCE(SUM(gross_salary), 0) AS gross, COALESCE(SUM(total_deduction), 0) AS deduction, COALESCE(SUM(net_salary), 0) AS net FROM payslips WHERE payroll_id = ${payrollId}`
      );

      await tx.payrolls.update({
        where: { id: payrollId },
        data: {
          status: "FINAL",
          finalized_at: new Date(),
          total_gross: round2(Number(totals.gross)),
          total_deduction: round2(Number(totals.deduction)),
          total_net: round2(Number(totals.net)),
        },
      });
    });

    createLog({
      id_toko: payroll.store_id || req.id_toko || 1,
      id_user: req.user?.userId,
      aksi: "FINALIZE_HR_PAYROLL",
      keterangan: `Finalisasi payroll #${payrollId} '${payroll.period_name}'`,
    });

    return res.status(200).json({
      status: true,
      message: "Payroll berhasil difinalisasi.",
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

exports.deletePayroll = async (req, res) => {
  try {
    const payrollId = parseInt(req.params.id, 10);
    const payroll = await prisma.payrolls.findUnique({ where: { id: payrollId } });
    if (!payroll) {
      return res.status(404).json({ status: false, message: "Payroll tidak ditemukan" });
    }
    if (payroll.status !== "DRAFT") {
      return res.status(400).json({ status: false, message: "Hanya payroll draft yang bisa dihapus." });
    }

    await prisma.$transaction([
      prisma.payslips.deleteMany({ where: { payroll_id: payrollId } }),
      prisma.payrolls.delete({ where: { id: payrollId } }),
    ]);

    createLog({
      id_toko: payroll.store_id || req.id_toko || 1,
      id_user: req.user?.userId,
      aksi: "HAPUS_HR_PAYROLL",
      keterangan: `Menghapus payroll draft #${payrollId} '${payroll.period_name}'`,
    });

    return res.status(200).json({
      status: true,
      message: "Payroll draft berhasil dihapus.",
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

exports.myPayslips = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const take = parseInt(req.query.take) || 10;
    const skip = (page - 1) * take;

    const where = { user_id: req.employee.user_id };
    const [payslips, total] = await Promise.all([
      prisma.payslips.findMany({ where, skip, take, orderBy: { id: "desc" } }),
      prisma.payslips.count({ where }),
    ]);

    const payrollIds = payslips.map((payslip) => payslip.payroll_id);
    const payrolls = await prisma.payrolls.findMany({
      where: { id: { in: payrollIds }, status: "FINAL" },
      select: { id: true, period_name: true, cutoff_start_date: true, cutoff_end_date: true, finalized_at: true, status: true },
    });
    const payrollMap = {};
    payrolls.forEach((payroll) => {
      payrollMap[payroll.id] = payroll;
    });

    const visible = payslips
      .filter((payslip) => payrollMap[payslip.payroll_id])
      .map((payslip) => {
        const payroll = payrollMap[payslip.payroll_id];
        return {
          ...serializePayslip(payslip),
          payroll: payroll,
          period_start: dateString(payslip.period_start),
          period_end: dateString(payslip.period_end),
        };
      });

    return res.status(200).json({
      status: true,
      data: visible,
      page,
      total,
      totalPages: Math.ceil(total / take),
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

