#!/usr/bin/env bash
#
# Mobil ilovani HAQIQIY iPhone'ga qo'yish.  (docs/12-tz.md, IP-06)
#
#   ./scripts/device.sh            # build va ishga tushirish
#   ./scripts/device.sh --pods     # avval `pod install` (kamdan-kam kerak)
#   ./scripts/device.sh --check    # faqat tayyorlikni tekshirish
#
# ⚠️ 3D FAQAT SHU YERDA SINALADI. Simulyator OpenGL ni Metal ustida taqlid
# qiladi va 10 ta ishga tushirishning ~4 tasida chizadi. Kamera (yuz skani),
# push va geolokatsiya ham faqat qurilmada haqiqiy ishlaydi.
#
# UCH NOSTANDART QADAM (2026-08-15 da aniqlangan, memory'da ham bor):
#   1. `pod` har doim RUBYOPT=-rlogger bilan — tizim Ruby 2.6 +
#      CocoaPods 1.15.2 aks holda "uninitialized constant Logger" beradi
#   2. `expo run:ios` --no-install bilan — ichki `pod install` qotib qoladi
#      (13+ daqiqa, 0% CPU)
#   3. Xcode team ID = Y4Z2G3NK2N. `security find-identity` ko'rsatadigan
#      PL4HJFRNR5 — bu SERTIFIKAT ID'si, team emas; u bilan build
#      "No profiles found" bilan yiqiladi

source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

TEAM_ID="Y4Z2G3NK2N"
RUN_PODS=0
CHECK_ONLY=0
while [ $# -gt 0 ]; do
  case "$1" in
    --pods)    RUN_PODS=1 ;;
    --check)   CHECK_ONLY=1 ;;
    -h|--help) usage "$0"; exit 0 ;;
    *) die "noma'lum argument: $1  (--help)" ;;
  esac
  shift
done

cd "$ROOT"

# ── 1. Qurilma ───────────────────────────────────────────────────────────
step "1/4  Qurilma"
DEVICES="$(xcrun devicectl list devices 2>/dev/null | grep -iE "iphone|ipad" || true)"
if [ -z "$DEVICES" ]; then
  warn "ulangan qurilma topilmadi"
  dim "USB bilan ulang, telefonda 'Trust' ni bosing va qulfni oching"
else
  echo "$DEVICES" | sed 's/^/  /'
fi

# ⚠️ UDID `xctrace` DAN OLINADI, `devicectl` DAN EMAS. Ikkalasi HAR XIL
# identifikator beradi: devicectl — CoreDevice UUID (51E2…), xctrace esa
# qurilmaning haqiqiy UDID'i (00008030-…). `expo run:ios --device` ichida
# xctrace ishlatiladi, ya'ni faqat ikkinchisini tanadi.
#
# ⚠️ QIYMATSIZ `--device` ISHLAMAYDI: u qurilmani interaktiv so'raydi va
# skriptdan chaqirilganda "Input is required, but 'npx expo' is in
# non-interactive mode" bilan yiqiladi.
UDID="$(xcrun xctrace list devices 2>/dev/null \
        | grep -iE "^iphone|^ipad" \
        | grep -oE '\(00[0-9A-Fa-f]{6}-[0-9A-Fa-f]{16}\)|\([0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}\)' \
        | head -1 | tr -d '()')"

if [ -n "$UDID" ]; then
  ok "UDID: $UDID"
else
  warn "UDID aniqlanmadi — build qurilmani o'zi so'raydi (interaktiv)"
fi

# `xctrace` "Devices Offline" ro'yxati — qulflangan yoki Trust berilmagan
if xcrun xctrace list devices 2>/dev/null | awk '/Devices Offline/,/^$/' | grep -qiE "iphone|ipad"; then
  warn "xctrace qurilmani OFFLINE deb ko'rsatyapti"
  dim "Telefonni USB bilan ulang, QULFNI OCHING va 'Trust' ni tasdiqlang."
  dim "Wi-Fi orqali ulanish build uchun yetarli emas."
fi

# ── 2. Tarmoq manzili ────────────────────────────────────────────────────
step "2/4  API manzili"

# ⚠️ TELEFONDA `localhost` ISHLAMAYDI — u telefonning o'zini bildiradi.
# Kerak: Mac'ning LAN IP'si. Wi-Fi almashsa bu qiymat eskiradi va ilova
# backendni "topolmaydi" (eng ko'p vaqt yeydigan chalg'ituvchi xato).
LAN_IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)"
CURRENT="$(env_get EXPO_PUBLIC_API_URL "$ROOT/apps/mobile/.env" || true)"

if [ -z "$LAN_IP" ]; then
  warn "Mac'ning LAN IP'si aniqlanmadi (Wi-Fi o'chiqmi?)"
elif [ "$CURRENT" = "http://$LAN_IP:3000" ]; then
  ok "apps/mobile/.env to'g'ri: $CURRENT"
else
  warn "apps/mobile/.env eskirgan"
  # ⚠️ ${VAR:-...} ichida apostrof QO'YMANG — bash uni qo'shtirnoq boshlanishi
  # deb o'qiydi va "unexpected EOF" beradi. Shuning uchun "(belgilanmagan)".
  dim "  hozir:  ${CURRENT:-(belgilanmagan)}"
  dim "  kerak:  http://$LAN_IP:3000"
  dim "  tuzatish:  sed -i '' 's|^EXPO_PUBLIC_API_URL=.*|EXPO_PUBLIC_API_URL=http://$LAN_IP:3000|' apps/mobile/.env"
  dim "  ⚠️ o'zgartirgandan keyin QAYTA BUILD kerak — qiymat build paytida yoziladi"
fi

port_open 3000 && ok "API 3000-portda" || { warn "API ishlamayapti"; dim "  ./scripts/dev-up.sh"; }

# ── 3. Imzo ──────────────────────────────────────────────────────────────
step "3/4  Imzo"
if grep -q "$TEAM_ID" apps/mobile/ios/*.xcodeproj/project.pbxproj 2>/dev/null; then
  ok "team ID o'rnida ($TEAM_ID)"
else
  warn "project.pbxproj da $TEAM_ID yo'q"
  dim "  'prebuild --clean' dan keyin u yo'qoladi va qo'lda qaytariladi"
  dim "  Xcode → Signing & Capabilities → Team"
fi

[ "$CHECK_ONLY" = 1 ] && { printf '\n%sTekshiruv tugadi.%s\n' "$C_OK$C_B" "$C_0"; exit 0; }

# ── 4. Build ─────────────────────────────────────────────────────────────
step "4/4  Build"

if [ "$RUN_PODS" = 1 ]; then
  dim "pod install (RUBYOPT=-rlogger bilan) — ~40 soniya"
  ( cd apps/mobile/ios && RUBYOPT=-rlogger pod install )
  ok "pod'lar yangilandi"
fi

dim "birinchi build 10-20 daqiqa olishi mumkin"
cd apps/mobile

if [ -n "$UDID" ]; then
  exec npx expo run:ios --no-install --device "$UDID"
fi
exec npx expo run:ios --no-install --device
