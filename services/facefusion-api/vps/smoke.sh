#!/usr/bin/env bash
# SERVERDA ishlaydi: HAQIQIY almashtirish va kesim bilan sinov — xizmatning
# o'ziga (127.0.0.1:8080), tashqi eshiksiz.
#
#   ./smoke.sh                     prod'dagi sozlama bilan (inswapper_128)
#   ./smoke.sh hyperswap_1a_256    boshqa model bilan
#
# Mijoz suratlari ISHLATILMAYDI. Namuna — FaceFusion'ning o'z misollari
# (uning testlari ham aynan shularni yuklaydi). Natijalar: ../smoke/
#
# Birinchi yurgizishda model og'irliklari (~2 GB) yuklanadi — shu bilan
# birinchi haqiqiy mijoz so'rovi kutib qolmaydi.
set -euo pipefail
cd "$(dirname "$0")"

MODEL="${1:-inswapper_128}"
BASE="https://github.com/facefusion/facefusion-assets/releases/download/examples-3.0.0"
OUT="$(cd .. && pwd)/smoke"
mkdir -p "$OUT"

[ -s "$OUT/source.jpg" ] || curl -fsSL -o "$OUT/source.jpg" "$BASE/source.jpg"
[ -s "$OUT/target.mp4" ] || curl -fsSL -o "$OUT/target.mp4" "$BASE/target-1080p.mp4"

# Videoning birinchi kadri — image ichidagi ffmpeg bilan.
if [ ! -s "$OUT/target.jpg" ]; then
  docker run --rm -v "$OUT":/w --entrypoint ffmpeg looksave-face:latest \
    -loglevel error -y -i /w/target.mp4 -frames:v 1 -q:v 2 /w/target.jpg
fi

fail=0

# nom, kutilgan HTTP kodi, yo'l, curl'ning qolgan argumentlari
call() {
  local name=$1 want=$2 path=$3
  shift 3
  local started code took
  started=$(date +%s)
  code=$(curl -sS -m 900 -o "$OUT/$name.out" -D "$OUT/$name.hdr" -w '%{http_code}' \
    "$@" "http://127.0.0.1:8080$path") || code="curl-xato"
  took=$(($(date +%s) - started))

  printf '%-24s HTTP %s  %3ss  %s bayt\n' "$name" "$code" "$took" "$(stat -c %s "$OUT/$name.out" 2>/dev/null || echo 0)"
  grep -iE '^(content-type|x-face-swap|x-cutout|server-timing):' "$OUT/$name.hdr" 2>/dev/null | tr -d '\r' | sed 's/^/    /' || true

  if [ "$code" != "$want" ]; then
    echo "    ✗ kutilgan: HTTP $want"
    head -c 600 "$OUT/$name.out" 2>/dev/null | sed 's/^/    /' || true
    echo
    fail=1
  fi
}

# Sarlavha qiymati kutilgandek ekanini tekshiradi
expect() {
  local name=$1 header=$2 want=$3 got
  got=$(grep -i "^$header:" "$OUT/$name.hdr" 2>/dev/null | tr -d '\r' | awk '{print $2}' || true)
  if [ "$got" != "$want" ]; then
    echo "    ✗ $header: kutilgan «$want», kelgan «${got:-hech narsa}»"
    fail=1
  fi
}

echo "── model: $MODEL ──"

