# 08 — Deployment va infratuzilma

**Bog'liq:** [01-arxitektura.md](./01-arxitektura.md) · [02-database.md](./02-database.md)

Butun backend **bitta VPS'da**, Docker Compose orqali (K-02). Web panellar Cloudflare Pages'da — VPS'ni yuklamaydi va bepul.

---

## 1. Nima qayerda

| Komponent | Joyi | Narx |
|---|---|---|
| API (Node + Express) | VPS · Docker | VPS ichida |
| PostgreSQL + PostGIS | VPS · Docker | VPS ichida |
| Redis | VPS · Docker | VPS ichida |
| Caddy (TLS, proxy) | VPS · Docker | VPS ichida |
| Do'kon paneli | Cloudflare Pages | $0 |
| Admin paneli | Cloudflare Pages | $0 |
| Landing | Cloudflare Pages | $0 |
| GLB, rasm, backup | Cloudflare R2 | $0 (10 GB) |
| Mobil ilova | EAS Build → App Store / Play | $0 (bepul kvota) |

**Nega panellar Pages'da:** statik build, CDN'dan tarqaladi, VPS trafigini yemaydi, deploy 30 soniya, rollback bir bosish. VPS faqat API bilan shug'ullansin.

---

## 2. VPS

### Tavsiya

| Provayder | Model | Resurs | Narx |
|---|---|---|---|
| **Hetzner** (tavsiya) | CPX41 | 8 vCPU · 16 GB · 240 GB NVMe | ~€30/oy |
| Hetzner (arzonroq boshlash) | CPX31 | 4 vCPU · 8 GB · 160 GB | ~€16/oy |
| Contabo | VPS M | 6 vCPU · 16 GB · 400 GB | ~€13/oy |

**Joylashuv:** Nuremberg yoki Helsinki. Toshkentga ~80-110 ms, Dubayga ~120-140 ms — ikkalasi uchun maqbul. Dubay bozori asosiy bo'lib qolsa, keyinchalik Falkenstein → UAE yaqinidagi provayderga ko'chirish mumkin.

Faza 1 uchun **CPX31 yetarli**. Foydalanuvchi 5 000 dan oshganda CPX41 ga o'ting (Hetzner'da bir bosishda).

### Boshlang'ich sozlash

```bash
# root sifatida kiring
ssh root@<IP>

# 1) Yangilash
apt update && apt upgrade -y

# 2) Foydalanuvchi
adduser deploy
usermod -aG sudo deploy
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy

# 3) SSH qattiqlashtirish
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl restart sshd

# 4) Firewall
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# 5) fail2ban
apt install -y fail2ban
systemctl enable --now fail2ban

# 6) Docker
curl -fsSL https://get.docker.com | sh
usermod -aG docker deploy

# 7) Swap (RAM tugab qolganda baza o'lmasligi uchun)
fallocate -l 4G /swapfile && chmod 600 /swapfile
mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
sysctl vm.swappiness=10
echo 'vm.swappiness=10' >> /etc/sysctl.conf

# 8) Avtomatik xavfsizlik yangilanishlari
apt install -y unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades
```

**Muhim:** PostgreSQL, Redis va API portlari **tashqariga ochilmaydi**. Faqat 80/443. Bazaga kirish kerak bo'lsa — SSH tunnel:

```bash
ssh -L 5432:localhost:5432 deploy@<IP>
# endi lokal 5432 portida baza
```

---

## 3. Papka tuzilmasi

```
/home/deploy/looksave/
├── docker-compose.yml
├── .env                    # 600 huquq, git'da YO'Q
├── Caddyfile
├── migrations/             # 02-database.md dagi SQL fayllar
├── scripts/
│   ├── deploy.sh
│   ├── backup.sh
│   ├── restore.sh
│   └── migrate.sh
└── data/                   # Docker volume'lar
    ├── postgres/
    ├── redis/
    └── caddy/
```

---

## 4. `docker-compose.yml`

