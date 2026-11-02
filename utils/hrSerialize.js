function toNumber(value) {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function photoUrl(req, relativePath) {
  if (!relativePath) return null;
  const protocol = req.protocol;
  const host = req.get("host");
  return `${protocol}://${host}/uploads/${relativePath}`;
}

const MONEY_FIELDS = [
  "base_salary",
  "fixed_meal_allowance",
  "fixed_transport_allowance",
  "overtime_rate_per_hour",
  "late_penalty_per_occurrence",
  "missing_checkout_penalty",
  "latitude",
  "longitude",
  "check_in_latitude",
  "check_in_longitude",
  "check_in_distance_m",
  "check_in_accuracy_m",
  "check_out_latitude",
  "check_out_longitude",
  "check_out_distance_m",
  "check_out_accuracy_m",
  "total_amount",
  "monthly_installment",
  "remaining_balance",
  "duration_hours",
  "total_gross",
  "total_deduction",
  "total_net",
  "total_overtime_hours",
  "meal_allowance_amount",
  "transport_allowance_amount",
  "overtime_pay",
  "late_deduction_amount",
  "absence_deduction_amount",
  "unpaid_leave_deduction_amount",
  "missing_checkout_deduction_amount",
  "loan_deduction_amount",
  "other_deduction_amount",
  "bonus_amount",
  "gross_salary",
  "net_salary",
];

function serializeDecimalFields(row) {
  if (!row) return row;
  const output = { ...row };
  MONEY_FIELDS.forEach((field) => {
    if (field in output) {
      output[field] = toNumber(output[field]);
    }
  });
  return output;
}

function serializePayslip(row) {
  if (!row) return row;
  const output = serializeDecimalFields(row);
  if (output.loan_breakdown && typeof output.loan_breakdown === "string") {
    try {
      output.loan_breakdown = JSON.parse(output.loan_breakdown);
    } catch (error) {
      output.loan_breakdown = [];
    }
  }
  return output;
}

module.exports = {
  toNumber,
  photoUrl,
  serializeDecimalFields,
  serializePayslip,
};
