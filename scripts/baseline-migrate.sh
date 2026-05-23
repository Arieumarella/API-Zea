#!/bin/sh
# =============================================================
# JALANKAN SEKALI SAJA di server saat pertama kali deploy
# Script ini menandai migration baseline "init" sebagai sudah
# diterapkan, tanpa mengubah data atau struktur database apapun.
# =============================================================

set -e

echo "=== Marking baseline migration as already applied ==="
echo "This only needs to be run ONCE on an existing database."
echo ""

npx prisma migrate resolve \
  --applied "20260523000000_init" \
  --schema=./prisma/schema.prisma

echo ""
echo "=== Done! Future deploys will use 'prisma migrate deploy' automatically ==="
