/*
 * Export laporan barang oversold (stok negatif) + kekurangan yard/rol.
 * Output: scripts/output/oversold_report_<timestamp>.csv dan .xlsx
 * Usage: node scripts/report_oversold.js
 * Override DB: $env:DATABASE_URL='mysql://root:@localhost:3306/pos_db'
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

let XLSX = null;
try {
  XLSX = require('xlsx');
} catch (e) {
  try {
    XLSX = require(path.join(__dirname, '..', '..', 'free-react-tailwind-admin-dashboard-main', 'free-react-tailwind-admin-dashboard-main', 'node_modules', 'xlsx'));
  } catch (e2) {
    console.warn('xlsx tidak ditemukan; hanya CSV yang dibuat.');
  }
}

const ID_TOKO = Number(process.env.RECALC_TOKO || 1);

const SQL = `
  SELECT b.id, b.kd_barang, b.nama_barang, b.jml_yard, b.jml_rol,
         COALESCE(m.yard,0) AS masuk_yard,
         COALESCE(m.rol,0)  AS masuk_rol,
         COALESCE(k.yard,0) AS keluar_yard,
         COALESCE(k.rol,0)  AS keluar_rol
  FROM t_barang b
  LEFT JOIN (SELECT id_barang, SUM(jml_yard) yard, SUM(jml_rol) rol
             FROM t_transaksi_masuk_detail GROUP BY id_barang) m ON m.id_barang = b.id
  LEFT JOIN (SELECT id_barang,
                    SUM(jml_yard - COALESCE(jml_yard_retur,0)) yard,
                    SUM(jml_rol  - COALESCE(jml_rol_retur,0))  rol
             FROM t_transaksi_keluar_detail GROUP BY id_barang) k ON k.id_barang = b.id
  WHERE b.id_toko = ${ID_TOKO}
    AND (b.jml_yard < 0 OR b.jml_rol < 0)
  ORDER BY b.jml_yard ASC, b.jml_rol ASC;
`;

async function main() {
  const rows = await prisma.$queryRawUnsafe(SQL);

  const data = rows.map((r) => {
    const stokYard = Number(r.jml_yard) || 0;
    const stokRol = Number(r.jml_rol) || 0;
    return {
      ID: r.id,
      'Kode Barang': String(r.kd_barang || ''),
      'Nama Barang': String(r.nama_barang || ''),
      'Stok Yard': stokYard,
      'Stok Rol': stokRol,
      'Kekurangan Yard': stokYard < 0 ? -stokYard : 0,
      'Kekurangan Rol': stokRol < 0 ? -stokRol : 0,
      'Total Masuk Yard': Number(r.masuk_yard) || 0,
      'Total Masuk Rol': Number(r.masuk_rol) || 0,
      'Total Keluar Yard': Number(r.keluar_yard) || 0,
      'Total Keluar Rol': Number(r.keluar_rol) || 0,
    };
  });

  const outDir = path.join(__dirname, 'output');
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const base = path.join(outDir, `oversold_report_${stamp}`);

  // CSV (UTF-8 BOM agar Excel membaca ID/teks dengan benar)
  const cols = Object.keys(data[0] || {});
  const esc = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const csvLines = [cols.map(esc).join(';')];
  data.forEach((r) => csvLines.push(cols.map((c) => esc(r[c])).join(';')));
  fs.writeFileSync(base + '.csv', '\uFEFF' + csvLines.join('\n'), 'utf8');

  if (XLSX) {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [
      { wch: 6 }, { wch: 18 }, { wch: 30 }, { wch: 10 }, { wch: 10 },
      { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 12 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Oversold');
    XLSX.writeFile(wb, base + '.xlsx');
  }

  console.log('Total oversold :', data.length);
  console.log('CSV  :', base + '.csv');
  if (XLSX) console.log('XLSX :', base + '.xlsx');
}

main()
  .catch((e) => { console.error('ERROR', e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
