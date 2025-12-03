const express = require("express");
const router = express.Router();
const pelangganController = require("../controllers/pelangganController");
const { verifyToken } = require("../controllers/authController");

router.get("/pelanggan", verifyToken, pelangganController.getPelanggan);
router.get("/pelanggan/all", verifyToken, pelangganController.getAllPelanggan);
router.get("/pelanggan/:id", verifyToken, pelangganController.getPelangganById);
router.post("/pelanggan", verifyToken, pelangganController.createPelanggan);
router.put("/pelanggan/:id", verifyToken, pelangganController.updatePelanggan);
router.delete(
  "/pelanggan/:id",
  verifyToken,
  pelangganController.deletePelanggan
);

module.exports = router;
