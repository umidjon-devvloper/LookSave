#!/usr/bin/env bash
#
# Qo'lda deploy. Odatda GitHub Actions o'zi qiladi (docs/08-deployment.md §9) —
# bu skript CI ishlamay qolganda yoki rollback uchun.
#
#   ./scripts/deploy.sh              # latest
#   ./scripts/deploy.sh <git-sha>    # aniq versiya / rollback
#
set -euo pipefail
cd "$(dirname "$0")/.."

TAG="${1:-latest}"
export API_TAG="$TAG"

echo "→ Tortilmoqda: looksave-api:${TAG}"
docker compose pull api

echo "→ Almashtirilmoqda (baza va Redis tegilmaydi)"
docker compose up -d --no-deps api

echo "→ Health kutilmoqda..."
for _ in $(seq 1 30); do
  if docker compose exec -T api node -e \
    "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" 2>/dev/null; then
    echo "✅ Deploy tayyor: ${TAG}"
    docker image prune -f >/dev/null
    exit 0
  fi
  sleep 2
done

echo "❌ Health 60 soniyada javob bermadi. Loglar:" >&2
docker compose logs api --tail 50 >&2
echo "" >&2
echo "Rollback:  ./scripts/deploy.sh <oldingi-sha>" >&2
exit 1
