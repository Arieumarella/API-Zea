#!/usr/bin/env bash
# Backup MySQL database (via docker container) + uploads folder.
# Jalankan dari host server (bukan di dalam container).
# Direkomendasikan lewat cron, contoh setiap hari jam 3 pagi:
#   0 3 * * * /root/project/API-Zea/scripts/backup.sh >> /root/backups/backup.log 2>&1
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/root/backups}"
DB_CONTAINER="${DB_CONTAINER:-mysql-db}"
APP_CONTAINER="${APP_CONTAINER:-pos_api}"
KEEP_DAYS="${KEEP_DAYS:-7}"
STAMP="$(date +%F_%H%M%S)"

mkdir -p "$BACKUP_DIR"

# 1) Database dump (semua database). Pakai env MYSQL_ROOT_PASSWORD di dalam container.
if docker inspect "$DB_CONTAINER" >/dev/null 2>&1; then
  docker exec "$DB_CONTAINER" sh -c 'exec mysqldump --all-databases -uroot -p"$MYSQL_ROOT_PASSWORD"' > "$BACKUP_DIR/db_$STAMP.sql"
  gzip -f "$BACKUP_DIR/db_$STAMP.sql"
  echo "[$STAMP] DB backup -> $BACKUP_DIR/db_$STAMP.sql.gz"
else
  echo "[$STAMP] WARN: container $DB_CONTAINER tidak ditemukan, skip DB backup." >&2
fi

# 2) Folder uploads (foto absensi, lampiran, dst).
if docker inspect "$APP_CONTAINER" >/dev/null 2>&1; then
  docker exec "$APP_CONTAINER" sh -c 'cd /app && tar -czf - uploads' > "$BACKUP_DIR/uploads_$STAMP.tar.gz"
  echo "[$STAMP] Uploads backup -> $BACKUP_DIR/uploads_$STAMP.tar.gz"
else
  echo "[$STAMP] WARN: container $APP_CONTAINER tidak ditemukan, skip uploads backup." >&2
fi

# 3) Hapus backup lebih tua dari KEEP_DAYS.
find "$BACKUP_DIR" -type f \( -name 'db_*.sql.gz' -o -name 'uploads_*.tar.gz' \) -mtime +"$KEEP_DAYS" -delete

echo "[$STAMP] Backup selesai (simpan $KEEP_DAYS hari)."
