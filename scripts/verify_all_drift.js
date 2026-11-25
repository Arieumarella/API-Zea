/*
 * Cek konsistensi: stok tersimpan (t_barang.jml_yard/jml_rol) vs hitung
 * ulang dari transaksi (masuk net - keluar net) untuk SEMUA barang.
 * Output: jumlah mismatch + total drift yard.
 * Usage: node scripts/verify_all_drift.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const ID_TOKO = Number(process.env.RECALC_TOKO || 1);

const SQL = `
  SELECT b.id, b.kd_barang, b.nama_barang, b.jml_yard, b.jml_rol,
         COALESCE(m.yard,0) - COALESCE(k.yard,0) AS hitung_yard,
         COALESCE(m.rol,0)  - COALESCE(k.rol,0)  AS hitung_rol
  FROM t_barang b
  LEFT JOIN (SELECT id_barang, SUM(jml_yard) yard, SUM(jml_rol) rol
             FROM t_transaksi_masuk_detail GROUP BY id_barang) m ON m.id_barang = b.id
  LEFT JOIN (SELECT id_barang,
                    SUM(jml_yard - COALESCE(jml_yard_retur,0)) yard,
                    SUM(jml_rol  - COALESCE(jml_rol_retur,0))  rol
             FROM t_transaksi_keluar_detail GROUP BY id_barang) k ON k.id_barang = b.id
  WHERE b.id_toko = ${ID_TOKO}
  ORDER BY b.id;
`;

async function main() {
  const rows = await prisma.$queryRawUnsafe(SQL);
  let mismatch = 0;
  let driftYard = 0;
  for (const r of rows) {
    const sy = Number(r.jml_yard) || 0;
    const sr = Number(r.jml_rol) || 0;
    const hy = Number(r.hitung_yard) || 0;
    const hr = Number(r.hitung_rol) || 0;
    if (sy !== hy || sr !== hr) {
      mismatch++;
      driftYard += hy - sy;
    }
  }
  console.log('Total barang (id_toko=' + ID_TOKO + '):', rows.length);
  console.log('Mismatch (stok != hitung):', mismatch);
  console.log('Total drift yard (hitung - stok):', driftYard);
}

main()
  .catch((e) => { console.error('ERROR', e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
