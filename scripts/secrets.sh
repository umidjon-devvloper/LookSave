#!/usr/bin/env bash
#
# secrets.sh — sirlarni tekshirish va SHIFRLANGAN zaxira olish (D-34).
#
# Buyruqlar:
#   audit            Hozirgi holatni o'lchaydi. Parol so'ramaydi, QIYMAT CHIQARMAYDI
#   backup           Shifrlangan arxiv yasaydi (parolni siz kiritasiz)
#   verify <arxiv>   Arxiv ochiladimi va jonli fayllarga mos keladimi
#
# ⚠️ NEGA SHIFRLASH KERAK. IP-00 da sirlar `~/LookSave-secrets/` ga oddiy
# matn ko'rinishida nusxalangan edi. U `git clean` va repo o'chishidan
# saqlaydi, LEKIN diskning o'zi buzilsa kalitlar ham ketadi — nusxa
# o'sha diskda. Oddiy matnli faylni esa bulutga yoki tashqi diskka
# qo'yib bo'lmaydi: u yerda u yana ochiq yotadi.
#
# Shifrlangan arxivni ISTALGAN joyga qo'yish mumkin — bulut, tashqi disk,
# boshqa mashina. Himoya faylning joyiga emas, parolga bog'lanadi.
#
# ⚠️ PAROL HECH QAYERDA SAQLANMAYDI. Uni `openssl` interaktiv so'raydi,
# skript ko'rmaydi va yozmaydi. Parolni yo'qotsangiz arxiv ochilmaydi —
# uni parol menejeriga qo'ying, arxivning yoniga emas.

set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

# `pbkdf2` — parolni kalitga aylantirishda sekinlashtirish. Usiz OpenSSL
# eski MD5 sxemasiga tushadi va parolni tanlab topish arzonlashadi.
readonly ITER=600000
readonly OUT_DIR="${LOOKSAVE_SECRETS_DIR:-$HOME/LookSave-secrets}"

# Zaxiraga tushadigan fayllar. Yangi `.env` qo'shilsa shu yerga yoziladi —
# aks holda u jimgina zaxiradan tashqarida qoladi (aynan shu bo'lgan).
ENV_FILES=(
  "apps/api/.env"
  "apps/mobile/.env"
  "apps/store-panel/.env"
  "infra/.env"
)

need_openssl() {
  command -v openssl >/dev/null 2>&1 || die "openssl topilmadi"
  # macOS'dagi eski LibreSSL `-pbkdf2` ni bilmaydi — buni oldindan aniqlaymiz,
  # aks holda xato arxiv yasalgandan KEYIN chiqardi
  printf 'x' | openssl enc -aes-256-cbc -pbkdf2 -iter 1000 -pass pass:x >/dev/null 2>&1 ||
    die "openssl '-pbkdf2' ni qo'llab-quvvatlamaydi. brew install openssl"
}

# Fayldagi o'zgaruvchi NOMLARI (qiymatsiz). Zaxira to'liqligini
# qiymatlarni ochmasdan tekshirish uchun.
key_names() { grep -oE '^[A-Za-z_][A-Za-z0-9_]*=' "$1" 2>/dev/null | tr -d '=' | sort; }

# Fayl EGASIDAN boshqasiga ochiqmi.
#
# ⚠️ «Aynan 600 mi?» deb so'rash NOTO'G'RI: 700 va 400 ham xavfsiz —
# guruh va boshqalar uchun bit yo'q. Savol faqat oxirgi ikki raqamda:
# ular nol bo'lsa fayl faqat egasiniki.
others_can_read() { [ "${1: -2}" != "00" ]; }

