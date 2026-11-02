const multer = require("multer");
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const { nowJakarta } = require("./hrTime");

const UPLOADS_ROOT = path.join(__dirname, "..", "uploads");
const MAX_SELFIE_BYTES = 8 * 1024 * 1024;

const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SELFIE_BYTES },
  fileFilter: function (req, file, cb) {
    if (allowedMimeTypes.has(file.mimetype)) {
      return cb(null, true);
    }
    cb(new Error("Format foto tidak didukung. Gunakan JPG, PNG, atau WebP."));
  },
});

const selfieSingle = memoryUpload.single("photo");

function handleSelfieUploadError(req, res, next) {
  selfieSingle(req, res, function (err) {
    if (err) {
      if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          status: false,
          message: "Ukuran foto terlalu besar. Maksimal 8 MB.",
        });
      }
      return res.status(400).json({ status: false, message: err.message });
    }
    next();
  });
}

function ensureDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true });
}

async function processSelfie(buffer, userId) {
  const now = nowJakarta();
  const monthDir = path.join(
    UPLOADS_ROOT,
    "attendance",
    now.format("YYYY"),
    now.format("MM")
  );
  ensureDirectory(monthDir);

  const fileName = `attendance-${userId}-${Date.now()}-${Math.round(Math.random() * 1e6)}.webp`;
  const absolutePath = path.join(monthDir, fileName);

  await sharp(buffer)
    .rotate()
    .resize({ width: 600, height: 600, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 75 })
    .toFile(absolutePath);

  return path
    .relative(UPLOADS_ROOT, absolutePath)
    .split(path.sep)
    .join("/");
}

module.exports = {
  handleSelfieUploadError,
  processSelfie,
  selfieSingle,
};
