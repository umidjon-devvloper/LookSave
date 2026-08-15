# infra

VPS'dagi butun backend: API, PostgreSQL+PostGIS, Redis, Caddy — bitta Docker Compose (K-02).

To'liq hujjat: [`docs/08-deployment.md`](../docs/08-deployment.md)

```
infra/
├── docker-compose.yml       # production
├── docker-compose.dev.yml   # lokal: faqat Postgres + Redis
├── Caddyfile                # TLS + reverse proxy
├── .env.example             # → .env (chmod 600, git'da YO'Q)
├── migrations/              # 001…008.sql
├── seeds/
│   └── dev_seed.sql         # test do'konlari — FAQAT dev
├── tests/
│   └── smoke.sql            # sxema + triggerlar tekshiruvi
├── scripts/
│   ├── migrate.sh
│   ├── backup.sh
│   ├── restore.sh
│   └── deploy.sh
└── data/                    # bind-mount volume'lar (git'da yo'q)
```

---

## Lokal ishlab chiqish

API va panellar lokal mashinada ishlaydi, faqat baza Docker'da:

```bash
cd infra
docker compose -f docker-compose.dev.yml up -d
```

```
DATABASE_URL=postgres://looksave:looksave@localhost:5432/looksave
REDIS_URL=redis://localhost:6379
```

Portlar `127.0.0.1` ga bog'langan — tarmoqdan ochilmaydi.

Migratsiyalar va test ma'lumotlari:

```bash
DEV="docker compose -f docker-compose.dev.yml exec -T postgres psql -U looksave -d looksave -v ON_ERROR_STOP=1"
for f in migrations/*.sql; do echo "→ $f"; $DEV -f - < "$f"; done
$DEV -f - < seeds/dev_seed.sql    # test do'konlari (Toshkent + Dubay)
$DEV -f - < tests/smoke.sql       # 10 ta tekshiruv, oxirida ROLLBACK
```

`smoke.sql` hamma qatorda `OK` chiqarishi kerak. Bitta `XATO` — sxemada muammo bor.

---

## Production — birinchi deploy

```bash
# 0) VPS tayyor bo'lsin (docs/08-deployment.md §2: deploy foydalanuvchi, ufw, docker, swap)
cd /home/deploy
git clone git@github.com:umidjon-devvloper/LookSave.git looksave
cd looksave/infra

# 1) DNS: A yozuvi  api.looksave.app → <VPS IP>   (Cloudflare'da "DNS only")

# 2) Sirlar
cp .env.example .env
chmod 600 .env
openssl rand -base64 32   # POSTGRES_PASSWORD
openssl rand -base64 48   # JWT_ACCESS_SECRET
openssl rand -base64 48   # JWT_REFRESH_SECRET  ← access bilan bir xil BO'LMASIN
openssl rand -hex 32      # TELEGRAM_WEBHOOK_SECRET
nano .env

# 3) Ishga tushirish
docker compose pull
docker compose up -d

# 4) Migratsiyalar
./scripts/migrate.sh

# 5) Tekshirish
curl https://api.looksave.app/health
docker compose ps
docker compose logs -f api
```

---

## Kundalik amallar

| Amal              | Buyruq                                                      |
| ----------------- | ----------------------------------------------------------- |
| Deploy / rollback | `./scripts/deploy.sh <sha>`                                 |
| Migratsiya        | `./scripts/backup.sh && ./scripts/migrate.sh`               |
| Backup (qo'lda)   | `./scripts/backup.sh`                                       |
| Tiklashni sinash  | `./scripts/restore.sh <fayl>.dump --to-test-db`             |
| Loglar            | `docker compose logs -f api --tail 200`                     |
| Bazaga kirish     | `docker compose exec postgres psql -U looksave -d looksave` |

Cron (kunlik backup, 03:00 UTC):

```
0 3 * * * /home/deploy/looksave/infra/scripts/backup.sh >> /var/log/looksave-backup.log 2>&1
```

---

## Bilib turish kerak

**Caddy konfiguratsiyasi haqiqiy proksi bilan tekshirildi.** Caddy 2.8.4 ni lokal ishga tushirib, API'ga proksi qildim va quyidagilar tasdiqlandi:

| Tekshiruv                                      | Natija                                   |
| ---------------------------------------------- | ---------------------------------------- |
| SSE oqimi kechikishsiz o'tadi                  | buyurtma va hodisa bir soniyada          |
| Brauzer kabi `Accept-Encoding: gzip` bilan ham | kechikish yo'q, SSE siqilmaydi           |
| Xavfsizlik sarlavhalari                        | HSTS, `nosniff`, `DENY`, Referrer-Policy |
| `Server` sarlavhasi olib tashlangan            | ha                                       |
| `/health` access log'ga tushmaydi              | ha                                       |
| 13 MB tana                                     | `413`                                    |

**Kutilmagan natija:** `flush_interval -1` bo'lmaganda ham SSE ishladi. Caddy 2.x `text/event-stream` javobini o'zi aniqlab, buferlamaydi. Ya'ni hujjatdagi talab zamonaviy Caddy uchun ortiqcha — lekin uni olib tashlamadim: zarar qilmaydi va `Content-Type` o'zgarsa yoki eski Caddy ishlatilsa sug'urta bo'lib qoladi.

Takrorlash uchun: `Caddyfile` dan nusxa oling, domenni `:8080` ga, `reverse_proxy` manzilini lokal API'ga almashtiring, global blokdagi `email` o'rniga `auto_https off` qo'ying va `caddy run --adapter caddyfile` bilan ishga tushiring.

**Migratsiyadan oldin backup.** Migratsiya orqaga qaytmaydi. `migrate.sh` qo'llangan fayllarni `schema_migrations` jadvalida qayd qiladi — takroriy ishga tushirish xavfsiz, lekin qo'llangan faylni **tahrirlash** taqiqlangan (skript checksum bo'yicha to'xtatadi).

**Baza va Redis `internal: true` tarmog'ida.** Internetga umuman chiqa olmaydi, tashqi port ochilmagan. Bazaga kirish faqat SSH tunnel orqali:

```bash
ssh -L 5432:localhost:5432 deploy@<IP>
```

**PostgreSQL sozlamalari RAM'ga bog'liq.** Standart qiymatlar 8 GB (CPX31) uchun. CPX41 (16 GB) ga o'tsangiz `.env` da: `PG_SHARED_BUFFERS=2GB`, `PG_EFFECTIVE_CACHE=6GB`, `PG_MEM_LIMIT=6G`.

**Docker log limitlari** har servisda o'rnatilgan. Qo'shimcha kafolat uchun `/etc/docker/daemon.json`:

```json
{ "log-driver": "json-file", "log-opts": { "max-size": "20m", "max-file": "5" } }
```

**Sinalmagan backup — backup emas.** Oyiga bir marta `restore.sh ... --to-test-db`.
