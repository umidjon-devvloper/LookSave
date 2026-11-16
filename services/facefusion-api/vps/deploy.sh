#!/usr/bin/env bash
# MAC'DAN ishlaydi — `fly deploy` ning o'rniga: kodni serverga ko'chiradi,
# image'ni qayta quradi va xizmatni yangilaydi.
#
#   ./vps/deploy.sh                      kod → qurish → ishga tushirish
#   ./vps/deploy.sh --public             + tashqi eshik (HTTPS) ham
#   FACE_VPS=root@boshqa ./vps/deploy.sh boshqa serverga
#
# Serverdagi sozlamalar (`vps/.env`) va model og'irliklari saqlanib qoladi.
# Kirish SSH kaliti bilan — parol so'ralsa, kalit serverga tanitilmagan.
set -euo pipefail

HOST="${FACE_VPS:-root@13.140.36.214}"
DIR=/var/www/looksave-face
HERE="$(cd "$(dirname "$0")/.." && pwd)"

echo "→ kod ko'chirilmoqda: ${HOST}:${DIR}"
ssh "$HOST" "mkdir -p ${DIR}"

# COPYFILE_DISABLE / --no-xattrs: macOS'ning `._fayl` va xattr yozuvlari
# serverga bormasin. `vps/.env` — faqat serverda, ustidan yozilmaydi.
COPYFILE_DISABLE=1 tar -C "$HERE" --no-xattrs \
  --exclude='./vps/.env' --exclude='./smoke' --exclude='./fly.toml' \
  --exclude='__pycache__' --exclude='.venv' --exclude='.DS_Store' \
  -cf - . | ssh "$HOST" "tar -C ${DIR} --no-same-owner -xf - && chmod +x ${DIR}/vps/*.sh"

echo "→ serverda qurilmoqda"
# -t: jarayon ko'rinib tursin; uzilib qolsa qayta yurgizish xavfsiz.
ssh -t "$HOST" "cd ${DIR}/vps && ./up.sh $*"
