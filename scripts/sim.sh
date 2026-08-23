#!/usr/bin/env bash
#
# Mobil ilovani iOS simulyatorda ochish.  (docs/12-tz.md, IP-06)
#
#   ./scripts/sim.sh                      # standart qurilma
#   ./scripts/sim.sh --device "iPhone 17 Pro"
#   ./scripts/sim.sh --list               # mavjud simulyatorlar
#   ./scripts/sim.sh --lan                # API manzilini .env dagicha qoldirish
#
# ⚠️ SIMULYATOR 3D UCHUN ISHONCHSIZ. `src/three/Scene3D.tsx` da o'lchangan:
# simulyator 10 ta ishga tushirishning 4 tasida chizdi, haqiqiy qurilmada
# esa barqaror ishladi — u OpenGL ni Metal ustida taqlid qiladi. Qora ekran
# ko'rsangiz, avval qurilmada tekshiring (./scripts/device.sh), kodni
# tuzatishga oshiqmang.
#
# Simulyatorda ISHONCHLI: ekranlar, navigatsiya, formalar, API, i18n.
# Faqat QURILMADA: 3D, FPS, kamera (yuz skani), push, geolokatsiya.

source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

DEVICE="iPhone 17"
KEEP_LAN=0
while [ $# -gt 0 ]; do
  case "$1" in
    --list)
      xcrun simctl list devices available | sed -n '/-- iOS/,/^--/p'
      exit 0 ;;
    --lan)      KEEP_LAN=1 ;;
    --device)   shift; [ $# -gt 0 ] || die "--device dan keyin qurilma nomi kerak"; DEVICE="$1" ;;
    --device=*) DEVICE="${1#*=}" ;;
    -h|--help)  usage "$0"; exit 0 ;;
    *) die "noma'lum argument: $1  (--help)" ;;
  esac
  shift
done

cd "$ROOT"

# ── 1. Vositalar ─────────────────────────────────────────────────────────
step "1/4  Vositalar"
command -v xcrun >/dev/null 2>&1 || die "Xcode buyruq qatori vositalari yo'q: xcode-select --install"
xcrun simctl help >/dev/null 2>&1 || die "simctl ishlamayapti — Xcode to'liq o'rnatilganini tekshiring"
ok "Xcode $(xcodebuild -version 2>/dev/null | head -1 | awk '{print $2}')"

# ── 2. Backend ───────────────────────────────────────────────────────────
step "2/4  Backend"
if port_open 3000; then
  ok "API 3000-portda"
else
  warn "API ishlamayapti — ilova ma'lumot ololmaydi"
  dim "  ./scripts/dev-up.sh"
fi

# ⚠️ SIMULYATOR ↔ QURILMA FARQI. `.env` dagi EXPO_PUBLIC_API_URL — Mac'ning
# LAN IP'si (haqiqiy telefon uchun kerak). Simulyator esa Mac bilan bir xil
# tarmoq stekida, ya'ni `localhost` ishlaydi VA Wi-Fi almashganda eskirmaydi.
# Shuning uchun simulyator uchun uni bekor qilamiz.
if [ "$KEEP_LAN" = 1 ]; then
  dim "API manzili .env dagicha (--lan)"
else
  export EXPO_PUBLIC_API_URL="http://localhost:3000"
  dim "API manzili: http://localhost:3000 (simulyator uchun; --lan bilan o'chiriladi)"
fi

# ── 3. Simulyatorni ko'tarish ────────────────────────────────────────────
step "3/4  Simulyator: $DEVICE"

UDID="$(xcrun simctl list devices available \
        | grep -F "$DEVICE (" | head -1 \
        | sed -E 's/.*\(([0-9A-F-]{36})\).*/\1/')"
[ -n "$UDID" ] || die "\"$DEVICE\" topilmadi.  ./scripts/sim.sh --list"

STATE="$(xcrun simctl list devices | grep -F "$UDID" | grep -oE '\((Booted|Shutdown)\)' | tr -d '()')"
if [ "$STATE" = Booted ]; then
  ok "allaqachon ishlayapti ($UDID)"
else
  xcrun simctl boot "$UDID"
  ok "ko'tarildi ($UDID)"
fi
open -a Simulator >/dev/null 2>&1 || true

# ── 4. Build va ishga tushirish ──────────────────────────────────────────
step "4/4  Build va ishga tushirish"
dim "birinchi build 5-15 daqiqa olishi mumkin"

# ⚠️ `--no-install`: `expo run:ios` ning ichki `pod install` bosqichi bu
# mashinada qotib qoladi (13+ daqiqa, 0% CPU). Pod'lar allaqachon
# o'rnatilgan; qayta kerak bo'lsa:
#     cd apps/mobile/ios && RUBYOPT=-rlogger pod install
cd apps/mobile
exec npx expo run:ios --no-install --device "$UDID"
