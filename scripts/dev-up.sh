#!/usr/bin/env bash
#
# Lokal muhitni bitta buyruq bilan ko'tarish: baza → migratsiya → seed →
# smoke → API.  (docs/12-tz.md, IP-06)
#
#   ./scripts/dev-up.sh              # hammasi
#   ./scripts/dev-up.sh --no-api     # faqat baza (API ni o'zingiz yurgizasiz)
#   ./scripts/dev-up.sh --adopt      # mavjud bazani "migratsiya qilingan" deb belgilash
#   ./scripts/dev-up.sh --fresh      # bazani tozalab noldan qurish (SO'RAYDI)
#
# ⚠️ IKKI MUHIT QO'LLAB-QUVVATLANADI. RUNBOOK Docker'ni nazarda tutadi,
# lekin Postgres.app + brew redis bilan ham hammasi ishlaydi. Skript
# o'zi aniqlaydi — Docker bo'lsa konteynerlarni ko'taradi, bo'lmasa
# lokal portlarni tekshiradi.

source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

FRESH=0; ADOPT=0; NO_API=0; ASSUME_YES=0
for arg in "$@"; do
  case "$arg" in
    --fresh)  FRESH=1 ;;
    --adopt)  ADOPT=1 ;;
    --no-api) NO_API=1 ;;
    --yes|-y) ASSUME_YES=1 ;;
    -h|--help) usage "$0"; exit 0 ;;
    *) die "noma'lum argument: $arg  (--help)" ;;
  esac
done

cd "$ROOT"

# ── 1. Sozlama ───────────────────────────────────────────────────────────
step "1/6  Sozlama"

[ -f apps/api/.env ] || die "apps/api/.env yo'q.  cp apps/api/.env.example apps/api/.env"

DATABASE_URL="$(env_get DATABASE_URL)" || die "apps/api/.env da DATABASE_URL yo'q"
[ -n "$DATABASE_URL" ] || die "DATABASE_URL bo'sh"

PSQL_BIN="$(find_psql)" || die "psql topilmadi. Postgres.app yoki: brew install libpq"
dim "psql: $PSQL_BIN"

# `--single-transaction` bu yerda EMAS: har chaqiruv o'z tranzaksiyasini
# boshqaradi (migratsiyada CONCURRENTLY bo'lishi mumkin).
psql_q() { "$PSQL_BIN" "$DATABASE_URL" -v ON_ERROR_STOP=1 -tAq "$@"; }

if docker_ready; then
  MODE=docker
else
  MODE=local
fi
dim "muhit: $MODE"

# ── 2. Servislar ─────────────────────────────────────────────────────────
step "2/6  Postgres va Redis"

if [ "$MODE" = docker ]; then
  docker compose -f infra/docker-compose.dev.yml up -d >/dev/null
  ok "konteynerlar ko'tarildi"
else
  # Lokal rejimda skript servisni o'zi ko'tarmaydi — ular tizim xizmati
  # (Postgres.app, brew services) va ularni bu yerdan boshqarish
  # kutilmagan qo'shimcha ta'sir bo'lardi.
  port_open 5432 || die "Postgres (5432) ishlamayapti. Postgres.app ni oching yoki: brew services start postgresql@16"
  port_open 6379 || die "Redis (6379) ishlamayapti.  brew services start redis"
  ok "lokal servislar ochiq"
fi

wait_port 5432 "Postgres"
wait_port 6379 "Redis"

psql_q -c 'SELECT 1' >/dev/null 2>&1 || die "bazaga ulanib bo'lmadi — DATABASE_URL ni tekshiring"
PG_VER="$(psql_q -c 'SHOW server_version')"
POSTGIS="$(psql_q -c 'SELECT postgis_version()' 2>/dev/null || echo 'YO4Q')"
[ "$POSTGIS" = 'YO4Q' ] && die "PostGIS o'rnatilmagan — geo-qidiruv ishlamaydi (001_extensions.sql)"
ok "PostgreSQL $PG_VER · PostGIS $POSTGIS"

# ── 3. Fresh (ixtiyoriy, buzuvchi) ───────────────────────────────────────
if [ "$FRESH" = 1 ]; then
  step "3/6  Bazani tozalash"
  TABLES="$(psql_q -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")"
  warn "public sxemasi butunlay o'chiriladi — hozir $TABLES ta jadval bor"

  if [ "$ASSUME_YES" != 1 ]; then
    [ -t 0 ] || die "--fresh interaktiv tasdiq talab qiladi (yoki --yes)"
    printf '  Davom etilsinmi? Bazani yozing (looksave): '
    read -r answer
    [ "$answer" = looksave ] || die "bekor qilindi"
  fi

  psql_q -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;' >/dev/null
  ok "sxema tozalandi"
else
  step "3/6  Bazani tozalash — o'tkazib yuborildi (--fresh emas)"
fi

# ── 4. Migratsiyalar ─────────────────────────────────────────────────────
step "4/6  Migratsiyalar"

# `client_min_messages` — `IF NOT EXISTS` har chaqiruvda NOTICE beradi va u
# chiqishni bekorga ifloslantiradi (jadval bor bo'lishi normal holat).
psql_q -c "SET client_min_messages = warning;
           CREATE TABLE IF NOT EXISTS schema_migrations (
             filename   TEXT PRIMARY KEY,
             checksum   TEXT        NOT NULL,
             applied_at TIMESTAMPTZ NOT NULL DEFAULT now())" >/dev/null

# macOS'da `sha256sum` yo'q — `shasum -a 256` bor. Linux'da teskarisi.
sum256() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | cut -d' ' -f1
  else shasum -a 256 "$1" | cut -d' ' -f1; fi
}

