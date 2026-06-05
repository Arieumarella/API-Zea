const express = require("express");
const router = express.Router();
const trxController = require("../controllers/transaksiMasukController");
const { verifyToken } = require("../controllers/authController");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const uploadDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
  },
  fileFilter: function (req, file, cb) {
    const filetypes = /jpeg|jpg|png/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error("Hanya berkas gambar (.png, .jpg, .jpeg) yang diperbolehkan!"));
  },
});

const uploadSingle = (req, res, next) => {
  upload.single("nota")(req, res, function (err) {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({
            status: false,
            message: "Ukuran berkas terlalu besar. Maksimal 5 MB.",
          });
        }
        return res.status(400).json({ status: false, message: err.message });
      }
      return res.status(400).json({ status: false, message: err.message });
    }
    next();
  });
};

router.post(
  "/transaksi-masuk",
  verifyToken,
  uploadSingle,
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
  uploadSingle,
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
