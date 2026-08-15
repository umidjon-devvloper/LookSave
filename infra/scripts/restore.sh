#!/usr/bin/env bash
#
# Backupdan tiklash (docs/08-deployment.md §8, §11)
#
#   ./scripts/restore.sh looksave-20260812-0300.dump --to-test-db   # sinov (xavfsiz)
#   ./scripts/restore.sh looksave-20260812-0300.dump                # HAQIQIY baza (xavfli)
#
# Fayl lokal yo'l bo'lishi yoki R2'dan avtomatik yuklab olinishi mumkin.
#
# ⚠️ Sinalmagan backup — backup emas. Oyiga bir marta --to-test-db bilan sinang.
#
set -euo pipefail
cd "$(dirname "$0")/.."

set -a
# shellcheck disable=SC1091
source .env
set +a

DUMP="${1:-}"
MODE="${2:-}"

if [ -z "$DUMP" ]; then
  echo "Ishlatish: $0 <dump-fayl> [--to-test-db]" >&2
  exit 1
fi

TARGET_DB="looksave"
if [ "$MODE" = "--to-test-db" ]; then
  TARGET_DB="looksave_restore_test"
fi

# Lokal fayl bo'lmasa — R2'dan yuklab olamiz
LOCAL="$DUMP"
if [ ! -f "$LOCAL" ]; then
  LOCAL="/tmp/$(basename "$DUMP")"
  echo "→ R2'dan yuklanmoqda: $(basename "$DUMP")"
  AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
  AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
  AWS_DEFAULT_REGION=auto \
  aws s3 cp "s3://${R2_BUCKET_BACKUPS}/db/$(basename "$DUMP")" "$LOCAL" \
    --endpoint-url "$R2_ENDPOINT"
fi

if [ "$TARGET_DB" = "looksave" ]; then
  echo "⚠️  HAQIQIY bazani ustiga yozmoqchisiz: looksave"
  echo "   Avval API'ni to'xtating:  docker compose stop api"
  read -r -p "   Davom etilsinmi? 'ROSTDAN' deb yozing: " confirm
  [ "$confirm" = "ROSTDAN" ] || { echo "Bekor qilindi"; exit 1; }
fi

PSQL_ADMIN=(docker compose exec -T postgres psql -U looksave -d postgres -v ON_ERROR_STOP=1 -q)

echo "→ Baza tayyorlanmoqda: ${TARGET_DB}"
"${PSQL_ADMIN[@]}" -c "DROP DATABASE IF EXISTS ${TARGET_DB} WITH (FORCE);"
"${PSQL_ADMIN[@]}" -c "CREATE DATABASE ${TARGET_DB} OWNER looksave;"

echo "→ Tiklanmoqda..."
docker compose exec -T postgres \
  pg_restore -U looksave -d "${TARGET_DB}" --no-owner --no-privileges --exit-on-error < "$LOCAL"

echo "→ Tekshiruv:"
docker compose exec -T postgres psql -U looksave -d "${TARGET_DB}" -c "
  SELECT 'users' AS jadval, COUNT(*) FROM users
  UNION ALL SELECT 'stores',   COUNT(*) FROM stores
  UNION ALL SELECT 'products', COUNT(*) FROM products
  UNION ALL SELECT 'orders',   COUNT(*) FROM orders;"

echo "✅ Tiklandi: ${TARGET_DB}"
if [ "$TARGET_DB" != "looksave" ]; then
  echo "   Sinov bazasini o'chirish uchun:"
  echo "   docker compose exec -T postgres psql -U looksave -d postgres -c 'DROP DATABASE ${TARGET_DB} WITH (FORCE);'"
fi
