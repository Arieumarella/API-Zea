const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const SECRET_KEY = process.env.JWT_SECRET || "your_secret_key";
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await prisma.t_user.findFirst({ where: { username } });
    if (!user) {
      return res
        .status(401)
        .json({ status: false, message: "Username atau password salah" });
    }
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res
        .status(401)
        .json({ status: false, message: "Username atau password salah" });
    }
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      SECRET_KEY,
      { expiresIn: "5h" }
    );
    return res.status(200).json({
      status: true,
      token,
      nama: user.nama,
      jabatan: user.jabatan,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

exports.register = async (req, res) => {
  try {
    const { username, password, nama, jabatan, no_tlp } = req.body;
    // Cek apakah username sudah ada
    const existingUser = await prisma.t_user.findFirst({ where: { username } });
    if (existingUser) {
      return res
        .status(400)
        .json({ status: false, message: "Username sudah digunakan" });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await prisma.t_user.create({
      data: {
        username,
        password: hashedPassword,
        nama,
        jabatan,
        no_tlp,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
    return res
      .status(201)
      .json({ status: true, message: "User registered successfully" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

exports.verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];
    if (!token)
      return res
        .status(401)
        .json({ status: false, message: "No token provided" });
    jwt.verify(token, SECRET_KEY, (err, user) => {
      if (err)
        return res
          .status(403)
          .json({ status: false, message: "Invalid token" });
      req.user = user;
      next();
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

exports.profile = async (req, res) => {
  try {
    // Ambil data user dari database
    const user = await prisma.t_user.findUnique({
      where: { id: req.user.userId },
    });
    if (!user) {
      return res
        .status(404)
        .json({ status: false, message: "User tidak ditemukan" });
    }
    return res.status(200).json({ status: true, user });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};
