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

    const defaultTokoId = user.id_toko || 1;
    const userRole = user.role || "ADMIN_TOKO";

    const token = jwt.sign(
      {
        userId: user.id,
        username: user.username,
        role: userRole,
        id_toko: defaultTokoId,
      },
      SECRET_KEY,
      { expiresIn: "12h" }
    );

    // Fetch store profile if assigned
    const store = await prisma.t_toko.findUnique({
      where: { id: defaultTokoId },
    });

    // If Super Admin / Owner, get all active stores for store switcher
    let stores = [];
    if (userRole === "SUPER_ADMIN" || user.jabatan?.toLowerCase().includes("owner") || user.jabatan?.toLowerCase().includes("pemilik")) {
      stores = await prisma.t_toko.findMany({
        where: { status_aktif: true },
        orderBy: { id: "asc" },
      });
    }

const { createLog } = require("../utils/logHelper");

    createLog({
      id_toko: defaultTokoId,
      id_user: user.id,
      aksi: "LOGIN",
      keterangan: `User ${user.nama} (${user.username}) berhasil login ke sistem.`,
    });

    return res.status(200).json({
      status: true,
      token,
      nama: user.nama,
      jabatan: user.jabatan,

      role: userRole,
      id_toko: defaultTokoId,
      nama_toko: store ? store.nama_toko : "Zea Textile Pusat",
      stores: stores.length > 0 ? stores : undefined,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

exports.register = async (req, res) => {
  try {
    const { username, password, nama, jabatan, no_tlp, id_toko, role } = req.body;
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
        id_toko: id_toko ? parseInt(id_toko) : (req.id_toko || 1),
        role: role || "ADMIN_TOKO",
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
    return res
      .status(201)
      .json({ status: true, message: "User registered successfully", data: newUser });
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
    jwt.verify(token, SECRET_KEY, (err, decoded) => {
      if (err)
        return res
          .status(403)
          .json({ status: false, message: "Invalid token" });
      req.user = decoded;

      // Extract x-toko-id header if present (for Super Admin / Store Switcher), else default to token id_toko or 1
      const headerTokoId = req.headers["x-toko-id"];
      if (headerTokoId && !isNaN(parseInt(headerTokoId))) {
        req.id_toko = parseInt(headerTokoId);
      } else {
        req.id_toko = decoded.id_toko ? parseInt(decoded.id_toko) : 1;
      }

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

    const currentTokoId = req.id_toko || user.id_toko || 1;
    const store = await prisma.t_toko.findUnique({
      where: { id: currentTokoId },
    });

    let stores = [];
    if (user.role === "SUPER_ADMIN" || user.jabatan?.toLowerCase().includes("owner") || user.jabatan?.toLowerCase().includes("pemilik")) {
      stores = await prisma.t_toko.findMany({
        where: { status_aktif: true },
        orderBy: { id: "asc" },
      });
    }

    return res.status(200).json({
      status: true,
      user,
      active_toko: store,
      stores: stores.length > 0 ? stores : undefined,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

