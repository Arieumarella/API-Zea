/*
 * Verifikasi sisa oversold setelah recalc stok.
 * Cetak: jumlah barang negatif, barang dgn drift != 0 (harusnya 0), top 10 paling minus.
 * Usage: node scripts/verify_oversold.js
 * Override DB: $env:DATABASE_URL='mysql://root:@localhost:3306/pos_db'
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const ID_TOKO = Number(process.env.RECALC_TOKO || 1);

const SQL = `
  SELECT b.id, b.kd_barang, b.jml_yard, b.jml_rol,
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
    AND (b.jml_yard < 0 OR b.jml_rol < 0)
  ORDER BY b.jml_yard ASC;
`;

async function main() {
  const rows = await prisma.$queryRawUnsafe(SQL);
  console.log('SISA OVERSOLD =', rows.length);
  let drift = 0;
  for (const r of rows) {
    const dy = Number(r.jml_yard) - Number(r.hitung_yard);
    const dr = Number(r.jml_rol) - Number(r.hitung_rol);
    if (dy !== 0 || dr !== 0) drift++;
  }
  console.log('Dengan drift != 0 (harusnya 0):', drift);
  console.log('Top 10 paling minus:');
  rows.slice(0, 10).forEach((r) => {
    console.log(`  #${r.id} ${r.kd_barang} | stok=${r.jml_yard}/${r.jml_rol} | hitung=${r.hitung_yard}/${r.hitung_rol}`);
  });
}

main()
  .catch((e) => { console.error('ERROR', e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
