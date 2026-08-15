#!/usr/bin/env bash
#
# Migratsiyalarni qo'llash. Takroriy ishga tushirish xavfsiz —
# qo'llangan fayllar `schema_migrations` jadvalida qayd etiladi.
#
# Migratsiya ORQAGA QAYTMAYDI (docs/02-database.md §1).
# Har safar migratsiyadan OLDIN backup oling:  ./scripts/backup.sh && ./scripts/migrate.sh
#
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "❌ .env topilmadi. cp .env.example .env" >&2
  exit 1
fi

PSQL=(docker compose exec -T postgres psql -U looksave -d looksave -v ON_ERROR_STOP=1)

if ! docker compose ps --status running --services | grep -qx postgres; then
  echo "❌ postgres konteyneri ishlamayapti. docker compose up -d postgres" >&2
  exit 1
fi

# Qayd jadvali. Migratsiyalarning o'zi bunga tegmaydi — bu deploy vositasi.
"${PSQL[@]}" -q <<'SQL'
CREATE TABLE IF NOT EXISTS schema_migrations (
  filename    TEXT PRIMARY KEY,
  checksum    TEXT        NOT NULL,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
SQL

applied_count=0
skipped_count=0

for f in migrations/*.sql; do
  [ -e "$f" ] || { echo "⚠️  migrations/ bo'sh"; exit 0; }

  name="$(basename "$f")"
  checksum="$(sha256sum "$f" | cut -d' ' -f1)"
  recorded="$("${PSQL[@]}" -tAq -c "SELECT checksum FROM schema_migrations WHERE filename = '${name}'")"

  if [ -n "$recorded" ]; then
    if [ "$recorded" != "$checksum" ]; then
      echo "❌ ${name} qo'llangandan keyin o'zgartirilgan." >&2
      echo "   Migratsiya tahrirlanmaydi — o'zgarish uchun yangi raqamlangan fayl yarating." >&2
      exit 1
    fi
    skipped_count=$((skipped_count + 1))
    continue
  fi

  echo "→ ${name}"

  # CREATE INDEX CONCURRENTLY tranzaksiya ichida ishlamaydi — bunday fayl
  # tranzaksiyasiz bajariladi (yarim qolish xavfi bor, log'ga qaralsin).
  if grep -qi 'CONCURRENTLY' "$f"; then
    echo "   (CONCURRENTLY topildi — tranzaksiyasiz bajarilmoqda)"
    "${PSQL[@]}" -q -f - < "$f"
  else
    "${PSQL[@]}" -q --single-transaction -f - < "$f"
  fi

  "${PSQL[@]}" -q -c \
    "INSERT INTO schema_migrations (filename, checksum) VALUES ('${name}', '${checksum}')"

  applied_count=$((applied_count + 1))
done

echo "✅ Migratsiyalar: ${applied_count} ta qo'llandi, ${skipped_count} ta o'tkazib yuborildi"