# ── audit ────────────────────────────────────────────────────────────────
cmd_audit() {
  step "Jonli .env fayllari"
  local found=0
  for rel in "${ENV_FILES[@]}"; do
    local f="$ROOT/$rel"
    [ -f "$f" ] || continue
    found=$((found + 1))
    local perm count
    perm="$(stat -f%Lp "$f")"
    count="$(key_names "$f" | wc -l | tr -d ' ')"
    if others_can_read "$perm"; then
      warn "$rel — $count o'zgaruvchi · huquq $perm — boshqa foydalanuvchi O'QIY OLADI (600 bo'lsin)"
    else
      ok "$rel — $count o'zgaruvchi · huquq $perm"
    fi
  done
  [ "$found" -gt 0 ] || warn "birorta .env topilmadi"

  step "Git tarixi"
  # ⚠️ `.env.example` NAMUNA, sir emas — u istisno qilinadi. Lekin
  # `.env.production` kabi boshqa qo'shimchalar ushlanishi SHART, shuning
  # uchun «.env bilan boshlanadigan hamma narsa» emas, aynan namuna
  # kengaytmalari chiqariladi.
  local leaked
  leaked="$(git -C "$ROOT" log --all --name-only --pretty=format: 2>/dev/null |
    sort -u | grep -E '(^|/)\.env($|\.)' | grep -vE '\.(example|sample|template)$' || true)"
  if [ -n "$leaked" ]; then
    printf '%s\n' "$leaked" | while IFS= read -r f; do warn "$f"; done
    die "sir fayli git tarixida — kalitlarni ALMASHTIRISH kerak (tarixdan o'chirish yetmaydi)"
  fi
  ok "hech qachon commit qilinmagan"

  step "Zaxira: $OUT_DIR"
  if [ ! -d "$OUT_DIR" ]; then
    warn "katalog yo'q — hali zaxira olinmagan"
    return
  fi

  # Shifrlangan arxivlar
  local enc
  enc="$(find "$OUT_DIR" -maxdepth 1 -name '*.tar.gz.enc' 2>/dev/null | sort | tail -1)"
  if [ -n "$enc" ]; then
    ok "oxirgi shifrlangan arxiv: $(basename "$enc")"
  else
    warn "shifrlangan arxiv yo'q — faqat ochiq matnli nusxalar"
  fi

  # Ochiq matnli eski nusxalar: to'liqmi va huquqlari qanday
  local plain
  plain="$(find "$OUT_DIR" -type f -name '.env' 2>/dev/null | sort || true)"
  if [ -n "$plain" ]; then
    local exposed=0
    while IFS= read -r p; do
      [ -z "$p" ] && continue
      local perm; perm="$(stat -f%Lp "$p")"
      others_can_read "$perm" && exposed=$((exposed + 1))
    done <<< "$plain"
    if [ "$exposed" -gt 0 ]; then
      warn "$exposed ta ochiq matnli nusxani boshqa foydalanuvchi o'qiy oladi"
    fi

    # Har jonli fayl uchun eng yangi nusxa BOR-YO'QLIGI
    for rel in "${ENV_FILES[@]}"; do
      [ -f "$ROOT/$rel" ] || continue
      local copy
      copy="$(find "$OUT_DIR" -type f -path "*/$rel" 2>/dev/null | sort | tail -1 || true)"
      if [ -z "$copy" ]; then
        warn "$rel — zaxirada NUSXASI YO'Q"
      elif ! diff -q "$ROOT/$rel" "$copy" >/dev/null 2>&1; then
        warn "$rel — zaxira eskirgan ($(basename "$(dirname "$(dirname "$(dirname "$copy")")")"))"
      fi
    done
  fi

  step "Disk"
  local d1 d2
  d1="$(df -P "$OUT_DIR" 2>/dev/null | tail -1 | awk '{print $1}')"
  d2="$(df -P "$ROOT" | tail -1 | awk '{print $1}')"
  if [ "$d1" = "$d2" ]; then
    warn "zaxira repo bilan BITTA diskda ($d1) — disk buzilsa ikkalasi ham ketadi"
    dim "shifrlangan arxivni tashqi diskka yoki bulutga ko'chiring"
  else
    ok "zaxira boshqa diskda ($d1)"
  fi
}

