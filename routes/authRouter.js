const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");

// Login route
router.post("/auth/login", authController.login);

// Register route
router.post("/auth/register", authController.register);

// Protected profile route
router.get("/auth/profile", authController.verifyToken, authController.profile);

module.exports = router;