```yaml
services:
  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - ./data/caddy/data:/data
      - ./data/caddy/config:/config
    depends_on:
      - api
    networks: [web]

  api:
    image: ghcr.io/${GH_OWNER}/looksave-api:${API_TAG:-latest}
    restart: unless-stopped
    env_file: .env
    environment:
      NODE_ENV: production
      DATABASE_URL: postgres://looksave:${POSTGRES_PASSWORD}@postgres:5432/looksave
      REDIS_URL: redis://redis:6379
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://localhost:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 20s
    deploy:
      resources:
        limits: { memory: 2G }
    networks: [web, internal]

  postgres:
    image: postgis/postgis:16-3.4-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: looksave
      POSTGRES_USER: looksave
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      # Buyurtma raqami va sana formatlari uchun
      POSTGRES_INITDB_ARGS: "--locale=C.UTF-8 --encoding=UTF8"
    volumes:
      - ./data/postgres:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U looksave -d looksave"]
      interval: 10s
      timeout: 5s
      retries: 5
    command: >
      postgres
      -c shared_buffers=2GB
      -c effective_cache_size=6GB
      -c work_mem=32MB
      -c maintenance_work_mem=512MB
      -c max_connections=100
      -c random_page_cost=1.1
      -c shared_preload_libraries=pg_stat_statements
      -c log_min_duration_statement=500
    deploy:
      resources:
        limits: { memory: 6G }
    networks: [internal]

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: >
      redis-server
      --appendonly yes
      --maxmemory 512mb
      --maxmemory-policy allkeys-lru
    volumes:
      - ./data/redis:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5
    networks: [internal]

networks:
  web:
  internal:
    internal: true      # tashqi tarmoqqa chiqmaydi
```

**`internal: true`** — baza va Redis internetga umuman chiqa olmaydi. API ikkala tarmoqda.

**PostgreSQL sozlamalari** 16 GB RAM uchun. 8 GB bo'lsa: `shared_buffers=1GB`, `effective_cache_size=3GB`, limit `3G`.

---

## 5. `Caddyfile`

```
{
	email admin@looksave.app
}

api.looksave.app {
	reverse_proxy api:3000 {
		# SSE uchun buferlash o'chiriladi (07-web-panels.md, 4.4)
		flush_interval -1
	}

	encode zstd gzip

	header {
		Strict-Transport-Security "max-age=31536000; includeSubDomains"
		X-Content-Type-Options "nosniff"
		X-Frame-Options "DENY"
		Referrer-Policy "strict-origin-when-cross-origin"
		-Server
	}

	request_body {
		max_size 12MB
	}

	log {
		output file /data/access.log {
			roll_size 50MB
			roll_keep 5
		}
		format json
	}
}
```

`flush_interval -1` — bu bo'lmasa SSE ishlamaydi, do'kon paneli yangi buyurtmani real vaqtda olmaydi. Tez-tez unutiladigan sozlama.

Caddy TLS sertifikatini avtomatik oladi va yangilaydi — hech narsa qilish kerak emas.

---

## 6. `.env` — barcha o'zgaruvchilar

```bash
# ── Umumiy ──
NODE_ENV=production
PORT=3000
API_URL=https://api.looksave.app
GH_OWNER=umidjon
API_TAG=latest

# ── Baza ──
POSTGRES_PASSWORD=<openssl rand -base64 32>

# ── JWT ──
JWT_ACCESS_SECRET=<openssl rand -base64 48>
JWT_REFRESH_SECRET=<openssl rand -base64 48>
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=30d

# ── Cloudflare R2 ──
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_ASSETS=looksave-assets
R2_BUCKET_BACKUPS=looksave-backups
R2_ENDPOINT=https://<account>.r2.cloudflarestorage.com
CDN_BASE_URL=https://cdn.looksave.app

# ── SMS ──
SMS_PROVIDER=eskiz                 # eskiz | twilio
ESKIZ_EMAIL=
ESKIZ_PASSWORD=
ESKIZ_FROM=4546
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM=

# ── Telegram ──
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=<openssl rand -hex 32>
TELEGRAM_BOT_USERNAME=LookSaveBot

# ── LLM ──
GEMINI_API_KEY=
GROQ_API_KEY=
LLM_PRIMARY=gemini

# ── Google Maps (faqat geocoding, server tomonda) ──
GOOGLE_MAPS_SERVER_KEY=

# ── Push ──
EXPO_ACCESS_TOKEN=

# ── Monitoring ──
SENTRY_DSN=

# ── Biznes qoidalari ──
ORDER_EXPIRY_HOURS=24
MAX_OPEN_ORDERS=3
MAX_DAILY_ORDERS=5
DEFAULT_COMMISSION_RATE=0            # Faza 1-2 da 0 (K-12)
BLOCKLIST_ESCALATION_THRESHOLD=3

# ── CORS ──
CORS_ORIGINS=https://store.looksave.app,https://admin.looksave.app,https://looksave.app
```

