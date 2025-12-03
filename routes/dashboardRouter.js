const express = require("express");
const router = express.Router();
const dashboardController = require("../controllers/dashboardController");
const { verifyToken } = require("../controllers/authController");

router.get("/dashboard/get-saldo", verifyToken, dashboardController.getSaldo);

router.get(
  "/dashboard/get-transaksi-penjualan",
  verifyToken,
  dashboardController.getTransaksiPenjualan
);

router.get(
  "/dashboard/get-transaksi-pembelian",
  verifyToken,
  dashboardController.getTransaksiPembelian
);

router.get(
  "/dashboard/get-total-stok-barang",
  verifyToken,
  dashboardController.getStokBarang
);

router.get(
  "/dashboard/get-paling-laku",
  verifyToken,
  dashboardController.getPalingLaku
);

router.get(
  "/dashboard/getChartPenjualan",
  verifyToken,
  dashboardController.getChartPenjualan
);

router.get(
  "/dashboard/getDataOprasional",
  verifyToken,
  dashboardController.getDataOprasional
);

router.get(
  "/dashboard/getDataPelanggan",
  verifyToken,
  dashboardController.getDataPelanggan
);

router.get(
  "/dashboard/getJatuhTempoPiutang",
  verifyToken,
  dashboardController.getJatuhTempoPiutang
);

module.exports = router;
