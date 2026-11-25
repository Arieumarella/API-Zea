/*
 * Export link edit langsung per transaksi keluar yang menyebabkan oversold.
 * Output: scripts/output/oversold_links_<timestamp>.csv dan .xlsx
 * Kolom: ID Barang, Kode, Nama, Stok Yard/Rol, ID Transaksi Keluar, Tanggal,
 *        Yard, Rol, Link Edit (https://www.zeatextile.cloud/edit-keluar/<id>)
 * Usage: node scripts/report_oversold_links.js
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
const BASE_URL = process.env.REPORT_BASE_URL || 'https://www.zeatextile.cloud';

const SQL = `
  SELECT d.id_barang, b.kd_barang, b.nama_barang, b.jml_yard, b.jml_rol,
         k.id AS id_transaksi, k.tgl_transaksi,
         d.jml_yard, d.jml_rol,
         COALESCE(d.jml_yard_retur,0) AS yard_retur,
         COALESCE(d.jml_rol_retur,0)  AS rol_retur
  FROM t_transaksi_keluar_detail d
  JOIN t_transaksi_keluar k ON k.id = d.id_transaksi_keluar
  JOIN t_barang b ON b.id = d.id_barang
  WHERE b.id_toko = ${ID_TOKO}
    AND (b.jml_yard < 0 OR b.jml_rol < 0)
  ORDER BY b.jml_yard ASC, k.tgl_transaksi ASC;
`;

async function main() {
  const rows = await prisma.$queryRawUnsafe(SQL);

  const data = rows.map((r) => {
    const tgl = r.tgl_transaksi ? new Date(r.tgl_transaksi).toISOString().slice(0, 10) : '';
    return {
      'ID Barang': r.id_barang,
      'Kode Barang': String(r.kd_barang || ''),
      'Nama Barang': String(r.nama_barang || ''),
      'Stok Yard': Number(r.jml_yard) || 0,
      'Stok Rol': Number(r.jml_rol) || 0,
      'ID Transaksi Keluar': r.id_transaksi,
      'Tanggal': tgl,
      'Yard': Number(r.jml_yard) || 0,
      'Rol': Number(r.jml_rol) || 0,
      'Yard Retur': Number(r.yard_retur) || 0,
      'Rol Retur': Number(r.rol_retur) || 0,
      'Link Edit': `${BASE_URL}/edit-keluar/${r.id_transaksi}`,
    };
  });

  const outDir = path.join(__dirname, 'output');
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const base = path.join(outDir, `oversold_links_${stamp}`);

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
      { wch: 8 }, { wch: 16 }, { wch: 26 }, { wch: 9 }, { wch: 8 },
      { wch: 18 }, { wch: 10 }, { wch: 7 }, { wch: 6 }, { wch: 10 }, { wch: 9 },
      { wch: 48 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'LinkEditKeluar');
    XLSX.writeFile(wb, base + '.xlsx');
  }

  console.log('Total baris transaksi keluar penyebab oversold :', data.length);
  console.log('Barang unik :', new Set(data.map((r) => r['ID Barang'])).size);
  console.log('CSV  :', base + '.csv');
  if (XLSX) console.log('XLSX :', base + '.xlsx');
  console.log('Contoh link:');
  data.slice(0, 5).forEach((r) => console.log('  #' + r['ID Barang'] + ' ' + r['Kode Barang'] + ' -> ' + r['Link Edit']));
}

main()
  .catch((e) => { console.error('ERROR', e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
