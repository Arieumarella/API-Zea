# Perbaikan Stok di Server Produksi

Paket script untuk menghitung ulang stok dari transaksi & export laporan oversold.
Semua script memakai DB dari `DATABASE_URL` di `../.env` (atau override via env).

## Docker (API jalan di container `pos_api`)

API berjalan di Docker (workdir `/app`, external MySQL via `DATABASE_URL`).
Script cukup di-`docker cp` ke container; TIDAK perlu rebuild image.

```bash
# 1. Copy folder scripts ke dalam container
docker cp scripts pos_api:/app/scripts

# 2. Backup DB (di host / jalankan di tempat MySQL)
mysqldump -u root -p pos_db > /root/pos_db_backup_$(date +%Y%m%d_%H%M%S).sql

# 3. Cek konsistensi (baca saja). Hasil 0 = sudah konsisten, TIDAK perlu update.
docker exec pos_api node scripts/verify_all_drift.js

# 4. Kalau ada mismatch, hitung ulang
docker exec pos_api node scripts/recalc_stok.js

# 5. Verifikasi sisa oversold
docker exec pos_api node scripts/verify_oversold.js

# 6. Generate laporan admin (link edit langsung)
docker exec pos_api node scripts/report_oversold_links.js
docker exec pos_api node scripts/report_oversold.js

# 7. Tarik hasil ke host
mkdir -p /root/pos_reports
docker cp pos_api:/app/scripts/output/. /root/pos_reports/
ls -la /root/pos_reports/
```

Catatan Docker:
- `xlsx` tidak terpasang di image (deps prod diprune) → script otomatis fallback ke CSV.
  Kalau mau `.xlsx` juga: `docker exec pos_api npm i xlsx --no-save` dulu (opsional).
- `DATABASE_URL` sudah ada di env container via `env_file` → script langsung konek.
- Amankan: jangan jalankan saat transaksi masuk/keluar aktif supaya hasil konsisten.

## Urutan di server

```bash
cd /opt/api

# 1. BACKUP dulu (WAJIB)
mysqldump -u root -p pos_db > /root/pos_db_backup_$(date +%Y%m%d_%H%M%S).sql

# 2. Cek konsistensi (baca saja). Hasil 0 = sudah konsisten, TIDAK perlu update.
node scripts/verify_all_drift.js

# 3. Kalau ada mismatch, hitung ulang:
node scripts/recalc_stok.js            # eksekusi UPDATE
#    atau dry-run dulu:
# RECALC_DRYRUN=1 node scripts/recalc_stok.js

# 4. Verifikasi sisa oversold (stok negatif)
node scripts/verify_oversold.js

# 5. Generate laporan untuk admin (link edit langsung)
node scripts/report_oversold_links.js   # link edit keluar per transaksi
node scripts/report_oversold.js          # list barang + kekurangan

# Hasil tersimpan di: scripts/output/*.csv (dan .xlsx kalau xlsx terpasang)
```

## Catatan
- Tombol URL edit: `https://www.zeatextile.cloud/edit-keluar/<id_transaksi>`.
  Bisa diubah via env `REPORT_BASE_URL`.
- Jika `xlsx` tidak terpasang di server, script tetap jalan (hanya CSV).
- Jalankan urutan ini SEBAGAI pembaca DB; jangan jalankan saat ada transaksi
  masuk/keluar aktif agar hasil konsisten.

## Alternatif HeidiSQL (tanpa Node)
- `recalc_stok.sql` = versi SQL manual (backup + dry-run + update + verifikasi).
- Ganti `id_toko = 1` bila toko lain.

## File
| File | Fungsi |
|---|---|
| `verify_all_drift.js` | cek mismatch stok vs transaksi |
| `recalc_stok.js` / `.sql` | hitung ulang stok |
| `verify_oversold.js` | verifikasi sisa negatif |
| `report_oversold.js` | list 110 + kekurangan (CSV/XLSX) |
| `report_oversold_links.js` | link edit keluar penyebab (CSV/XLSX) |
