const express = require("express");
const router = express.Router();
const barangController = require("../controllers/barangController");
const { verifyToken } = require("../controllers/authController");

router.get("/barang", verifyToken, barangController.getBarang);
router.get("/barang/all", verifyToken, barangController.getAllBarang);
// Specific route for stock must be declared before the dynamic "/barang/:id" route
router.get("/barang/stockBarang", verifyToken, barangController.stockBarang);
router.get("/barang/:id", verifyToken, barangController.getBarangById);
router.post("/barang", verifyToken, barangController.createBarang);
router.put("/barang/:id", verifyToken, barangController.updateBarang);
router.delete("/barang/:id", verifyToken, barangController.deleteBarang);
router.get("/barang/detilMasuk/:id", verifyToken, barangController.detilMasuk);

router.get(
  "/barang/detilKeluar/:id",
  verifyToken,
  barangController.detilKeluar
);

module.exports = router;
