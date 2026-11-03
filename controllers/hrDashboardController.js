const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const { nowJakarta } = require("../utils/hrTime");

exports.summary = async (req, res) => {
  try {
    const today = nowJakarta().format("YYYY-MM-DD");
    const dayStart = new Date(`${today}T00:00:00Z`);
    const dayEnd = new Date(`${today}T23:59:59Z`);

    const [
      activeEmployees,
      totalEmployees,
      todayRows,
      pendingLeave,
      pendingOvertime,
      pendingCorrection,
      pendingLoan,
      draftPayrolls,
      finalPayrolls,
    ] = await Promise.all([
      prisma.employee_profiles.count({ where: { is_active: true } }),
      prisma.employee_profiles.count(),
      prisma.attendances.findMany({
        where: { attendance_date: { gte: dayStart, lte: dayEnd } },
        select: { status: true },
      }),
      prisma.leave_requests.count({ where: { status: "PENDING" } }),
      prisma.overtime_requests.count({ where: { status: "PENDING" } }),
      prisma.attendance_corrections.count({ where: { status: "PENDING" } }),
      prisma.employee_loans.count({ where: { status: "PENDING" } }),
      prisma.payrolls.count({ where: { status: "DRAFT" } }),
      prisma.payrolls.count({ where: { status: "FINAL" } }),
    ]);

    const presentToday = todayRows.filter((row) => row.status === "PRESENT").length;
    const lateToday = todayRows.filter((row) => row.status === "LATE").length;
    const onLeaveToday = todayRows.filter((row) =>
      ["SICK", "ANNUAL_LEAVE", "UNPAID_LEAVE", "FIELD_DUTY"].includes(row.status)
    ).length;
    const alphaToday = todayRows.filter((row) => row.status === "ALPHA").length;

    return res.status(200).json({
      status: true,
      data: {
        today,
        active_employees: activeEmployees,
        total_employees: totalEmployees,
        present_today: presentToday + lateToday,
        late_today: lateToday,
        on_leave_today: onLeaveToday,
        alpha_today: alphaToday,
        pending: {
          leave: pendingLeave,
          overtime: pendingOvertime,
          correction: pendingCorrection,
          loan: pendingLoan,
          total: pendingLeave + pendingOvertime + pendingCorrection + pendingLoan,
        },
        payrolls: {
          draft: draftPayrolls,
          final: finalPayrolls,
        },
      },
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};
