#!/usr/bin/env bash
#
# `dev-up.sh` ko'targan narsalarni to'xtatadi.
#
#   ./scripts/dev-down.sh           # API (va Docker rejimida konteynerlar)
#   ./scripts/dev-down.sh --volumes # + Docker volume'lari (BAZA O'CHADI)
#
# ⚠️ LOKAL REJIMDA Postgres.app va brew redis TEGILMAYDI. Ular tizim
# xizmati va boshqa loyihalar ham ulardan foydalanayotgan bo'lishi mumkin —
# ularni bu skriptdan o'chirish kutilmagan qo'shimcha ta'sir bo'lardi.

source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

WIPE_VOLUMES=0
for arg in "$@"; do
  case "$arg" in
    --volumes) WIPE_VOLUMES=1 ;;
    -h|--help) usage "$0"; exit 0 ;;
    *) die "noma'lum argument: $arg" ;;
  esac
done

cd "$ROOT"

# ── API ──────────────────────────────────────────────────────────────────
step "API"
if [ -f .dev-api.pid ]; then
  PID="$(cat .dev-api.pid)"
  # `npm run dev` bola jarayon yaratadi (tsx watch), shuning uchun butun
  # jarayonlar guruhi to'xtatiladi — aks holda tsx yetim qolib 3000-portni
  # ushlab turadi.
  if kill -0 "$PID" 2>/dev/null; then
    kill -- "-$(ps -o pgid= "$PID" | tr -d ' ')" 2>/dev/null || kill "$PID" 2>/dev/null || true
    ok "to'xtatildi (pid $PID)"
  else
    dim "pid $PID allaqachon yo'q"
  fi
  rm -f .dev-api.pid
elif port_open 3000; then
  warn "3000-port band, lekin uni bu skript ko'tarmagan — tegilmadi"
  dim "  lsof -nP -iTCP:3000 -sTCP:LISTEN"
else
  dim "ishlamayapti"
fi

# ── Docker ───────────────────────────────────────────────────────────────
step "Baza va Redis"
if docker_ready && docker compose -f infra/docker-compose.dev.yml ps -q 2>/dev/null | grep -q .; then
  if [ "$WIPE_VOLUMES" = 1 ]; then
    warn "volume'lar ham o'chiriladi — bazadagi hamma narsa yo'qoladi"
    docker compose -f infra/docker-compose.dev.yml down -v >/dev/null
    ok "konteyner va volume'lar o'chirildi"
  else
    docker compose -f infra/docker-compose.dev.yml down >/dev/null
    ok "konteynerlar to'xtatildi (ma'lumot saqlandi)"
  fi
else
  dim "lokal servislar (Postgres.app / brew redis) — ataylab tegilmadi"
  dim "  brew services stop redis"
fi

printf '\n%sTo`xtatildi.%s\n' "$C_OK$C_B" "$C_0"