LEDGER="$(psql_q -c 'SELECT count(*) FROM schema_migrations')"
TABLES="$(psql_q -c "SELECT count(*) FROM information_schema.tables
                      WHERE table_schema='public' AND table_name <> 'schema_migrations'")"

# ⚠️ ENG XAVFLI HOLAT: jadvallar bor, lekin qaydnoma bo'sh. Bu — baza
# qo'lda (RUNBOOK dagi for-halqa bilan) migratsiya qilingani. Migratsiyalar
# idempotent EMAS (001 dan boshqasida `IF NOT EXISTS` yo'q), shuning uchun
# ularni qayta yurgizish xato beradi. Skript bu yerda TO'XTAYDI va tanlovni
# odamga qoldiradi.
if [ "$LEDGER" -eq 0 ] && [ "$TABLES" -gt 0 ] && [ "$ADOPT" != 1 ]; then
  warn "bazada $TABLES ta jadval bor, lekin schema_migrations bo'sh"
  dim "Bu — migratsiyalar qo'lda qo'llangani. Ular idempotent emas,"
  dim "qayta yurgizilsa xato beradi. Ikki yo'l:"
  dim "  ./scripts/dev-up.sh --adopt   → mavjudini 'qo'llangan' deb belgilash"
  dim "  ./scripts/dev-up.sh --fresh   → tozalab noldan qurish"
  die "qaror kerak"
fi

applied=0; skipped=0; adopted=0
for f in infra/migrations/*.sql; do
  name="$(basename "$f")"
  checksum="$(sum256 "$f")"
  recorded="$(psql_q -c "SELECT checksum FROM schema_migrations WHERE filename = '$name'")"

  if [ -n "$recorded" ]; then
    [ "$recorded" = "$checksum" ] || die "$name qo'llangandan keyin o'zgartirilgan — migratsiya tahrirlanmaydi, yangi fayl yarating"
    skipped=$((skipped + 1))
    continue
  fi

  if [ "$ADOPT" = 1 ]; then
    psql_q -c "INSERT INTO schema_migrations (filename, checksum) VALUES ('$name','$checksum')" >/dev/null
    adopted=$((adopted + 1))
    continue
  fi

  printf '  → %s\n' "$name"
  # CREATE INDEX CONCURRENTLY tranzaksiya ichida ishlamaydi.
  if grep -qi 'CONCURRENTLY' "$f"; then
    "$PSQL_BIN" "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$f" >/dev/null
  else
    "$PSQL_BIN" "$DATABASE_URL" -v ON_ERROR_STOP=1 -q --single-transaction -f "$f" >/dev/null
  fi
  psql_q -c "INSERT INTO schema_migrations (filename, checksum) VALUES ('$name','$checksum')" >/dev/null
  applied=$((applied + 1))
done

if [ "$ADOPT" = 1 ]; then
  ok "$adopted ta migratsiya 'qo'llangan' deb belgilandi (yurgizilmadi), $skipped ta allaqachon bor edi"
else
  ok "$applied ta qo'llandi · $skipped ta o'tkazib yuborildi"
fi

# ── 5. Seed va smoke ─────────────────────────────────────────────────────
step "5/6  Seed va smoke"

# Seed idempotent emas (hamma INSERT da `ON CONFLICT` yo'q), shuning uchun
# xatosi O'LDIRMAYDI: ma'lumot allaqachon bo'lsa bu normal holat.
if "$PSQL_BIN" "$DATABASE_URL" -v ON_ERROR_STOP=1 -q --single-transaction \
     -f infra/seeds/dev_seed.sql >/dev/null 2>&1; then
  ok "dev_seed.sql qo'llandi"
else
  warn "dev_seed.sql o'tmadi — ma'lumot allaqachon bor (odatdagi holat)"
fi

# smoke.sql BEGIN…ROLLBACK ichida — bazani o'zgartirmaydi.
if "$PSQL_BIN" "$DATABASE_URL" -q -f infra/tests/smoke.sql >/dev/null 2>&1; then
  ok "smoke.sql o'tdi"
else
  warn "smoke.sql yiqildi — sabab uchun:"
  dim "  $PSQL_BIN \"\$DATABASE_URL\" -f infra/tests/smoke.sql"
fi

# ── 6. API ───────────────────────────────────────────────────────────────
step "6/6  API"

if [ "$NO_API" = 1 ]; then
  dim "o'tkazib yuborildi (--no-api)"
elif port_open 3000; then
  HEALTH="$(curl -fsS -m 3 http://127.0.0.1:3000/health 2>/dev/null || true)"
  if [ -n "$HEALTH" ]; then
    ok "allaqachon ishlayapti — $HEALTH"
  else
    warn "3000-port band, lekin /health javob bermayapti. Kim ekanini ko'rish:"
    dim "  lsof -nP -iTCP:3000 -sTCP:LISTEN"
  fi
else
  dim "ishga tushirilmoqda: npm run dev --workspace @looksave/api"
  ( cd apps/api && npm run dev >"$ROOT/.dev-api.log" 2>&1 & echo $! > "$ROOT/.dev-api.pid" )
  wait_port 3000 "API" 40
  curl -fsS -m 5 http://127.0.0.1:3000/health >/dev/null 2>&1 \
    && ok "API tayyor — http://127.0.0.1:3000" \
    || { warn "API ko'tarildi, lekin /health javob bermadi"; dim "log: .dev-api.log"; }
fi

printf '\n%sTayyor.%s  To`xtatish: ./scripts/dev-down.sh\n' "$C_OK$C_B" "$C_0"
