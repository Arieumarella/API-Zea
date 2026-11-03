const express = require("express");
const router = express.Router();

const { verifyToken } = require("../controllers/authController");
const { hrEnabled, requireSuperAdmin, requireEmployee } = require("../middleware/authz");
const { handleSelfieUploadError } = require("../utils/selfieUpload");
const { handleAttachmentUploadError } = require("../utils/attachmentUpload");

const hrStoreConfigController = require("../controllers/hrStoreConfigController");
const hrEmployeeController = require("../controllers/hrEmployeeController");
const hrAttendanceController = require("../controllers/hrAttendanceController");
const hrRequestController = require("../controllers/hrRequestController");
const hrApprovalController = require("../controllers/hrApprovalController");
const hrPayrollController = require("../controllers/hrPayrollController");
const hrDashboardController = require("../controllers/hrDashboardController");

router.use(hrEnabled);
router.use(verifyToken);

// ===================== Admin endpoints =====================
const adminOnly = [requireSuperAdmin];

router.get("/dashboard", ...adminOnly, hrDashboardController.summary);

router.get("/store-configs", ...adminOnly, hrStoreConfigController.listStoreConfigs);
router.get("/store-configs/:storeId", ...adminOnly, hrStoreConfigController.getStoreConfig);
router.put("/store-configs/:storeId", ...adminOnly, hrStoreConfigController.updateStoreConfig);

router.get("/holidays", ...adminOnly, hrStoreConfigController.listHolidays);
router.post("/holidays", ...adminOnly, hrStoreConfigController.createHoliday);
router.put("/holidays/:id", ...adminOnly, hrStoreConfigController.updateHoliday);
router.delete("/holidays/:id", ...adminOnly, hrStoreConfigController.deleteHoliday);

router.get("/shifts", ...adminOnly, hrStoreConfigController.listShifts);
router.post("/shifts", ...adminOnly, hrStoreConfigController.createShift);
router.put("/shifts/:id", ...adminOnly, hrStoreConfigController.updateShift);
router.delete("/shifts/:id", ...adminOnly, hrStoreConfigController.deleteShift);

router.get("/available-users", ...adminOnly, hrEmployeeController.listAvailableUsers);
router.get("/employees", ...adminOnly, hrEmployeeController.listEmployees);
router.get("/employees/:userId/salary-history", ...adminOnly, hrEmployeeController.getSalaryHistory);
router.get("/employees/:userId", ...adminOnly, hrEmployeeController.getEmployee);
router.put("/employees/:userId", ...adminOnly, hrEmployeeController.updateEmployee);
router.delete("/employees/:userId", ...adminOnly, hrEmployeeController.deleteEmployee);

router.get("/attendances/recap", ...adminOnly, hrAttendanceController.recap);
router.get("/attendances", ...adminOnly, hrAttendanceController.listAttendances);
router.put("/attendances/:id", ...adminOnly, hrAttendanceController.updateAttendance);

router.get("/approvals/summary", ...adminOnly, hrApprovalController.summary);
router.get("/approvals", ...adminOnly, hrApprovalController.listApprovals);
router.get("/approvals/:type/:id", ...adminOnly, hrApprovalController.getApproval);
router.patch("/approvals/:type/:id", ...adminOnly, hrApprovalController.action);

router.post("/payrolls/generate", ...adminOnly, hrPayrollController.generate);
router.get("/payrolls", ...adminOnly, hrPayrollController.listPayrolls);
router.get("/payrolls/:id", ...adminOnly, hrPayrollController.getPayroll);
router.patch("/payrolls/:id/payslips/:payslipId", ...adminOnly, hrPayrollController.updatePayslip);
router.post("/payrolls/:id/finalize", ...adminOnly, hrPayrollController.finalize);
router.delete("/payrolls/:id", ...adminOnly, hrPayrollController.deletePayroll);

// ===================== Employee endpoints =====================
const employeeOnly = [requireEmployee];

router.get("/attendance/me", ...employeeOnly, hrAttendanceController.getMyToday);
router.post("/attendance/clock", ...employeeOnly, handleSelfieUploadError, hrAttendanceController.clock);
router.get("/attendance/history", ...employeeOnly, hrAttendanceController.getMyHistory);

router.get("/leave-requests", ...employeeOnly, hrRequestController.listMyLeaveRequests);
router.post("/leave-requests", ...employeeOnly, handleAttachmentUploadError, hrRequestController.createLeaveRequest);

router.get("/overtime-requests", ...employeeOnly, hrRequestController.listMyOvertimeRequests);
router.post("/overtime-requests", ...employeeOnly, hrRequestController.createOvertimeRequest);

router.get("/attendance-corrections", ...employeeOnly, hrRequestController.listMyCorrectionRequests);
router.post("/attendance-corrections", ...employeeOnly, handleAttachmentUploadError, hrRequestController.createCorrectionRequest);

router.get("/loans", ...employeeOnly, hrRequestController.listMyLoans);
router.post("/loans", ...employeeOnly, hrRequestController.createLoanRequest);

router.get("/payslips/me", ...employeeOnly, hrPayrollController.myPayslips);

module.exports = router;
