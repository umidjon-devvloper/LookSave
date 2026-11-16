#!/usr/bin/env bash
# SERVERDA ishlaydi. Mac'dan `deploy.sh` shuni chaqiradi; qo'lda ham bo'ladi.
#
#   ./up.sh            Docker (yo'q bo'lsa) → image → xizmat (faqat 127.0.0.1:8080)
#   ./up.sh --public   yuqoridagi + tashqi eshik (HTTPS). DNS shu serverga
#                      qaragan bo'lishi shart, aks holda to'xtaydi (kod 3).
#
# Qayta yurgizish xavfsiz: o'zgarmagan qatlamlar keshdan olinadi.
set -euo pipefail
cd "$(dirname "$0")"

say() { printf '\n[%s] %s\n' "$(date '+%H:%M:%S')" "$*"; }

[ "$(id -u)" = 0 ] || { echo "root sifatida yurgizing" >&2; exit 1; }

# ── 1) Docker ────────────────────────────────────────────────────────────
if ! docker compose version >/dev/null 2>&1; then
  say "Docker o'rnatilmoqda (rasmiy apt ombori)"
  # shellcheck disable=SC1091
  . /etc/os-release
  case "${ID:-}" in
    ubuntu | debian) ;;
    *)
      echo "Bu skript Ubuntu/Debian uchun; bu yerda: ${ID:-aniqlanmadi}" >&2
      exit 1
      ;;
  esac

  export DEBIAN_FRONTEND=noninteractive
  # Yangi serverda birinchi daqiqalarda avtomatik yangilanish apt'ni band
  # qilib turadi — xato bermasdan kutamiz.
  apt_get() { apt-get -o DPkg::Lock::Timeout=300 -y -qq "$@"; }

  apt_get update
  apt_get install ca-certificates curl
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL "https://download.docker.com/linux/${ID}/gpg" -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/${ID} ${VERSION_CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list
  apt_get update
  apt_get install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
fi

# ── 2) Sozlamalar ────────────────────────────────────────────────────────
if [ ! -f .env ]; then
  cp env.example .env
  say ".env yaratildi (env.example dan)"
fi

if ! grep -q '^FACE_MEM_LIMIT=' .env; then
  total_mb=$(awk '/^MemTotal:/ {print int($2 / 1024)}' /proc/meminfo)
  # Tizim, Docker va Caddy uchun 1.5 GB qoldiriladi; lekin 24 GB dan oshmaydi:
  # modellar xotirada turganda xizmatning cho'qqisi ~20 GB (facefusion
  # ishchisi ~4, kesim ishchisi ~12, zaxira yo'l yana ~4), serverda esa
  # boshqa narsa ham turadi.
  limit_mb=$((total_mb - 1536))
  [ "$limit_mb" -le 24576 ] || limit_mb=24576
  if [ "$limit_mb" -lt 20000 ]; then
    echo "⚠️  Xotira kam: jami ${total_mb} MB. docker-compose.yml da FACEFUSION_WARM va CUTOUT_PREWARM ni o'chiring, CUTOUT_TASKS_PER_WORKER=1 qiling." >&2
  fi
  printf 'FACE_MEM_LIMIT="%sm"\n' "$limit_mb" >> .env
  say "Xotira chegarasi: ${limit_mb} MB (jami ${total_mb} MB)"
fi

if ! grep -q '^FACE_CPUSET=' .env; then
  total_cpus=$(nproc)
  # Xizmatga 8 tagacha yadro; qolgani serverdagi boshqa ishlarga.
  use_cpus=$total_cpus
  [ "$use_cpus" -le 8 ] || use_cpus=8
  printf 'FACE_CPUSET="0-%s"\n' "$((use_cpus - 1))" >> .env
  say "Yadrolar: ${use_cpus} ta (jami ${total_cpus})"
fi

# ── 3) Qurish va ishga tushirish ─────────────────────────────────────────
say "Image qurilmoqda (birinchi marta 10–15 daqiqa, keyin bir necha soniya)"
docker compose build face

say "Xizmat ishga tushirilmoqda"
docker compose up -d face

say "Javob kutilmoqda"
health=
for _ in $(seq 1 60); do
  if health=$(curl -fsS -m 5 http://127.0.0.1:8080/health 2>/dev/null); then
    break
  fi
  health=
  sleep 2
done
if [ -z "$health" ]; then
  echo "Xizmat 2 daqiqada javob bermadi. Oxirgi qatorlar:" >&2
  docker compose logs --tail 40 face >&2
  exit 1
fi
echo "$health"

# ── 4) Tashqi eshik ──────────────────────────────────────────────────────
if [ "${1:-}" = "--public" ]; then
  domain=$(sed -n 's/^FACE_DOMAIN=//p' .env | tr -d "\"' ")
  mine=$(ip -4 route get 1.1.1.1 | sed -n 's/.* src \([0-9.]*\).*/\1/p')
  seen=$(getent ahostsv4 "$domain" | awk 'NR == 1 {print $1}' || true)

  if [ -z "$domain" ] || [ "$seen" != "$mine" ]; then
    echo "DNS hali tayyor emas: ${domain:-FACE_DOMAIN berilmagan} → ${seen:-topilmadi}, bu server esa ${mine}." >&2
    echo "A yozuvni qo'shing va qayta yurgizing: ./up.sh --public" >&2
    exit 3
  fi

  was_running=$(docker compose ps -q --status running caddy 2>/dev/null || true)
  say "Tashqi eshik (HTTPS): https://${domain}"
  docker compose up -d caddy

  # Allaqachon ishlab turgan bo'lsa — sozlama qayta o'qilsin (uzilishsiz).
  if [ -n "$was_running" ]; then
    docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile \
      || docker compose restart caddy
  fi
fi

say "Tayyor"
docker compose ps