```bash
chmod 600 .env
```

**Sirlarni git'ga qo'ymang.** `.env` `.gitignore` da. Namuna sifatida `.env.example` saqlanadi — qiymatlarsiz.

---

## 7. Birinchi deploy

```bash
# 1) DNS: A yozuvlari VPS IP ga
#    api.looksave.app  →  <IP>

# 2) Repozitoriy
cd /home/deploy
git clone git@github.com:umidjon/looksave.git
cd looksave/infra

# 3) .env tayyorlash
cp .env.example .env
nano .env
chmod 600 .env

# 4) Ishga tushirish
docker compose pull
docker compose up -d

# 5) Migratsiyalar
./scripts/migrate.sh

# 6) Tekshirish
curl https://api.looksave.app/health
docker compose ps
docker compose logs -f api
```

### `scripts/migrate.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
source .env

for f in migrations/*.sql; do
  echo "→ $(basename "$f")"
  docker compose exec -T postgres \
    psql -U looksave -d looksave -v ON_ERROR_STOP=1 -f - < "$f"
done
echo "✅ Migratsiyalar bajarildi"
```

> Migratsiyalar **orqaga qaytmaydi**. Har o'zgarish — yangi raqamlangan fayl (02-database.md, 1-bo'lim).

---

## 8. Backup

### Kunlik (cron, 03:00 UTC)

```bash
crontab -e
```
```
0 3 * * * /home/deploy/looksave/infra/scripts/backup.sh >> /var/log/looksave-backup.log 2>&1
```

### `scripts/backup.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
source .env

DATE=$(date +%Y%m%d-%H%M)
FILE="/tmp/looksave-${DATE}.dump"

docker compose exec -T postgres \
  pg_dump -U looksave -d looksave --format=custom --compress=9 > "$FILE"

SIZE=$(stat -c%s "$FILE")
if [ "$SIZE" -lt 10000 ]; then
  echo "❌ Backup juda kichik ($SIZE bayt) — xato bor"
  exit 1
fi

AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
aws s3 cp "$FILE" "s3://${R2_BUCKET_BACKUPS}/db/looksave-${DATE}.dump" \
  --endpoint-url "$R2_ENDPOINT"

rm -f "$FILE"
echo "✅ Backup: looksave-${DATE}.dump ($((SIZE/1024/1024)) MB)"

# 30 kundan eski nusxalarni o'chirish
CUTOFF=$(date -d '30 days ago' +%Y%m%d)
AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
aws s3 ls "s3://${R2_BUCKET_BACKUPS}/db/" --endpoint-url "$R2_ENDPOINT" \
  | awk -v c="$CUTOFF" '{ if (substr($4,10,8) < c) print $4 }' \
  | xargs -r -I{} aws s3 rm "s3://${R2_BUCKET_BACKUPS}/db/{}" --endpoint-url "$R2_ENDPOINT"
```

### Haftalik VPS snapshot

Hetzner panelida yoqiladi — ~€1/oy. Bu butun serverni tiklaydi, faqat bazani emas.

### ⚠️ Oyiga bir marta tiklashni sinang

```bash
./scripts/restore.sh looksave-20260812-0300.dump --to-test-db
```

Backup skripti ishlayotgani — backup ishlayotganini anglatmaydi. **Sinalmagan backup — backup emas.**

Sinov natijasini tekshiring:

```sql
SELECT 'users', COUNT(*) FROM users
UNION ALL SELECT 'stores', COUNT(*) FROM stores
UNION ALL SELECT 'products', COUNT(*) FROM products
UNION ALL SELECT 'orders', COUNT(*) FROM orders;
```

---

## 9. CI/CD

### API — `.github/workflows/api.yml`

```yaml
name: API

on:
  push:
    branches: [main]
    paths: ['apps/api/**', 'packages/**']

jobs:
  build:
    runs-on: ubuntu-latest
    permissions: { contents: read, packages: write }
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm run typecheck
      - run: npm run test --workspace=apps/api

      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - uses: docker/build-push-action@v5
        with:
          context: .
          file: apps/api/Dockerfile
          push: true
          tags: |
            ghcr.io/${{ github.repository_owner }}/looksave-api:latest
            ghcr.io/${{ github.repository_owner }}/looksave-api:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.VPS_HOST }}
          username: deploy
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            cd ~/looksave/infra
            export API_TAG=${{ github.sha }}
            docker compose pull api
            docker compose up -d --no-deps api
            sleep 10
            curl -fsS https://api.looksave.app/health || exit 1
            docker image prune -f
```

Deploy `--no-deps api` bilan — baza va Redis qayta ishga tushmaydi, uzilish ~3 soniya.

### Panellar — Cloudflare Pages

Pages GitHub'ga ulanadi, `main` ga push bo'lganda avtomatik build qiladi:

```
Build command:      npm run build --workspace=apps/store-panel
Build output:       apps/store-panel/dist
Root directory:     /
Environment:        VITE_API_URL=https://api.looksave.app
```

Rollback — Pages panelida bir bosish.

### Mobil — EAS

```yaml
name: Mobile
on:
  push:
    tags: ['mobile-v*']

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - uses: expo/expo-github-action@v8
        with:
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}
      - run: eas build --platform all --profile production --non-interactive
```

---

## 10. Monitoring

### Health endpoint

```ts
app.get('/health', async (req, res) => {
  const checks = { db: false, redis: false };
  try { await db.query('SELECT 1'); checks.db = true; } catch {}
  try { await redis.ping();          checks.redis = true; } catch {}

  const ok = Object.values(checks).every(Boolean);
  res.status(ok ? 200 : 503).json({
    status: ok ? 'ok' : 'degraded',
    checks,
    uptime: process.uptime(),
    version: process.env.API_TAG ?? 'dev',
  });
});
```

### Tashqi kuzatuv

**UptimeRobot** (bepul) — har 5 daqiqada `/health` ni tekshiradi, o'chsa Telegram'ga xabar.

**Sentry** (bepul tarif) — API, panellar va mobil ilova uchun uchta alohida loyiha.

### Loglar

```bash
docker compose logs -f api --tail 200
docker compose logs api --since 1h | grep -i error
```

Loglar hajmini cheklang, aks holda disk to'ladi:

```json
// /etc/docker/daemon.json
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "20m", "max-file": "5" }
}
```

### Haftalik tekshiruv

```bash
df -h                            # disk
free -h                          # RAM
docker stats --no-stream         # konteynerlar
docker compose exec postgres psql -U looksave -d looksave -c "
  SELECT calls, ROUND(mean_exec_time::numeric,2) AS avg_ms, LEFT(query,80)
  FROM pg_stat_statements WHERE mean_exec_time > 50
  ORDER BY total_exec_time DESC LIMIT 10;"
```

---

## 11. Rollback

```bash
# Oldingi versiyaga qaytish
cd ~/looksave/infra
export API_TAG=<oldingi-sha>
docker compose up -d --no-deps api

# Bazani tiklash (faqat jiddiy holatda)
docker compose stop api
./scripts/restore.sh looksave-20260812-0300.dump
docker compose start api
```

**Migratsiya orqaga qaytmaydi.** Agar migratsiya ma'lumotni buzsa, yagona yo'l — backupdan tiklash. Shuning uchun har migratsiyadan **oldin** qo'lda backup oling:

```bash
./scripts/backup.sh && ./scripts/migrate.sh
```

---

## 12. Xavfsizlik ro'yxati

- [ ] SSH parol bilan kirish o'chirilgan, faqat kalit
- [ ] `root` bilan kirish o'chirilgan
- [ ] UFW: faqat 22, 80, 443
- [ ] fail2ban ishlayapti
- [ ] Baza va Redis `internal` tarmoqda, tashqariga ochiq emas
- [ ] `.env` huquqi 600, git'da yo'q
- [ ] Barcha sirlar `openssl rand` bilan generatsiya qilingan
- [ ] JWT sirlari access va refresh uchun **alohida**
- [ ] CORS faqat ma'lum domenlarga
- [ ] Rate limiting yoqilgan (03-api-spec.md, 4-bo'lim)
- [ ] Telegram webhook `secret_token` bilan tekshiriladi
- [ ] Google Maps kaliti cheklangan (package name / referrer)
- [ ] R2 kalitlari faqat kerakli bucket'ga ruxsatli
- [ ] Backup ishlayapti va **sinalgan**
- [ ] `unattended-upgrades` yoqilgan
- [ ] Docker log limitlari o'rnatilgan
- [ ] Sentry'da PII filtri yoqilgan (telefon, manzil yuborilmasin)

---

## 13. Kengaytirish yo'li

Bitta VPS chegarasi — taxminan **50 000 faol foydalanuvchi** yoki sekundiga 200 so'rov. Belgilar:

| Belgi | Chora |
|---|---|
| CPU doim > 70% | VPS'ni kattalashtirish (Hetzner: bir bosish) |
| Baza sekinlashdi | Index tekshirish → keyin alohida serverga |
| API RAM tugayapti | Konteyner limitini oshirish yoki ikkinchi nusxa |
| SSE ulanishlari ko'p | API'ni gorizontal kengaytirish + Redis pub/sub |

**Ajratish tartibi (kerak bo'lganda):**

1. Bazani alohida serverga → faqat `DATABASE_URL` o'zgaradi
2. Redis'ni alohida → `REDIS_URL`
3. API'ni 2-3 nusxaga → Caddy load balancing
4. Read replica → analitika so'rovlari alohida

Kod o'zgarishi talab qilinmaydi — arxitektura shunga tayyor qilingan.

---

## 14. Xarajat

| Modda | Faza 1-2 | 10k foydalanuvchi |
|---|---|---|
| VPS (Hetzner CPX31 → CPX41) | €16 | €30-60 |
| Snapshot | €1 | €2 |
| Cloudflare R2 | $0 | $2-15 |
| Cloudflare Pages | $0 | $0 |
| Google Maps | $0 | $0 |
| Gemini | $0 | $30-150 |
| SMS (Eskiz) | ~$5 | $50-150 |
| Sentry, UptimeRobot | $0 | $0-30 |
| **Jami** | **~$25/oy** | **$150-450/oy** |

---

## 15. Yodda tutish

**Backup — eng muhim band.** Bitta VPS = bitta xavf nuqtasi. Kunlik `pg_dump` → R2, haftalik snapshot, **oyiga bir marta tiklashni sinash**.

**`flush_interval -1` Caddyfile'da.** Bu bo'lmasa SSE ishlamaydi va do'kon paneli yangi buyurtmani ko'rmaydi.

**Migratsiyadan oldin backup.** Har safar, istisnosiz.

**Baza va Redis internetga chiqmasin.** `internal: true` tarmog'i shu uchun.

**Swap yoqing.** RAM tugab qolganda PostgreSQL o'ldiriladi va ma'lumot buzilishi mumkin. 4 GB swap arzon sug'urta.
