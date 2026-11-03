# Deploying PointOfSale API with Docker Compose

This guide explains how to run the project using Docker Compose on an Ubuntu VPS.

Prerequisites on the VPS
- Ubuntu server with root or sudo
- Docker and docker-compose installed

Install Docker & Docker Compose (quick):

```bash
# Install Docker Engine
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg lsb-release
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io

# Install docker-compose plugin (if not present)
sudo apt-get install -y docker-compose-plugin
# or install docker-compose V1 if you prefer
```

Steps to deploy

1. Copy project files to VPS (e.g. via git clone or rsync).
2. Create a `.env` file (copy from `.env.example`) and set real values, especially `DATABASE_URL` and `JWT_SECRET`.

Example `.env` (use secure passwords):

```
DATABASE_URL="mysql://pos_user:pos_password@db:3306/pos_db"
MYSQL_ROOT_PASSWORD=strong_root_pass
MYSQL_DATABASE=pos_db
MYSQL_USER=pos_user
MYSQL_PASSWORD=pos_password
PORT=3000
JWT_SECRET=super_secret_jwt
```

3. Build and start services:

```bash
cd /path/to/PointOfSale/Api
docker compose up -d --build
```

4. Verify containers are running:

```bash
docker ps
docker compose logs -f app
```

Notes on Prisma migrations
- The container entrypoint runs `npx prisma migrate deploy` if `DATABASE_URL` is set. Ensure you have migration files in the `prisma/` folder (generated via `npx prisma migrate dev` during development).
- If you prefer manual migration, you can exec into the container and run:

```bash
docker compose exec app npx prisma migrate deploy
```

Stopping & Updating
- To update code: push changes to server or pull, then rebuild:

```bash
docker compose pull
docker compose up -d --build
```

Security recommendations
- Do not expose MySQL port publicly unless necessary; use a private network or firewall.
- Use secure, random values for `JWT_SECRET` and DB passwords.
- Consider using a managed DB or external volume backups.

# Deploy Modul HR / Absensi / Payroll (runbook data-safe)

Migrasi HR bersifat **aditif** (hanya `CREATE TABLE` untuk 10 tabel baru) dan **tidak
mengubah/menghapus data existing** di tabel POS (`t_toko`, `t_user`, `t_transaksi_*`, dll).

Urutan deploy yang disarankan:

1. **Backup database penuh:**
   ```bash
   mysqldump --single-transaction --quick --routines --triggers --events \
     --default-character-set=utf8mb4 \
     -h <HOST> -u <USER> -p <DB_NAME> > backup_sebelum_hr.sql
   ```

2. **Pre-audit checksum** tabel existing:
   ```sql
   CHECKSUM TABLE t_toko, t_user, t_barang, t_saldo, t_supplier, t_pelanggan,
   t_oprasional, t_log, t_berjangka_masuk, t_berjangka_keluar,
   t_transaksi_masuk, t_transaksi_masuk_detail, t_transaksi_keluar,
   t_transaksi_keluar_detail, t_profile_toko;
   ```

3. **Maintenance window singkat** (5–10 menit): hentikan aplikasi agar tidak ada
   penulisan saat migrasi.

4. **Jalankan migrasi** (bukan `migrate dev`, bukan `db push`, bukan `migrate reset`):
   ```bash
   npx prisma migrate deploy
   ```

5. **Cek SQL migrasi** sebelum deploy (harus lolos tanpa output error):
   ```bash
   npm run check:hr-migration
   ```

6. **Post-audit**: jalankan `CHECKSUM TABLE` yang sama dan bandingkan. Semua tabel
   existing harus identik. Yang berubah hanya `_prisma_migrations` (+2 baris: migrasi
   HR awal + migrasi kuota cuti/tanggal berhenti) dan tabel HR (10 tabel baru, plus
   kolom aditif `annual_leave_entitlement`, `leave_quota_year`, `resign_date` pada
   `employee_profiles`). Tabel POS existing tidak tersentuh.

7. **Backfill data awal** (hanya INSERT ke tabel baru):
   ```bash
   npm run backfill:hr:dry   # lihat rencana dulu
   npm run backfill:hr       # jalankan
   ```

8. **Start aplikasi** dan smoke test HR (login, atur lokasi toko, absen, approval,
   payroll). Gunakan `HR_MODULE_ENABLED=false` di env untuk mematikan modul HR tanpa
   memengaruhi POS existing jika terjadi masalah.

Rollback:
- Rollback aplikasi: kembalikan image Docker lama. Kode lama tidak membaca tabel HR.
- Rollback data: restore `backup_sebelum_hr.sql` jika checksum existing berbeda.
- Jangan drop tabel existing dalam kondisi apa pun.

Catatan:
- `scripts/auto_migrate.js` tidak menulis apa pun ke database yang sudah memiliki
  tabel `t_barang` (guard read-only untuk data existing).
- Backfill HR **tidak** dijalankan otomatis oleh entrypoint; jalankan manual.
- Container memakai `TZ=Asia/Jakarta`; pastikan environment ini ikut ter-deploy.

Migrasi terbaru (20261103000000_add_hr_leave_year_resign):
- Hanya `ALTER TABLE employee_profiles ADD COLUMN` (3 kolom baru), aman dan otomatis
  diterapkan oleh entrypoint (`prisma migrate deploy`).
- Inisialisasi nilai lama dilakukan otomatis oleh aplikasi saat pertama kali membaca
  data (`syncAllLeaveQuotas`), **tanpa mengubah sisa cuti yang sudah ada**.

Migrasi 20261104000000_add_hr_shifts_history_audit:
- Tambah tabel `store_shifts` (multi-shift) dan `employee_salary_histories` (riwayat
  gaji/jabatan), kolom `employee_profiles.shift_id`, dan kolom audit mobile di
  `attendances` (mocked location, device_id, app_version). Semua aditif.
- Env opsional `HR_MAX_ACCURACY_M` (default 50) membatasi akurasi GPS absensi.

Backup otomatis:
- Script: `scripts/backup.sh` (dump MySQL + tar folder `uploads`, simpan N hari).
- Pasang cron di host, contoh setiap hari pukul 03.00:
  ```bash
  mkdir -p /root/backups
  crontab -e
  # tambahkan baris:
  0 3 * * * /root/project/API-Zea/scripts/backup.sh >> /root/backups/backup.log 2>&1
  ```
- Verifikasi manual: `bash /root/project/API-Zea/scripts/backup.sh`
- Monitoring: endpoint `GET /health` dipakai healthcheck Docker (container `healthy`).
