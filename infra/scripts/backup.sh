#!/usr/bin/env bash
#
# Kunlik backup: pg_dump → Cloudflare R2 (docs/08-deployment.md §8)
# Cron:  0 3 * * * /home/deploy/looksave/infra/scripts/backup.sh >> /var/log/looksave-backup.log 2>&1
#
# Talab: aws CLI (R2 S3-mos API orqali).
#   curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o awscli.zip && unzip awscli.zip && sudo ./aws/install
#
set -euo pipefail
cd "$(dirname "$0")/.."

set -a
# shellcheck disable=SC1091
source .env
set +a

command -v aws >/dev/null || { echo "❌ aws CLI o'rnatilmagan" >&2; exit 1; }
: "${R2_ACCESS_KEY_ID:?}" "${R2_SECRET_ACCESS_KEY:?}" "${R2_BUCKET_BACKUPS:?}" "${R2_ENDPOINT:?}"

DATE="$(date -u +%Y%m%d-%H%M)"
FILE="/tmp/looksave-${DATE}.dump"
trap 'rm -f "$FILE"' EXIT

docker compose exec -T postgres \
  pg_dump -U looksave -d looksave --format=custom --compress=9 > "$FILE"

SIZE="$(stat -c%s "$FILE")"
if [ "$SIZE" -lt 10000 ]; then
  echo "❌ Backup juda kichik (${SIZE} bayt) — xato bor" >&2
  exit 1
fi

export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"
export AWS_DEFAULT_REGION=auto

aws s3 cp "$FILE" "s3://${R2_BUCKET_BACKUPS}/db/looksave-${DATE}.dump" \
  --endpoint-url "$R2_ENDPOINT"

echo "✅ Backup: looksave-${DATE}.dump ($((SIZE / 1024 / 1024)) MB)"

# 30 kundan eski nusxalarni o'chirish.
# Fayl nomi: looksave-YYYYMMDD-HHMM.dump → sanani 10-belgidan olamiz.
CUTOFF="$(date -u -d '30 days ago' +%Y%m%d)"
aws s3 ls "s3://${R2_BUCKET_BACKUPS}/db/" --endpoint-url "$R2_ENDPOINT" \
  | awk -v c="$CUTOFF" '{ if (substr($4, 10, 8) < c) print $4 }' \
  | xargs -r -I{} aws s3 rm "s3://${R2_BUCKET_BACKUPS}/db/{}" --endpoint-url "$R2_ENDPOINT"
