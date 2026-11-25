-- ============================================================
-- RECALC STOK: hitung ulang t_barang.jml_yard / jml_rol dari transaksi
--   stok = SUM(masuk.jml_yard) - SUM(keluar.(jml_yard - jml_yard_retur))
-- Jalankan: 1) BACKUP dulu (mysqldump)
--            2) dry-run (SELECT) untuk review
--            3) UPDATE
--            4) verifikasi
-- ============================================================

-- 0) BACKUP (di server)
-- mysqldump -u root pos_db > pos_db_backup_$(date +%Y%m%d_%H%M%S).sql

-- 1) DRY-RUN: lihat sebelum/sesudah (read-only)
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
WHERE b.id_toko = 1
ORDER BY selisih_yard DESC;

-- 2) UPDATE
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
WHERE b.id_toko = 1;

-- 3) VERIFIKASI
SELECT COUNT(*) AS jumlah_negatif
FROM t_barang
WHERE id_toko = 1 AND (jml_yard < 0 OR jml_rol < 0);

-- sample cek barang
-- SELECT id, kd_barang, jml_yard, jml_rol FROM t_barang WHERE id IN (67, 2406);
