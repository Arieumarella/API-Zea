const express = require("express");
const router = express.Router();
const barangController = require("../controllers/barangController");
const { verifyToken } = require("../controllers/authController");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Pastikan direktori uploads ada
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
  upload.single("foto")(req, res, function (err) {
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

router.get("/barang", verifyToken, barangController.getBarang);
router.get("/barang/all", verifyToken, barangController.getAllBarang);
// Specific route for stock must be declared before the dynamic "/barang/:id" route
router.get("/barang/stockBarang", verifyToken, barangController.stockBarang);
router.get("/barang/:id", verifyToken, barangController.getBarangById);
router.post("/barang", verifyToken, uploadSingle, barangController.createBarang);
router.put("/barang/:id", verifyToken, uploadSingle, barangController.updateBarang);
router.delete("/barang/:id", verifyToken, barangController.deleteBarang);
router.get("/barang/detilMasuk/:id", verifyToken, barangController.detilMasuk);

router.get(
  "/barang/detilKeluar/:id",
  verifyToken,
  barangController.detilKeluar
);

router.get(
  "/barang/detilSisa/:id",
  verifyToken,
  barangController.detilSisaStok
);

module.exports = router;