# ── backup ───────────────────────────────────────────────────────────────
cmd_backup() {
  need_openssl

  local stamp archive tmp
  stamp="$(date +%Y-%m-%d)"
  archive="$OUT_DIR/looksave-secrets-$stamp.tar.gz.enc"
  mkdir -p "$OUT_DIR"
  chmod 700 "$OUT_DIR"

  local present=()
  for rel in "${ENV_FILES[@]}"; do
    [ -f "$ROOT/$rel" ] && present+=("$rel")
  done
  [ "${#present[@]}" -gt 0 ] || die "zaxiraga oladigan .env topilmadi"

  step "Arxivga tushadigan fayllar"
  for rel in "${present[@]}"; do
    dim "$rel — $(key_names "$ROOT/$rel" | wc -l | tr -d ' ') o'zgaruvchi"
  done

  # Manifest — qaysi o'zgaruvchilar ichida ekani, QIYMATSIZ. Arxivni
  # ochmasdan to'liqligini tekshirish uchun.
  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' EXIT
  {
    echo "# LookSave sirlar zaxirasi — $stamp"
    echo "# Faqat o'zgaruvchi NOMLARI. Qiymatlar shifrlangan arxiv ichida."
    for rel in "${present[@]}"; do
      echo ""
      echo "[$rel]"
      key_names "$ROOT/$rel"
    done
  } > "$tmp/MANIFEST.txt"

  step "Parol so'raladi (skript uni ko'rmaydi va saqlamaydi)"
  tar -czf - -C "$ROOT" "${present[@]}" -C "$tmp" MANIFEST.txt |
    openssl enc -aes-256-cbc -pbkdf2 -iter "$ITER" -salt -out "$archive"

  chmod 600 "$archive"
  cp "$tmp/MANIFEST.txt" "$OUT_DIR/looksave-secrets-$stamp.manifest.txt"
  chmod 600 "$OUT_DIR/looksave-secrets-$stamp.manifest.txt"

  ok "$archive ($(du -h "$archive" | cut -f1))"
  dim "manifest (shifrlanmagan, faqat nomlar): looksave-secrets-$stamp.manifest.txt"
  echo ""
  warn "ARXIV HALI O'SHA DISKDA. D-34 shu qadamdan keyin yopiladi:"
  dim "uni tashqi diskka, bulutga yoki parol menejeriga ko'chiring"
  dim "parolni arxivning YONIGA emas, parol menejeriga qo'ying"
}

# ── verify ───────────────────────────────────────────────────────────────
cmd_verify() {
  local archive="${1:-}"
  [ -n "$archive" ] || {
    archive="$(find "$OUT_DIR" -maxdepth 1 -name '*.tar.gz.enc' 2>/dev/null | sort | tail -1 || true)"
    [ -n "$archive" ] || die "arxiv berilmadi va $OUT_DIR da topilmadi"
    dim "oxirgi arxiv: $(basename "$archive")"
  }
  [ -f "$archive" ] || die "topilmadi: $archive"
  need_openssl

  local tmp
  tmp="$(mktemp -d)"
  chmod 700 "$tmp"
  # ⚠️ Ochilgan sirlar vaqtinchalik katalogda qoladi — skript qanday
  # tugasa ham (xato, Ctrl-C) o'chirilishi SHART
  trap 'rm -rf "$tmp"' EXIT INT TERM

  step "Parol so'raladi"
  openssl enc -d -aes-256-cbc -pbkdf2 -iter "$ITER" -in "$archive" |
    tar -xzf - -C "$tmp" || die "ochilmadi — parol noto'g'ri yoki arxiv buzilgan"

  ok "arxiv ochildi"

  step "Jonli fayllar bilan solishtirish"
  local drift=0
  for rel in "${ENV_FILES[@]}"; do
    local live="$ROOT/$rel" back="$tmp/$rel"
    if [ -f "$live" ] && [ ! -f "$back" ]; then
      warn "$rel — arxivda YO'Q"; drift=$((drift + 1))
    elif [ ! -f "$live" ] && [ -f "$back" ]; then
      dim "$rel — arxivda bor, jonlida yo'q"
    elif [ -f "$live" ] && [ -f "$back" ]; then
      if diff -q "$live" "$back" >/dev/null 2>&1; then
        ok "$rel — mos"
      else
        # Farqni NOM darajasida ko'rsatamiz: qiymat chiqmasin
        local only_live only_back
        only_live="$(comm -23 <(key_names "$live") <(key_names "$back") | tr '\n' ' ')"
        only_back="$(comm -13 <(key_names "$live") <(key_names "$back") | tr '\n' ' ')"
        warn "$rel — farq qiladi"
        [ -n "$only_live" ] && dim "arxivda yo'q: $only_live"
        [ -n "$only_back" ] && dim "jonlida yo'q: $only_back"
        [ -z "$only_live$only_back" ] && dim "nomlar bir xil, QIYMAT o'zgargan"
        drift=$((drift + 1))
      fi
    fi
  done

  echo ""
  [ "$drift" -eq 0 ] && ok "zaxira joriy" || warn "$drift ta fayl eskirgan — 'backup' ni qayta yurgizing"
}

case "${1:-}" in
  audit)  cmd_audit ;;
  backup) cmd_backup ;;
  verify) shift; cmd_verify "${1:-}" ;;
  *)      usage "${BASH_SOURCE[0]}" ;;
esac
