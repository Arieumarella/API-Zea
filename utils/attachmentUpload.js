const multer = require("multer");
const path = require("path");
const fs = require("fs");

const { nowJakarta } = require("./hrTime");

const UPLOADS_ROOT = path.join(__dirname, "..", "uploads");
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_ATTACHMENT_BYTES },
  fileFilter: function (req, file, cb) {
    if (allowedMimeTypes.has(file.mimetype)) {
      return cb(null, true);
    }
    cb(new Error("Format lampiran tidak didukung. Gunakan JPG, PNG, WebP, atau PDF."));
  },
});

const attachmentSingle = memoryUpload.single("attachment");

function handleAttachmentUploadError(req, res, next) {
  attachmentSingle(req, res, function (err) {
    if (err) {
      if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          status: false,
          message: "Ukuran lampiran terlalu besar. Maksimal 5 MB.",
        });
      }
      return res.status(400).json({ status: false, message: err.message });
    }
    next();
  });
}

async function saveAttachment(buffer, originalName, userId) {
  const now = nowJakarta();
  const monthDir = path.join(
    UPLOADS_ROOT,
    "hr-attachments",
    now.format("YYYY"),
    now.format("MM")
  );
  fs.mkdirSync(monthDir, { recursive: true });

  const extension = (path.extname(originalName) || ".bin").toLowerCase();
  const safeExtension = [".jpg", ".jpeg", ".png", ".webp", ".pdf"].includes(extension)
    ? extension
    : ".bin";
  const fileName = `attachment-${userId}-${Date.now()}-${Math.round(Math.random() * 1e6)}${safeExtension}`;
  const absolutePath = path.join(monthDir, fileName);

  await fs.promises.writeFile(absolutePath, buffer);

  return path
    .relative(UPLOADS_ROOT, absolutePath)
    .split(path.sep)
    .join("/");
}

module.exports = {
  handleAttachmentUploadError,
  saveAttachment,
  attachmentSingle,
};
