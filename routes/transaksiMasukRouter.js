const express = require("express");
const router = express.Router();
const trxController = require("../controllers/transaksiMasukController");
const { verifyToken } = require("../controllers/authController");

router.post(
  "/transaksi-masuk",
  verifyToken,
  trxController.createTransaksiMasuk
);
router.get("/transaksi-masuk", verifyToken, trxController.getTransaksiMasuk);
router.get(
  "/transaksi-masuk/:id",
  verifyToken,
  trxController.getTransaksiMasukById
);
router.put(
  "/transaksi-masuk/:id",
  verifyToken,
  trxController.updateTransaksiMasuk
);

// Return (retur) for transaksi masuk
router.post(
  "/transaksi-masuk/:id/retur",
  verifyToken,
  trxController.createReturTransaksiMasuk
);

// Delete transaksi masuk
router.delete(
  "/transaksi-masuk/:id",
  verifyToken,
  trxController.deleteTransaksiMasuk
);

// Update berjangka masuk (pembayaran cicilan)
router.put(
  "/berjangka-masuk-cicil/:id",
  verifyToken,
  trxController.updateBerjangkaMasuk
);

// Get berjangka masuk by transaksi id
router.get(
  "/berjangka-masuk-cicil/:id",
  verifyToken,
  trxController.getBerjangkaMasukByTransaksiId
);

module.exports = router;
