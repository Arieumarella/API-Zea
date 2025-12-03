const express = require("express");
const router = express.Router();
const supplierController = require("../controllers/supplierController");
const { verifyToken } = require("../controllers/authController");

router.get("/supplier", verifyToken, supplierController.getSuppliers);
router.get("/supplier/all", verifyToken, supplierController.getAllSuppliers);
router.get("/supplier/:id", verifyToken, supplierController.getSupplierById);
router.post("/supplier", verifyToken, supplierController.createSupplier);
router.put("/supplier/:id", verifyToken, supplierController.updateSupplier);
router.delete("/supplier/:id", verifyToken, supplierController.deleteSupplier);

module.exports = router;
