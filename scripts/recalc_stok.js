/*
 * Recalculate stock (t_barang.jml_yard / jml_rol) from transactions:
 *   stok = SUM(masuk.jml_yard) - SUM(keluar.(jml_yard - jml_yard_retur))
 * Usage (from Api/):
 *   node scripts/recalc_stok.js            # executes UPDATE on DB (use DATABASE_URL)
 *   RECALC_DRYRUN=1 node scripts/recalc_stok.js   # dry-run, only prints, no UPDATE
 * Override DB with env, e.g. (PowerShell):
 *   $env:DATABASE_URL='mysql://root:@localhost:3306/pos_db'
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const ID_TOKO = Number(process.env.RECALC_TOKO || 1);
const DRY_RUN = String(process.env.RECALC_DRYRUN || '') === '1';

const SELECT_DRYRUN = `
  SELECT b.id, b.kd_barang,
         b.jml_yard  AS simpan_yard, b.jml_rol  AS simpan_rol,
         COALESCE(m.yard,0) - COALESCE(k.yard,0) AS baru_yard,
         COALESCE(m.rol,0)  - COALESCE(k.rol,0)  AS baru_rol,
         (b.jml_yard - (COALESCE(m.yard,0) - COALESCE(k.yard,0))) AS selisih_yard
  FROM t_barang b
  LEFT JOIN (SELECT id_barang, SUM(jml_yard) yard, SUM(jml_rol) rol
             FROM t_transaksi_masuk_detail GROUP BY id_barang) m ON m.id_barang = b.id
  LEFT JOIN (SELECT id_barang,
                    SUM(jml_yard - COALESCE(jml_yard_retur,0)) yard,
                    SUM(jml_rol  - COALESCE(jml_rol_retur,0))  rol
             FROM t_transaksi_keluar_detail GROUP BY id_barang) k ON k.id_barang = b.id
  WHERE b.id_toko = ${ID_TOKO}
  ORDER BY selisih_yard DESC;
`;

const UPDATE_SQL = `
  UPDATE t_barang b
  LEFT JOIN (SELECT id_barang, SUM(jml_yard) yard, SUM(jml_rol) rol
             FROM t_transaksi_masuk_detail GROUP BY id_barang) m ON m.id_barang = b.id
  LEFT JOIN (SELECT id_barang,
                    SUM(jml_yard - COALESCE(jml_yard_retur,0)) yard,
                    SUM(jml_rol  - COALESCE(jml_rol_retur,0))  rol
             FROM t_transaksi_keluar_detail GROUP BY id_barang) k ON k.id_barang = b.id
  SET b.jml_yard = COALESCE(m.yard,0) - COALESCE(k.yard,0),
      b.jml_rol  = COALESCE(m.rol,0)  - COALESCE(k.rol,0),
      b.updated_at = NOW()
  WHERE b.id_toko = ${ID_TOKO};
`;

const COUNT_NEG_SQL = `
  SELECT COUNT(*) AS c FROM t_barang
  WHERE id_toko = ${ID_TOKO} AND (jml_yard < 0 OR jml_rol < 0);
`;

async function main() {
  const negBefore = await prisma.$queryRawUnsafe(COUNT_NEG_SQL);
  console.log('Toko    :', ID_TOKO);
  console.log('Negatif sebelum:', negBefore[0].c, '(id_toko=' + ID_TOKO + ')');

  if (DRY_RUN) {
    const rows = await prisma.$queryRawUnsafe(SELECT_DRYRUN);
    console.log('Dry-run: total barang =', rows.length);
    rows.slice(0, 10).forEach((r) => {
      console.log(`  #${r.id} ${r.kd_barang} simpan_yard=${r.simpan_yard} -> baru_yard=${r.baru_yard} selisih=${r.selisih_yard}`);
    });
    return;
  }

  const updated = await prisma.$executeRawUnsafe(UPDATE_SQL);
  const negAfter = await prisma.$queryRawUnsafe(COUNT_NEG_SQL);
  console.log('Baris ter-update :', updated);
  console.log('Negatif setelah  :', negAfter[0].c);
}

main()
  .catch((e) => { console.error('ERROR', e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
