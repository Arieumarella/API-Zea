const express = require("express");
const router = express.Router();
const profileController = require("../controllers/profileController");
const { verifyToken } = require("../controllers/authController");

// GET profile (id = 1)
router.get("/profile", verifyToken, profileController.getProfile);

// POST create profile (will fail if already exists)
router.post("/profile", verifyToken, profileController.createProfile);

// PUT update profile (creates if not exists)
router.put("/profile", verifyToken, profileController.updateProfile);

// DELETE profile
router.delete("/profile", verifyToken, profileController.deleteProfile);

module.exports = router;
