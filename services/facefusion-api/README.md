# Facefusion + Cutout API

FastAPI wrapper fly.io'da. Facefusion (face swap) + birefnet-general-lite
(background removal) bitta joyda.

## Endpoints

- `GET /health` — status + model readiness
- `POST /swap` — faqat face swap (JPEG → JPEG)
- `POST /cutout` — faqat fon olib tashlash (any → transparent PNG)
- `POST /swap-and-cutout` — birgalikda (JPEG → transparent PNG, 1 HTTP call)

Barcha POST uchun `Authorization: Bearer <FACEFUSION_API_TOKEN>` kerak.

## Deploy

```bash
cd services/facefusion-api
flyctl deploy
```

Build ~10-15 min (facefusion.install.py og'ir). Model bir martagina
yuklanadi (Dockerfile build paytida cache qilinadi).

## Qanday qilib LookSave backend'da ishlatish

API kodida `facefusion.ts`'ga qo'shimcha endpoint:

```ts
// /swap (hozirgi) → /swap-and-cutout — yangi
const url = `${env().FACEFUSION_URL}/swap-and-cutout`;
```

Natija darhol shaffof PNG qaytaradi — sharp orqali alpha restore
VPS'da endi kerak emas, Python cutout ham VPS'dan olib tashlanadi.

## Env (fly.io secrets)

- `FACEFUSION_API_TOKEN` — API bearer token (joriy token saqlanadi)

## Resource usage

- VM: 4 CPU / 8GB RAM / performance (eski sozlama)
- RAM breakdown:
  - facefusion subprocess: ~2-3GB peak (short-lived)
  - rembg session (birefnet-lite): ~500MB resident, ~1GB peak
  - fastapi + overhead: ~200MB
  - Total peak: ~4-5GB (8GB sig'adi)

## Nega bitta joyda

Avval:
- VPS: API + Postgres + Python cutout (3+ GB RAM)
- fly.io: Facefusion

Endi:
- VPS: faqat API + Postgres (yengil, ~500MB RAM)
- fly.io: Facefusion + Cutout (bitta subprocess chain)

Afzalliklar:
- VPS yengillashadi (RAM 91% → ~20%)
- Network: 2 roundtrip → 1 (API ↔ fly.io)
- Facefusion subprocess tugashi bilan cutout darhol boshlanadi
