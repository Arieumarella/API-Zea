const express = require("express");
const router = express.Router();
const tokoController = require("../controllers/tokoController");
const authController = require("../controllers/authController");

router.get("/toko", authController.verifyToken, tokoController.getAllToko);
router.get("/toko/:id", authController.verifyToken, tokoController.getTokoById);
router.post("/toko", authController.verifyToken, tokoController.createToko);
router.put("/toko/:id", authController.verifyToken, tokoController.updateToko);
router.delete("/toko/:id", authController.verifyToken, tokoController.deleteToko);

module.exports = router;
