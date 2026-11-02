const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const { createLog } = require("../utils/logHelper");
const { serializeDecimalFields } = require("../utils/hrSerialize");
const { getStoreNameMap } = require("../utils/hrShared");

async function getUserMap(userIds) {
  const users = await prisma.t_user.findMany({
    where: { id: { in: userIds } },
    select: {
      id: true,
      username: true,
      nama: true,
      jabatan: true,
      no_tlp: true,
      role: true,
      id_toko: true,
    },
  });
  const map = {};
  users.forEach((user) => {
    map[user.id] = user;
  });
  return map;
}

exports.listEmployees = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const take = parseInt(req.query.take) || 10;
    const skip = (page - 1) * take;
    const search = req.query.search ? String(req.query.search).trim() : "";
    const storeId = req.query.store_id ? parseInt(req.query.store_id, 10) : null;
    const isActive =
      req.query.is_active === undefined || req.query.is_active === null || req.query.is_active === ""
        ? null
        : req.query.is_active === "true" || req.query.is_active === "1";

    let userIds = null;
    if (search) {
      const matched = await prisma.t_user.findMany({
        where: {
          OR: [{ nama: { contains: search } }, { username: { contains: search } }],
        },
        select: { id: true },
      });
      userIds = matched.map((user) => user.id);
      if (userIds.length === 0) {
        return res.status(200).json({
          status: true,
          data: [],
          page,
          total: 0,
          totalPages: 0,
        });
      }
    }

    const where = {};
    if (storeId) where.store_id = storeId;
    if (isActive !== null) where.is_active = isActive;
    if (userIds) where.user_id = { in: userIds };

    const [profiles, total] = await Promise.all([
      prisma.employee_profiles.findMany({
        where,
        skip,
        take,
        orderBy: { id: "asc" },
      }),
      prisma.employee_profiles.count({ where }),
    ]);

    const userIdList = profiles.map((profile) => profile.user_id);
    const [userMap, storeMap] = await Promise.all([
      getUserMap(userIdList),
      getStoreNameMap(profiles.map((profile) => profile.store_id)),
    ]);

    const data = profiles.map((profile) => ({
      ...serializeDecimalFields(profile),
      user: userMap[profile.user_id] || null,
      nama_toko: storeMap[profile.store_id] || `Toko #${profile.store_id}`,
    }));

    return res.status(200).json({
      status: true,
      data,
      page,
      total,
      totalPages: Math.ceil(total / take),
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

exports.getEmployee = async (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    const profile = await prisma.employee_profiles.findUnique({
      where: { user_id: userId },
    });
    if (!profile) {
      return res.status(404).json({
        status: false,
        message: "Profil pegawai belum dibuat untuk user ini.",
      });
    }

    const [user, store] = await Promise.all([
      prisma.t_user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          username: true,
          nama: true,
          jabatan: true,
          no_tlp: true,
          role: true,
          id_toko: true,
        },
      }),
      prisma.t_toko.findUnique({ where: { id: profile.store_id } }),
    ]);

    return res.status(200).json({
      status: true,
      data: {
        ...serializeDecimalFields(profile),
        user,
        toko: store,
      },
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

function validateNonNegativeNumber(value, fieldName) {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed < 0) {
    return `${fieldName} tidak boleh negatif.`;
  }
  return null;
}

exports.updateEmployee = async (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    const user = await prisma.t_user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ status: false, message: "User tidak ditemukan" });
    }

    const {
      store_id,
      employee_code,
      nik,
      position,
      base_salary,
      fixed_meal_allowance,
      fixed_transport_allowance,
      overtime_rate_per_hour,
      bank_account,
      bank_name,
      annual_leave_quota,
      join_date,
      allow_any_store_checkin,
      is_active,
    } = req.body;

    const errors = [];
    const numericFields = {
      base_salary: base_salary,
      fixed_meal_allowance: fixed_meal_allowance,
      fixed_transport_allowance: fixed_transport_allowance,
      overtime_rate_per_hour: overtime_rate_per_hour,
    };
    Object.entries(numericFields).forEach(([field, value]) => {
      const error = validateNonNegativeNumber(value, field);
      if (error) errors.push(error);
    });

    let storeId = null;
    if (store_id !== undefined && store_id !== null && store_id !== "") {
      storeId = parseInt(store_id, 10);
      const store = await prisma.t_toko.findUnique({ where: { id: storeId } });
      if (!store) {
        errors.push("Toko yang dipilih tidak ditemukan.");
      }
    }

    if (annual_leave_quota !== undefined && annual_leave_quota !== null && annual_leave_quota !== "") {
      const quota = parseInt(annual_leave_quota, 10);
      if (Number.isNaN(quota) || quota < 0) {
        errors.push("Kuota cuti tahunan tidak boleh negatif.");
      }
    }

    if (join_date !== undefined && join_date !== null && join_date !== "") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(join_date)) {
        errors.push("Format tanggal bergabung tidak valid.");
      }
    }

    if (employee_code !== undefined) {
      const code = employee_code === null || employee_code === "" ? null : String(employee_code).trim();
      if (code) {
        const duplicate = await prisma.employee_profiles.findFirst({
          where: { employee_code: code, user_id: { not: userId } },
        });
        if (duplicate) {
          errors.push("Kode pegawai sudah digunakan oleh pegawai lain.");
        }
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({ status: false, message: errors.join(" ") });
    }

    const data = {};
    if (storeId !== null) data.store_id = storeId;
    if (employee_code !== undefined) {
      data.employee_code =
        employee_code === null || employee_code === "" ? null : String(employee_code).trim();
    }
    if (nik !== undefined) data.nik = nik === "" ? null : nik;
    if (position !== undefined) data.position = position === "" ? null : position;
    if (base_salary !== undefined && base_salary !== null && base_salary !== "") {
      data.base_salary = Number(base_salary);
    }
    if (fixed_meal_allowance !== undefined && fixed_meal_allowance !== null && fixed_meal_allowance !== "") {
      data.fixed_meal_allowance = Number(fixed_meal_allowance);
    }
    if (fixed_transport_allowance !== undefined && fixed_transport_allowance !== null && fixed_transport_allowance !== "") {
      data.fixed_transport_allowance = Number(fixed_transport_allowance);
    }
    if (overtime_rate_per_hour !== undefined && overtime_rate_per_hour !== null && overtime_rate_per_hour !== "") {
      data.overtime_rate_per_hour = Number(overtime_rate_per_hour);
    }
    if (bank_account !== undefined) data.bank_account = bank_account === "" ? null : bank_account;
    if (bank_name !== undefined) data.bank_name = bank_name === "" ? null : bank_name;
    if (annual_leave_quota !== undefined && annual_leave_quota !== null && annual_leave_quota !== "") {
      data.annual_leave_quota = parseInt(annual_leave_quota, 10);
    }
    if (join_date !== undefined) {
      data.join_date = join_date === "" || join_date === null ? null : new Date(`${join_date}T00:00:00Z`);
    }
    if (allow_any_store_checkin !== undefined) {
      data.allow_any_store_checkin = allow_any_store_checkin === true || allow_any_store_checkin === "true";
    }
    if (is_active !== undefined) {
      data.is_active = is_active === true || is_active === "true";
    }

    const existing = await prisma.employee_profiles.findUnique({
      where: { user_id: userId },
    });

    let profile;
    if (existing) {
      profile = await prisma.employee_profiles.update({
        where: { user_id: userId },
        data,
      });
    } else {
      profile = await prisma.employee_profiles.create({
        data: {
          user_id: userId,
          store_id: data.store_id || 1,
          employee_code: data.employee_code || null,
          nik: data.nik || null,
          position: data.position || user.jabatan || "Staff",
          base_salary: data.base_salary || 0,
          fixed_meal_allowance: data.fixed_meal_allowance || 0,
          fixed_transport_allowance: data.fixed_transport_allowance || 0,
          overtime_rate_per_hour: data.overtime_rate_per_hour || 0,
          bank_account: data.bank_account || null,
          bank_name: data.bank_name || null,
          annual_leave_quota: data.annual_leave_quota !== undefined ? data.annual_leave_quota : 12,
          join_date: data.join_date || null,
          allow_any_store_checkin: data.allow_any_store_checkin || false,
          is_active: data.is_active !== undefined ? data.is_active : true,
        },
      });
    }

    createLog({
      id_toko: profile.store_id,
      id_user: req.user?.userId,
      aksi: existing ? "EDIT_HR_EMPLOYEE" : "TAMBAH_HR_EMPLOYEE",
      keterangan: `Memperbarui profil pegawai user #${userId} '${user.nama || user.username}'`,
    });

    return res.status(200).json({
      status: true,
      message: "Profil pegawai berhasil disimpan.",
      data: {
        ...serializeDecimalFields(profile),
        user: {
          id: user.id,
          username: user.username,
          nama: user.nama,
          jabatan: user.jabatan,
          role: user.role,
        },
      },
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

