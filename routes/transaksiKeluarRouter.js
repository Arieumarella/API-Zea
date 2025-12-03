const express = require("express");
const router = express.Router();
const trxController = require("../controllers/transaksiKeluarController");
const { verifyToken } = require("../controllers/authController");

router.post(
  "/transaksi-keluar",
  verifyToken,
  trxController.createTransaksiKeluar
);
router.get("/transaksi-keluar", verifyToken, trxController.getTransaksiKeluar);
router.get(
  "/transaksi-keluar/:id",
  verifyToken,
  trxController.getTransaksiKeluarById
);
router.put(
  "/transaksi-keluar/:id",
  verifyToken,
  trxController.updateTransaksiKeluar
);

// Return (retur) for transaksi keluar
router.post(
  "/transaksi-keluar/:id/retur",
  verifyToken,
  trxController.createReturTransaksiKeluar
);

// Delete transaksi keluar
router.delete(
  "/transaksi-keluar/:id",
  verifyToken,
  trxController.deleteTransaksiKeluar
);

// Update berjangka keluar (pembayaran cicilan)
router.put(
  "/berjangka-keluar-cicil/:id",
  verifyToken,
  trxController.updateBerjangkaKeluar
);

// Get berjangka keluar by transaksi id
router.get(
  "/berjangka-keluar-cicil/:id",
  verifyToken,
  trxController.getBerjangkaKeluarByTransaksiId
);

module.exports = router;