# Ishchilar isib bo'lguncha kutamiz (xizmat yangi ko'tarilgan bo'lsa ~40 s):
# o'lchov odatdagi — «issiq» — holatni ko'rsatsin.
warm_ready() {
  { echo "$1" | grep -q '"warm":{"enabled":false' || echo "$1" | grep -q '"state":"ready"'; } &&
    { echo "$1" | grep -q '"prewarm":false' || echo "$1" | grep -q '"worker":"ready"'; }
}
health=
for _ in $(seq 1 60); do
  health=$(curl -fsS -m 10 http://127.0.0.1:8080/health)
  if warm_ready "$health"; then break; fi
  sleep 3
done
echo "$health"
warm_ready "$health" || echo "⚠️  ishchilar isimadi — vaqtlar sekin (zaxira) yo'lniki bo'ladi"

# Xizmat qaysi rejimda: yuz almashtiradimi yoki faqat fonni kesadimi (FACE_SWAP)
if echo "$health" | grep -q '"face_swap":false'; then
  FACE=off
  NO_SOURCE_CODE=200 # yuz surati o'qilmaydi ham — xato bo'lishi mumkin emas
  NO_TARGET_FACE=off
  echo "REJIM: faqat fon kesiladi (yuz almashtirish o'chiq)"
else
  FACE=done
  NO_SOURCE_CODE=422
  NO_TARGET_FACE=none
  echo "REJIM: yuz almashtiriladi va fon kesiladi"
fi
echo

call "swap-and-cutout-$MODEL" 200 /swap-and-cutout \
  -F "source=@$OUT/source.jpg" -F "target=@$OUT/target.jpg" \
  --form-string "model=$MODEL" --form-string "pixel_boost=512x512" --form-string "enhance=true"
expect "swap-and-cutout-$MODEL" x-face-swap "$FACE"
expect "swap-and-cutout-$MODEL" x-cutout model

# Ikkinchi marta — ketma-ket kelgan so'rovning vaqti (kesim ishchisi ham isigan)
call "swap-and-cutout-$MODEL-2" 200 /swap-and-cutout \
  -F "source=@$OUT/source.jpg" -F "target=@$OUT/target.jpg" \
  --form-string "model=$MODEL" --form-string "pixel_boost=512x512" --form-string "enhance=true"
expect "swap-and-cutout-$MODEL-2" x-face-swap "$FACE"

call cutout 200 /cutout -F "image=@$OUT/target.jpg"
expect cutout x-cutout model

if [ "$FACE" = off ]; then
  # Yuzga tegilmagani: natija oddiy kesimniki bilan baytma-bayt bir xil
  if cmp -s "$OUT/swap-and-cutout-$MODEL.out" "$OUT/cutout.out"; then
    echo "    ✓ swap-and-cutout natijasi = /cutout natijasi (yuzga tegilmagan)"
  else
    echo "    ✗ swap-and-cutout natijasi /cutout nikidan farq qiladi"
    fail=1
  fi
fi

# Allaqachon shaffof rasm: model chaqirilmasligi kerak (tez va `alpha`)
call cutout-again 200 /cutout -F "image=@$OUT/cutout.out"
expect cutout-again x-cutout alpha

call "swap-$MODEL" 200 /swap \
  -F "source=@$OUT/source.jpg" -F "target=@$OUT/target.jpg" \
  --form-string "model=$MODEL" --form-string "pixel_boost=512x512" --form-string "enhance=true"
expect "swap-$MODEL" x-face-swap "$FACE"

if [ "$FACE" = off ]; then
  if cmp -s "$OUT/swap-$MODEL.out" "$OUT/target.jpg"; then
    echo "    ✓ /swap rasmni baytma-bayt o'zgarishsiz qaytardi"
  else
    echo "    ✗ /swap rasmni o'zgartirgan"
    fail=1
  fi
fi

# Yuz suratida yuz yo'q: qayta urinish foydasiz ekanini bildiruvchi 422
if [ ! -s "$OUT/noface.jpg" ]; then
  docker run --rm -v "$OUT":/w --entrypoint python looksave-face:latest \
    -c "from PIL import Image; Image.new('RGB', (640, 640), (120, 130, 140)).save('/w/noface.jpg')"
fi
call no-source-face "$NO_SOURCE_CODE" /swap-and-cutout \
  -F "source=@$OUT/noface.jpg" -F "target=@$OUT/target.jpg" \
  --form-string "model=$MODEL" --form-string "pixel_boost=512x512" --form-string "enhance=true"

# Maqsad rasmda yuz yo'q: xato emas, rasm o'zgarmay qaytadi va buni sarlavha aytadi
call no-target-face 200 /swap-and-cutout \
  -F "source=@$OUT/source.jpg" -F "target=@$OUT/noface.jpg" \
  --form-string "model=$MODEL" --form-string "pixel_boost=512x512" --form-string "enhance=true"
expect no-target-face x-face-swap "$NO_TARGET_FACE"

echo
echo "── natija fayllari ──"
docker run --rm -i -v "$OUT":/w --entrypoint python looksave-face:latest - <<'PY'
from pathlib import Path
from PIL import Image

for path in sorted(Path("/w").glob("*.out")):
    try:
        image = Image.open(path)
        alpha = image.getchannel("A").getextrema() if image.mode == "RGBA" else None
        print(f"{path.name:36} {image.format} {image.mode} {image.size} alfa={alpha}")
    except Exception as exc:  # noqa: BLE001
        print(f"{path.name:36} rasm emas ({exc.__class__.__name__})")
PY

echo
echo "── xotira (konteyner cho'qqisi) ──"
cid=$(docker compose ps -q face)
peak="/sys/fs/cgroup/system.slice/docker-${cid}.scope/memory.peak"
if [ -r "$peak" ]; then
  awk '{printf "eng yuqorisi: %.1f GB\n", $1 / 1073741824}' "$peak"
fi
docker stats --no-stream --format 'hozir: {{.MemUsage}}' "$cid"

echo
if [ "$fail" = 0 ]; then
  echo "✓ HAMMASI O'TDI"
else
  echo "✗ XATO BOR — yuqoriga qarang; xizmat logi: docker compose logs --tail 80 face"
  exit 1
fi
