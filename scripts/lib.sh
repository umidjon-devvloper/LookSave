#!/usr/bin/env bash
#
# Umumiy yordamchilar — `scripts/*.sh` shu fayldan `source` qiladi.
# Mustaqil ishga tushirilmaydi.
#
# ⚠️ NEGA BU FAYL BOR: RUNBOOK Docker'ni nazarda tutadi, lekin ishlab
# chiqish mashinasida Docker bo'lmasligi mumkin (Postgres.app + brew redis
# bilan ham hammasi ishlaydi). Muhitni aniqlash mantiqi har skriptda
# takrorlanmasin uchun shu yerga yig'ilgan.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# ── Chiqish ──────────────────────────────────────────────────────────────
# TTY bo'lmasa rang qo'yilmaydi — CI logida `\033[` axlati qolmasin.
if [ -t 1 ]; then
  C_OK=$'\033[32m'; C_WARN=$'\033[33m'; C_ERR=$'\033[31m'
  C_DIM=$'\033[2m'; C_B=$'\033[1m'; C_0=$'\033[0m'
else
  C_OK=''; C_WARN=''; C_ERR=''; C_DIM=''; C_B=''; C_0=''
fi

step() { printf '%s→ %s%s\n' "$C_B" "$*" "$C_0"; }
ok()   { printf '  %s✅ %s%s\n' "$C_OK" "$*" "$C_0"; }
warn() { printf '  %s⚠️  %s%s\n' "$C_WARN" "$*" "$C_0"; }
die()  { printf '  %s❌ %s%s\n' "$C_ERR" "$*" "$C_0" >&2; exit 1; }
dim()  { printf '  %s%s%s\n' "$C_DIM" "$*" "$C_0"; }

# Skript sarlavhasidagi izoh blokini yordam matni sifatida chiqaradi.
# `sed -n '2,20p'` ishlatilmaydi: blok uzunligi har faylda boshqacha va
# qattiq raqam qo'yilsa `source` qatori ham yordam matniga tushib qoladi.
usage() {
  awk 'NR == 1 { next }
       /^#/    { sub(/^# ?/, ""); print; next }
       { exit }' "$1"
}

# ── .env o'qish ──────────────────────────────────────────────────────────
# `source` ishlatilmaydi: qiymatda `#` yoki probel bo'lsa u buziladi va
# fayldagi izohlar buyruq sifatida bajarilishi mumkin.
env_get() {
  local key="$1" file="${2:-$ROOT/apps/api/.env}"
  [ -f "$file" ] || return 1
  sed -n "s/^${key}=//p" "$file" | head -1 | sed -e 's/^"//' -e 's/"$//'
}

# ── psql topish ──────────────────────────────────────────────────────────
# Postgres.app `psql` ni PATH ga qo'shmaydi va u ikki xil joyda bo'lishi
# mumkin: `/Applications` yoki `~/Applications`. Homebrew varianti ham
# `keg-only` — u ham PATH da bo'lmaydi.
find_psql() {
  if command -v psql >/dev/null 2>&1; then command -v psql; return 0; fi

  local candidate
  for candidate in \
    "$HOME"/Applications/Postgres.app/Contents/Versions/*/bin/psql \
    /Applications/Postgres.app/Contents/Versions/*/bin/psql \
    /opt/homebrew/opt/postgresql@1[0-9]/bin/psql \
    /opt/homebrew/opt/libpq/bin/psql \
    /usr/local/opt/libpq/bin/psql
  do
    [ -x "$candidate" ] && { echo "$candidate"; return 0; }
  done
  return 1
}

# ── Muhitni aniqlash ─────────────────────────────────────────────────────
# `docker` — faqat demon ham javob berса. O'rnatilgan-u ishlamayotgan
# Docker eng chalg'ituvchi holat: buyruq bor, lekin har chaqiruv osilib
# qoladi.
docker_ready() {
  command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1
}

port_open() { nc -z 127.0.0.1 "$1" >/dev/null 2>&1; }

# Portni kutish. Sabab: konteyner ko'tarilishi bilan port darhol
# ochilmaydi, `psql` esa "connection refused" bilan yiqiladi.
wait_port() {
  local port="$1" name="$2" tries="${3:-30}" i=0
  while [ "$i" -lt "$tries" ]; do
    port_open "$port" && return 0
    i=$((i + 1)); sleep 1
  done
  die "$name ($port) $tries soniyada ko'tarilmadi"
}
