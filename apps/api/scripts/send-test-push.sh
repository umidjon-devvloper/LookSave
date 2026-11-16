#!/usr/bin/env bash
#
# send-test-push.sh — bitta foydalanuvchiga SINOV push bildirishnomasini yuboradi.
#
# NEGA KERAK. Jonli push faqat buyurtma statusi o'zgarganda ketadi
# (apps/api/src/integrations/push.ts → notifyCustomer). Qurilmada push
# ishlashini (TestFlight/Prod) tez tekshirish uchun shu skript aynan
# o'sha yo'ldan — devices jadvalidagi push_token + EXPO_ACCESS_TOKEN —
# Expo'ga to'g'ridan-to'g'ri bitta xabar yuboradi.
#
# BU SKRIPT PROD'DA ISHLAYDI. Sirlarni o'zi .env dan oladi, ekranga chiqarmaydi.
# Claude .env va prod bazaga tegmaydi — buni FAQAT siz ishga tushirasiz.
#
# TALAB: bash, psql, curl. DATABASE_URL va EXPO_ACCESS_TOKEN .env da bo'lsin.
#
# ISHLATISH:
#   bash send-test-push.sh <telefon-yoki-userId> [sarlavha] [matn] [env-fayl]
#
# MISOL:
#   bash send-test-push.sh +998901234567
#   bash send-test-push.sh +998901234567 "LookSave" "Push ishlayapti ✅"
#   bash send-test-push.sh 7b1e...uuid "Test" "Salom" /srv/looksave/apps/api/.env
#
set -euo pipefail

TARGET="${1:-}"
TITLE="${2:-LookSave}"
BODY="${3:-Bu sinov bildirishnomasi ✅}"
ENV_FILE="${4:-}"

if [[ -z "$TARGET" ]]; then
  echo "Xato: foydalanuvchi (telefon yoki userId) berilmagan." >&2
  echo "Ishlatish: bash send-test-push.sh <telefon-yoki-userId> [sarlavha] [matn] [env-fayl]" >&2
  exit 1
fi

# .env ni topish: argument → shu skript yonidagi ../.env → joriy papkadagi .env
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -z "$ENV_FILE" ]]; then
  for cand in "$SCRIPT_DIR/../.env" "./.env" "$SCRIPT_DIR/../../.env"; do
    if [[ -f "$cand" ]]; then ENV_FILE="$cand"; break; fi
  done
fi
if [[ -z "$ENV_FILE" || ! -f "$ENV_FILE" ]]; then
  echo "Xato: .env topilmadi. To'rtinchi argument sifatida yo'lini bering." >&2
  exit 1
fi

# .env dan bitta kalitni o'qish — tirnoqlarni va 'export' ni tozalab, EKRANGA CHIQARMASDAN.
read_env() {
  local key="$1"
  local line
  line="$(grep -E "^[[:space:]]*(export[[:space:]]+)?${key}=" "$ENV_FILE" | tail -n1 || true)"
  line="${line#*${key}=}"
  line="${line%$'\r'}"                 # Windows CR
  line="${line#\"}"; line="${line%\"}" # "..."
  line="${line#\'}"; line="${line%\'}" # '...'
  printf '%s' "$line"
}

DATABASE_URL="$(read_env DATABASE_URL)"
EXPO_ACCESS_TOKEN="$(read_env EXPO_ACCESS_TOKEN)"

if [[ -z "$DATABASE_URL" ]]; then
  echo "Xato: .env da DATABASE_URL yo'q." >&2; exit 1
fi
if [[ -z "$EXPO_ACCESS_TOKEN" ]]; then
  echo "Xato: .env da EXPO_ACCESS_TOKEN yo'q (push o'chiq)." >&2; exit 1
fi

# TARGET UUID bo'lsa — to'g'ridan-to'g'ri user_id; aks holda telefon deb qaraladi.
UUID_RE='^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
if [[ "$TARGET" =~ $UUID_RE ]]; then
  USER_ID="$TARGET"
else
  USER_ID="$(psql "$DATABASE_URL" -At -c \
    "SELECT id FROM users WHERE phone = '$(printf '%s' "$TARGET" | sed "s/'/''/g")' LIMIT 1;")"
  if [[ -z "$USER_ID" ]]; then
    echo "Xato: '$TARGET' telefoni bo'yicha foydalanuvchi topilmadi." >&2; exit 1
  fi
fi
echo "Foydalanuvchi: $USER_ID"

# Shu foydalanuvchining barcha push tokenlari (null bo'lmaganlari).
mapfile -t TOKENS < <(psql "$DATABASE_URL" -At -c \
  "SELECT DISTINCT push_token FROM devices
     WHERE user_id = '$USER_ID' AND push_token IS NOT NULL AND push_token <> '';")

if [[ "${#TOKENS[@]}" -eq 0 ]]; then
  echo "Token yo'q. Sabablari: TestFlight ilovada hali kirmagansiz, push ruxsati berilmagan," >&2
  echo "yoki qurilma ro'yxatdan o'tmagan (usePush.ts → POST /devices)." >&2
  exit 2
fi
echo "Topilgan token(lar): ${#TOKENS[@]} ta"

# Har bir tokenga bitta xabar. JSON ni jq bilan xavfsiz quramiz (jq bo'lsa), bo'lmasa oddiy.
send_one() {
  local token="$1"
  local payload
  if command -v jq >/dev/null 2>&1; then
    payload="$(jq -nc --arg to "$token" --arg title "$TITLE" --arg body "$BODY" \
      '[{to:$to,title:$title,body:$body,sound:"default",priority:"high",channelId:"orders"}]')"
  else
    payload="[{\"to\":\"$token\",\"title\":\"$TITLE\",\"body\":\"$BODY\",\"sound\":\"default\",\"priority\":\"high\",\"channelId\":\"orders\"}]"
  fi
  echo "→ ${token:0:24}… ga yuborilmoqda"
  curl -sS -X POST https://exp.host/--/api/v2/push/send \
    -H 'Content-Type: application/json' \
    -H "Authorization: Bearer ${EXPO_ACCESS_TOKEN}" \
    -d "$payload"
  echo
}

for t in "${TOKENS[@]}"; do
  send_one "$t"
done

echo
echo "Tayyor. Yuqoridagi javobda \"status\":\"ok\" bo'lsa — Expo qabul qildi."
echo "iOS'da push 1–2 soniyada keladi. \"DeviceNotRegistered\" chiqsa — token eskirgan"
echo "(ilovani qayta oching, kirib push ruxsatini bering — yangi token yoziladi)."
