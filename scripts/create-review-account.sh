#!/usr/bin/env bash
#
# App Store Review uchun test hisob yaratadi.
#
# Ishlatilishi:
#   bash scripts/create-review-account.sh
#
# Skript production API (`api.looksave.uz`) ga POST /v1/auth/register
# jo'natadi. Muvaffaqiyat bo'lsa telefon+parolni chop etadi — o'shani
# App Store Connect'ning «Информация для проверки приложения» sahifasiga
# kiritasiz.
#
# ⚠️ RATE LIMIT: bir IP dan soatiga 5 marta. Skriptni qayta-qayta
# ishlatmang.
#
# ⚠️ AGAR «ALREADY_EXISTS» chiqsa — bu telefon raqami allaqachon band.
# Skriptning ichidagi REVIEW_PHONE ni boshqasiga o'zgartiring.
#
# ⚠️ HOZIRGI DEMO AKKAUNT BU SKRIPT BILAN YARATILMAGAN (2026-11-13 dan):
# `+998937844572`, «LookSave Review» — avatari va natijalari tayyor mavjud
# hisob. Bu skript faqat YANGI hisob kerak bo'lganda ishlatiladi. Demo
# akkaunt nimalarni talab qilishi — `docs/17-appstore-review-reply.md` §0.
#
# ⚠️ PAROL REPODA SAQLANMAYDI (repo ochiq). Ilgari shu yerda sukut paroli
# turardi va u git tarixida qolgan — o'sha parolni hech qayerda ishlatmang.
# Parolni muhit orqali bering:
#   REVIEW_PASSWORD='…' bash scripts/create-review-account.sh

set -euo pipefail

API_BASE="${API_BASE:-https://api.looksave.uz}"

# ── App Review uchun test hisob ma'lumotlari ──
# Reviewer buyurtma qilib ko'rmaydi (aloqa qilib turmaymiz), shuning uchun
# raqam «test» diapazonidan. Foydalanuvchi ismini «Apple Review» qildim —
# admin panelda ajratib turadi va tasodifiy o'chirilmaydi.
REVIEW_PHONE="${REVIEW_PHONE:-+998900007777}"
REVIEW_NAME="${REVIEW_NAME:-Apple Review}"
REVIEW_PASSWORD="${REVIEW_PASSWORD:?REVIEW_PASSWORD ni bering — parol repoda saqlanmaydi}"

echo "→ POST ${API_BASE}/v1/auth/register"
echo "   phone:    ${REVIEW_PHONE}"
echo "   fullName: ${REVIEW_NAME}"
echo "   password: ${REVIEW_PASSWORD}"
echo

response=$(curl -sS -w '\n__STATUS__:%{http_code}' -X POST \
  -H 'Content-Type: application/json' \
  -H 'Accept-Language: uz' \
  --data "$(cat <<EOF
{
  "phone": "${REVIEW_PHONE}",
  "fullName": "${REVIEW_NAME}",
  "password": "${REVIEW_PASSWORD}",
  "platform": "ios"
}
EOF
)" \
  "${API_BASE}/v1/auth/register")

body="${response%__STATUS__:*}"
status="${response##*__STATUS__:}"

echo "← HTTP ${status}"
echo "${body}" | (command -v jq >/dev/null && jq . || cat)
echo

if [[ "${status}" == "200" || "${status}" == "201" ]]; then
  cat <<EOF

╭─────────────────────────────────────────────────────╮
│  App Store Connect'ga o'shani kiriting              │
├─────────────────────────────────────────────────────┤
│  Имя пользователя: ${REVIEW_PHONE}
│  Пароль:           ${REVIEW_PASSWORD}
╰─────────────────────────────────────────────────────╯

Endi:
  1. App Store Connect → «Информация для проверки приложения» ni oching.
  2. ☑ «Необходимо войти» belgilangan bo'lsin.
  3. «Имя пользователя» ga telefon raqamini nusxa qiling: ${REVIEW_PHONE}
  4. «Пароль» ga: ${REVIEW_PASSWORD}
  5. Примечания maydoniga (ixtiyoriy) yozing:
     «Кирилл telefon raqami — ilova ichida SMS kod so'ralmaydi (Faza 1).
     Kiyintirish uchun avatar yaratish kerak — ko'rsatmalar ilovada.»
  6. «Сохранить» bosing.
EOF
else
  echo "⚠️  Hisob yaratilmadi. Xato javobiga qarang (yuqorida)."
  case "${body}" in
    *ALREADY_EXISTS*)
      echo "→ Bu telefon raqami band. REVIEW_PHONE ni o'zgartiring:"
      echo "   REVIEW_PHONE='+998900008888' bash scripts/create-review-account.sh"
      ;;
    *NOT_MOBILE*|*INVALID_PHONE*)
      echo "→ Telefon raqami format xato. UZ mobile prefiksdan foydalaning:"
      echo "   90, 91, 93, 94, 95, 97, 98, 99, 33, 88"
      ;;
    *RATE_LIMIT*)
      echo "→ Soatiga 5 martadan ko'p urinib bo'lmaydi. Bir soatdan keyin qayta urining."
      ;;
  esac
  exit 1
fi
