const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const { verifyToken } = require("../controllers/authController");

// Semua route harus lewat JWT
router.get("/users", verifyToken, userController.getUsers);
router.get("/users/:id", verifyToken, userController.getUserById);
router.post("/users", verifyToken, userController.createUser);
router.put("/users/:id", verifyToken, userController.updateUser);
router.delete("/users/:id", verifyToken, userController.deleteUser);

module.exports = router;
