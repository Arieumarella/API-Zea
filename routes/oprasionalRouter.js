const express = require("express");
const router = express.Router();
const oprasionalController = require("../controllers/oprasionalController");
const { verifyToken } = require("../controllers/authController");

router.get("/oprasional", verifyToken, oprasionalController.getOprasional);
router.get(
  "/oprasional/:id",
  verifyToken,
  oprasionalController.getOprasionalById
);
router.post("/oprasional", verifyToken, oprasionalController.createOprasional);
router.put(
  "/oprasional/:id",
  verifyToken,
  oprasionalController.updateOprasional
);
router.delete(
  "/oprasional/:id",
  verifyToken,
  oprasionalController.deleteOprasional
);

module.exports = router;
