const { listWorkDates } = require("./hrTime");

function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

const PAID_LEAVE_STATUSES = ["SICK", "ANNUAL_LEAVE", "FIELD_DUTY"];
const PRESENT_STATUSES = ["PRESENT", "LATE"];

function calculatePayrollForEmployee({
  profile,
  config,
  periodStart,
  periodEnd,
  attendanceRows = [],
  overtimeRows = [],
  loans = [],
  holidays = [],
}) {
  const workDates = listWorkDates(
    periodStart,
    periodEnd,
    config.work_days,
    holidays
  );
  const totalWorkingDays = workDates.length;

  const presentCount = attendanceRows.filter((row) =>
    PRESENT_STATUSES.includes(row.status)
  ).length;
  const paidLeaveCount = attendanceRows.filter((row) =>
    PAID_LEAVE_STATUSES.includes(row.status)
  ).length;
  const unpaidLeaveCount = attendanceRows.filter(
    (row) => row.status === "UNPAID_LEAVE"
  ).length;
  const lateCount = attendanceRows.filter(
    (row) => row.status === "LATE"
  ).length;
  const missingCheckoutCount = attendanceRows.filter(
    (row) =>
      PRESENT_STATUSES.includes(row.status) &&
      row.check_in_time &&
      !row.check_out_time
  ).length;

  const absentDays = Math.max(
    0,
    totalWorkingDays - presentCount - paidLeaveCount - unpaidLeaveCount
  );
  const dailyRate =
    totalWorkingDays > 0 ? Number(profile.base_salary) / totalWorkingDays : 0;

  const mealAllowanceAmount = round2(
    presentCount * Number(profile.fixed_meal_allowance)
  );
  const transportAllowanceAmount = round2(
    presentCount * Number(profile.fixed_transport_allowance)
  );
  const absenceDeductionAmount = round2(absentDays * dailyRate);
  const unpaidLeaveDeductionAmount = round2(unpaidLeaveCount * dailyRate);
  const lateDeductionAmount = round2(
    lateCount * Number(config.late_penalty_per_occurrence)
  );
  const missingCheckoutDeductionAmount = round2(
    missingCheckoutCount * Number(config.missing_checkout_penalty)
  );
  const totalOvertimeHours = round2(
    overtimeRows.reduce(
      (sum, row) => sum + Number(row.duration_hours || 0),
      0
    )
  );
  const overtimePay = round2(
    totalOvertimeHours * Number(profile.overtime_rate_per_hour)
  );

  const loanBreakdown = [];
  let loanDeductionAmount = 0;
  loans.forEach((loan) => {
    const remaining = Number(loan.remaining_balance || 0);
    if (remaining <= 0) return;
    const amount = Math.min(
      remaining,
      Number(loan.monthly_installment || 0)
    );
    if (amount > 0) {
      loanDeductionAmount = round2(loanDeductionAmount + amount);
      loanBreakdown.push({ loan_id: loan.id, amount: round2(amount) });
    }
  });

  const bonusAmount = 0;
  const otherDeductionAmount = 0;

  const grossSalary = round2(
    Number(profile.base_salary) +
      mealAllowanceAmount +
      transportAllowanceAmount +
      overtimePay +
      bonusAmount
  );
  const totalDeduction = round2(
    lateDeductionAmount +
      absenceDeductionAmount +
      unpaidLeaveDeductionAmount +
      missingCheckoutDeductionAmount +
      loanDeductionAmount +
      otherDeductionAmount
  );
  const netSalary = round2(grossSalary - totalDeduction);

  return {
    totalWorkingDays,
    totalPresentDays: presentCount,
    totalLateCount: lateCount,
    totalAbsentDays: absentDays,
    totalUnpaidLeaveDays: unpaidLeaveCount,
    totalMissingCheckoutCount: missingCheckoutCount,
    totalOvertimeHours,
    mealAllowanceAmount,
    transportAllowanceAmount,
    overtimePay,
    lateDeductionAmount,
    absenceDeductionAmount,
    unpaidLeaveDeductionAmount,
    missingCheckoutDeductionAmount,
    loanDeductionAmount,
    otherDeductionAmount,
    bonusAmount,
    grossSalary,
    totalDeduction,
    netSalary,
    loanBreakdown,
  };
}

module.exports = { calculatePayrollForEmployee, round2 };
