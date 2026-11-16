# Facefusion + Cutout API

FastAPI wrapper — o'z VPS'imizda (2026-11-15 gacha fly.io'da edi). Facefusion
(face swap) + birefnet-general-lite (background removal) bitta joyda.
Modellar xotirada turadi (pastda «Tezlik»).

⚠️ **2026-11-15 dan VPS'da yuz almashtirish O'CHIQ** (`FACE_SWAP=off`): xizmat
rasmga faqat kesim qiladi, bitta rasm ~10 soniya. Pastda «Yuz almashtirish
o'chirilgan».

| Fayl | Vazifasi |
| --- | --- |
| `main.py` | HTTP qatlami: yo'llar, navbat, javob sarlavhalari |
| `swap.py` | yuz almashtirishni yurgizadi: issiq ishchi orqali, bo'lmasa CLI bilan |
| `ff_worker.py` | uzoq yashaydigan facefusion jarayoni (facefusion'ning o'z python'ida) |
| `cutout.py` | fon kesish — model alohida bola jarayonda |
| `compose.py` | almashgan yuzni asl rasmga qaytarib qo'yish |

## Endpoints

- `GET /health` — holat, `build` (qaysi kod ishlayapti) va facefusion revizyasi
- `POST /swap` — faqat face swap (any → JPEG)
- `POST /cutout` — faqat fon olib tashlash (any → transparent PNG)
- `POST /swap-and-cutout` — birgalikda (any → transparent PNG, 1 HTTP call)

`FACEFUSION_API_TOKEN` qo'yilgan bo'lsa barcha POST uchun
`Authorization: Bearer <token>` kerak; bo'sh bo'lsa xizmat ochiq.

### Natija har doim ASL O'LCHAMDA

Kesim modeli faqat MASKANI kichik nusxada (`CUTOUT_MAX_SIDE`, 768)
hisoblaydi; maska asl o'lchamga cho'ziladi. Rasmning o'zi kichraytirilmaydi.

### Javob sarlavhalari — chaqiruvchi ularni o'qishi kerak

| Sarlavha | Qiymat | Ma'nosi |
| --- | --- | --- |
| `X-Face-Swap` | `done` | yuz almashdi |
| | `none` | maqsad rasmda yuz topilmadi, rasm O'ZGARMADI (facefusion bunda xato bermaydi) |
| | `off` | almashtirish shu xizmatda o'chirilgan — xato emas, rasmga faqat kesim qilindi |
| `X-Cutout` | `alpha` | rasmning o'z shaffofligi saqlandi, model chaqirilmadi |
| | `model` | shaffoflikni model hisobladi |
| | `failed` | kesim yiqildi — javob almashtirilgan JPEG, shaffof emas |
| `Server-Timing` | `queue;dur=…, swap;dur=…, cutout;dur=…, encode;dur=…, total;dur=…` | har bosqich necha millisekund olgani (`queue` — navbatda kutish) |

Xatolar: `422 no_source_face` — mijozning yuz suratida yuz topilmadi (qayta
urinish foydasiz); `500 facefusion_failed` — CLI yiqildi; `504` — vaqt tugadi.

`swap-and-cutout` da yuzdan boshqa piksellar asl rasmdan o'zgarmay olinadi
(`compose.py`): kiyim JPEG orqali qayta siqilmaydi.

## Yuz almashtirish o'chirilgan (2026-11-15)

Loyiha egasining qarori: «VPS'da rasmning orqa foni bo'lmasa bo'ldi,
silliqlash shart emas, GPT'ning o'z sifati qolsin». VPS'da
`FACE_SWAP="off"` (`vps/.env`): facefusion umuman ishlamaydi, ishchisi ham
ochilmaydi. Yo'llar o'z joyida — API'ni o'zgartirish shart emas:

| Yo'l | `FACE_SWAP=off` da nima qiladi |
| --- | --- |
| `POST /swap-and-cutout` | maqsad rasmga FAQAT kesim (`/cutout` ning o'zi); yuz surati o'qilmaydi ham. `X-Face-Swap: off` |
| `POST /swap` | maqsad rasmni baytma-bayt o'zgarishsiz qaytaradi. `X-Face-Swap: off` |
| `POST /cutout` | o'zgarmagan |

Rasmga nima bo'ladi (VPS'da tekshirilgan):

- **Allaqachon shaffof rasm** (AI fonsiz PNG bergan) — model chaqirilmaydi,
  piksellar ham, alfa ham o'zgarmaydi; ~0.4 s.
- **Fonli rasm** — o'lcham o'sha; figura ichidagi har piksel asl rasmniki
  bilan bir xil (portretda 73%, keng kadrda 27% piksel — hammasi teng); faqat
  fon shaffof bo'ladi va chetdagi tor hoshiya (3.7–4.6%) yumshatiladi; 9–12 s.
- **Rang profili** (bo'lsa) natijaga o'tadi.

Bitta rasm 9–12 soniya (yarim soat bo'sh turgandan keyingi birinchisi
14–18 s). Xotira: bo'sh ~0.6 GB, ish paytida ~12 GB.

⚠️ Mijoz ko'radigan yuz endi AI chizgani — asl yuz qo'yilmaydi. API
(`apps/api/src/integrations/facefusion.ts`) `X-Face-Swap: off` ni `skipped`
deb oladi, ya'ni «begona yuz ketdi» ogohlantirishi chiqmaydi.

Qaytarish: serverda `vps/.env` da `FACE_SWAP="on"`, keyin `./up.sh`.
Yoqilganda xizmat «Tezlik» bo'limidagidek ishlaydi (~28 s, ~17 GB);
`./smoke.sh` ikkala rejimni ham o'zi taniydi.

## Deploy — VPS (2026-11-15 dan)

Xizmat o'z serverimizda: Contabo `13.140.36.214` (12 CPU / 47 GB,
Ubuntu 24.04), papka `/var/www/looksave-face`, Docker Compose. Fayllar —
`vps/`:

| Fayl | Qayerda ishlaydi | Vazifasi |
| --- | --- | --- |
| `deploy.sh` | Mac | kodni serverga ko'chiradi va `up.sh` ni chaqiradi (`fly deploy` o'rniga) |
| `up.sh` | server | Docker (yo'q bo'lsa) → image → xizmat; `--public` bilan HTTPS eshigi ham |
| `smoke.sh` | server | HAQIQIY almashtirish va kesim bilan sinov (FaceFusion namunalari bilan) |
| `docker-compose.yml` | server | `face` (faqat `127.0.0.1:8080`) va `caddy` (HTTPS + ruxsat) |
| `caddy/Caddyfile` | server | kim chaqira oladi, bir vaqtda nechta so'rov |
| `env.example` | server | sozlamalar namunasi; haqiqiysi serverda `vps/.env` |

```bash
cd services/facefusion-api
./vps/deploy.sh            # kod o'zgardi — qayta qurish va yangilash
./vps/deploy.sh --public   # eshik sozlamasi (.env, Caddyfile) ham o'zgardi
```

Birinchi qurish 10–15 daqiqa (facefusion `install.py` og'ir); faqat `*.py`
o'zgargan bo'lsa oxirgi qatlam qayta yig'iladi — bir necha soniya.

Tekshirish — `build` yangi kodni ko'rsatishi kerak:

```bash
curl -s https://face.looksave.uz/health
```

Serverda:

```bash
cd /var/www/looksave-face/vps
docker compose ps                    # holat
docker compose logs --tail 80 face   # xizmat logi
./smoke.sh                           # haqiqiy almashtirish bilan sinov
```

### fly.io beradigan narsalar endi qayerda

| fly.io | VPS |
| --- | --- |
| HTTPS, `facefusion.fly.dev` | Caddy + Let's Encrypt, `face.looksave.uz` (DNS: Eskiz, A yozuv) |
| xizmat hammaga ochiq edi | faqat `API_ALLOW_IPS` (jonli API serveri); `/health` ochiq |
| `hard_limit = 2` | `FACE_MAX_PARALLEL` = 6 (Caddy: ortig'iga darhol 503) |
| disk `facefusion_models` | Docker volume `looksave-face_models` |
| mashina 16 GB | konteyner chegarasi `FACE_MEM_LIMIT` (24 GB) |
| 4 CPU | `FACE_CPUSET` = `0-7` (12 yadrodan 8 tasi; qolgani boshqa ishlarga) |
| o'z init'i | `init: true` (tini) |
| `fly logs` | `docker compose logs face` (5 × 20 MB aylanadi) |

API tomonida bitta qator: `FACEFUSION_URL=https://face.looksave.uz`.

⚠️ API boshqa serverga ko'chsa, uning manzilini `vps/.env` dagi
`API_ALLOW_IPS` ga qo'shish shart — aks holda har so'rov 403 oladi va
mijozga yuzi almashtirilmagan rasm ketadi.

### FaceFusion versiyasi qotirilgan

Dockerfile'dagi `FACEFUSION_REF` — fly.io'da ishlab turgan 3.9.2 revizyasi.
Ilgari `master` olinardi: qatlam keshi yo'q joyda boshqa versiya kelib, CLI
argumentlari jim o'zgarishi mumkin edi. `/health` dagi
`facefusion_revision` qaysi versiya turganini ko'rsatadi. Yangilaganda
`./smoke.sh` bilan sinang.

## Tezlik — modellar xotirada turadi (2026-11-15)

Bu bo'limdagi almashtirish raqamlari `FACE_SWAP=on` rejimiga tegishli;
kesimga oid qismi (oldindan ochilgan ishchi, 8 yadro) ikkala rejimda ham
ishlaydi.

Ilgari har so'rovda `facefusion.py` yangi jarayon bo'lib ochilardi, kesim
modeli ham har safar qayta yuklanardi. VPS'da o'lchanganda bitta rasmning
55–85 soniyasidan yarmidan ko'pi hisob-kitobga emas, tayyorgarlikka
ketayotgani chiqdi:

| Har so'rovda nimaga ketardi | Vaqt |
| --- | --- |
| facefusion: model fayllarini qayta tekshirish (2 GB ni CRC qilish) | ~10 s |
| facefusion: modellarni xotiraga yuklash | ~12–14 s |
| facefusion: python va kutubxonalarning ishga tushishi | ~2–4 s |
| kesim: modelni yuklash | ~9–13 s |

Nima o'zgardi:

- **Facefusion uzoq yashaydigan jarayonda** (`ff_worker.py`). Modellar bir
  marta yuklanadi (~28 s, xizmat ko'tarilganda fonda), so'rov faqat
  hisob-kitobni to'laydi. `swap.py` uni ochadi, kuzatadi va almashtiradi.
- **Kesim ishchisi oldindan ochiladi** (`CUTOUT_PREWARM`): model so'rov
  ichida emas, ikki so'rov orasida yuklanadi. Ketma-ket ishlarda o'sha ishchi
  qayta ishlatiladi; yarim soat bo'sh tursa yopilib, xotirasini qaytaradi.
- **8 yadro** (`FACE_CPUSET`), ip soni aniq beriladi. Yuzning 16 bo'lagi
  ketma-ket emas, 8 tadan parallel hisoblanadi (15.0 s → 11.8 s).

O'lchangan (VPS, 8 yadro, FaceFusion namunalari, `inswapper_128`, 512x512,
kuchaytirgich yoqilgan):

| | Oldin | Hozir |
| --- | --- | --- |
| bitta rasm (`swap-and-cutout`), 2048×1080 | 55–57 s | 26–32 s |
| bitta rasm, portret 1024×1536 | 83 s | 27–33 s |
| faqat kesim (`/cutout`) | 20–24 s | 9–12 s |
| uchta so'rov birdan — oxirgisining javobi | ~170 s (3 × 57, hisob) | 85 s |
| soatiga | 43–65 ta | 110–130 ta |
| band yadrolar | 12 tadan o'rtacha 4.4 | 8 (qolgan 4 tasi bo'sh) |

Hozirgi 26–32 soniya qayerga ketadi: almashtirish ~17 s (shundan 16 bo'lak
~12 s, kontent tekshiruvi ~2 s, kuchaytirgich ~1.5 s), kesim 9.5–14 s
(yangi ochilgan ishchining birinchi ikki kesimi sekinroq), PNG yozish 0.3 s.

**Natija o'zgarmagan.** Eski koddagi to'rt xil chiqish (`swap`,
`swap-and-cutout`, `cutout`, yuzsiz maqsad) yangi koddagi bilan bayt-ma-bayt
bir xil (sha256) — `inswapper_128` da, ikkita turli rasmda tekshirildi.

⚠️ `hyperswap_1a_256` da bayt-ma-bayt tenglik YO'Q, va bu kutilgan: uning
natijasi ip soniga bog'liq (12 ip, 8 ip va 1 ip — uch xil fayl). Farq
yaxlitlash darajasida: yuz sohasidagi piksellarning 0.14% ida, ko'pi bilan
6/255. Ya'ni 12 yadrodan 8 ga o'tishning o'zi shu modelda rasmni shuncha
o'zgartiradi; `inswapper_128` esa ip soniga bog'liq emas. Yangi kodning
natijasi bir ipli hisobniki bilan bir xil.

**Nosozlikda xizmat to'xtamaydi, faqat sekinlashadi** (hammasi sinalgan):

| Nima bo'ldi | Xizmat nima qiladi |
| --- | --- |
| facefusion ishchisi ish o'rtasida o'ldi | o'sha so'rov eski yo'l (CLI) bilan bajariladi, yangi ishchi fonda ko'tariladi |
| ishchi hali isimagan | so'rov 90 s gacha kutadi, keyin CLI |
| ishchi 3 marta ishga tushmadi | 10 daqiqa faqat CLI, keyin yana urinadi |
| ishchi 200 ish bajardi yoki xotirasi 7 GB dan oshdi | yangisiga almashtiriladi (odatda ~5 GB da turadi) |
| kesim ishchisi o'ldi | bir marta yangi ishchi bilan qayta urinadi |

Holatni ko'rish — `warm.state` va `cutout.worker` ikkalasi `ready` bo'lishi kerak:

```bash
curl -s http://127.0.0.1:8080/health
```

O'chirish (xizmat 2026-11-12 dagidek, sekin ishlaydi): `docker-compose.yml`
da `FACEFUSION_WARM` va `CUTOUT_PREWARM` ni olib tashlang,
`CUTOUT_TASKS_PER_WORKER=1` qiling.

### Nega so'rovlar parallel emas, bittalab

Har bosqich berilgan hamma yadroni ishlatadi. Ikki so'rov bir vaqtda ketsa
yadrolar bo'linadi va ikkalasi ham ikki barobar sekinlashadi — jami o'sha
vaqt, lekin birinchi mijoz ham kech oladi. Bittalab ishlaganda uchta
so'rov 29 / 57 / 85 soniyada tayyor bo'ladi; parallel ishlasa uchalasi ham
~85 soniyada tayyor bo'lardi.

### Yana tezlashtirish mumkin, lekin u RASMNI O'ZGARTIRADI

Almashtirishning ~12 soniyasi — yuzning 16 bo'lagi (`pixel_boost=512x512`,
model 128 pikselli). Bu sozlama API'da turadi (`FACEFUSION_PIXEL_BOOST`):
`256x256` da bo'laklar 4 ta, ya'ni taxminan 7 soniya kam (hisob,
o'lchanmagan), lekin yuz tafsiloti kamayadi. Bu tezlik emas, sifat qarori — o'zgartirishdan oldin haqiqiy
rasmlarda yonma-yon solishtirish kerak.

## fly.io (eski joy)

`fly.toml` saqlangan — orqaga qaytish kerak bo'lsa:

```bash
cd services/facefusion-api
flyctl deploy
```

## Lokal sinov (facefusion'siz)

Kesim, yuz sohasini aniqlash va HTTP qatlami haqiqiy model bilan, lekin
soxta facefusion CLI bilan sinaladi:

```bash
uv venv .venv && uv pip install --python .venv/bin/python -r requirements.txt
FACEFUSION_DIR=<soxta facefusion.py turgan papka> FACEFUSION_PY=.venv/bin/python \
  .venv/bin/uvicorn main:app --port 18080
```

## Env

- `FACEFUSION_API_TOKEN` — bearer token(lar), vergul bilan
- `FACEFUSION_TIMEOUT_S` — bitta almashtirishga vaqt (300)
- `CUTOUT_MAX_SIDE` — model ko'radigan nusxa o'lchami (768)
- `CUTOUT_TASKS_PER_WORKER` — kesim ishchisi nechta ishdan keyin almashadi (1; VPS'da 200)
- `FACE_SWAP` — `off` bo'lsa yuz almashtirilmaydi, faqat kesim (sukut `on`; VPS'da `off`)
- `CUTOUT_TIMEOUT_S` — bitta kesimga vaqt (150)

Tezlashtirish (sukut bo'yicha O'CHIQ; VPS'da `vps/docker-compose.yml` yoqadi):

- `FACEFUSION_WARM` — `1` bo'lsa facefusion uzoq yashaydigan ishchida ishlaydi
- `FACEFUSION_WORKER_TASKS` — ishchi nechta ishdan keyin almashadi (200)
- `FACEFUSION_WORKER_MAX_RSS_MB` — yoki xotirasi shundan oshsa (7000)
- `FACEFUSION_WORKER_READY_TIMEOUT_S` — so'rov isimagan ishchini qancha kutadi (90)
- `FACEFUSION_WARM_MODEL`, `FACEFUSION_WARM_PIXEL_BOOST` — oldindan yuklanadigan
  model (`inswapper_128`, `512x512`); boshqasi so'ralsa o'sha so'rovda yuklanadi
- `FACEFUSION_TILE_WORKERS` — yuz bo'laklaridan nechtasi parallel (yadrolar soni; `1` — ketma-ket)
- `CUTOUT_PREWARM` — `1` bo'lsa kesim ishchisi oldindan ochib qo'yiladi
- `CUTOUT_IDLE_RECYCLE_S` — ishlatilgan kesim ishchisi shuncha bo'sh tursa yopiladi (0 — yopilmaydi; VPS'da 1800)
- `CUTOUT_WORKER_MAX_RSS_MB` — kesim ishchisi xotirasi shundan oshsa almashtiriladi (16000)
- `FACE_THREADS` — ip soni; berilmasa konteynerga ajratilgan yadrolar soni

## Xotira — nega kesim alohida jarayonda

Server: 12 CPU / 47 GB; xizmatga 8 yadro va 24 GB berilgan (fly.io'da
4 CPU / 16 GB edi). Xotira (2026-11-15, tezlashtirish yoqilgan):

| Holat | Konteyner xotirasi |
| --- | --- |
| `FACE_SWAP=off` (hozirgi holat): bo'sh / ish paytida | ~0.6 GB / ~12 GB |
| bo'sh (facefusion ishchisi + kutib turgan kesim ishchisi) | ~3.3 GB |
| ish paytida (facefusion ishchisi ~5 GB + kesim ishchisi ~12 GB) | ~17 GB |
| eng yuqorisi (ishchi o'lib, zaxira CLI ham ishlagan sinovda) | 18.9 GB |

Facefusion ishchisi ikkinchi ishdan keyin ~5 GB da to'xtaydi (15 ta ketma-ket
ishda o'smadi). Kesim ishchisi birinchi kesimdan keyin 7.4 GB, ikkinchisidan
keyin 11.9 GB va shu yerda to'xtaydi (29 ta ketma-ket kesimda o'smadi);
yarim soat bo'sh tursa yopiladi.

Tezlashtirishsiz rejimda (2026-11-15 gacha shunday edi) bitta
`swap-and-cutout` 55–57 s, xotira cho'qqisi 9.3–9.7 GB, bo'sh turganda
~165 MB edi.

2026-11-11 da mashina xotira tugab o'ldirildi (`exit_code=137,
oom_killed=true`): rembg sessiyasi API jarayonida turardi va ~20 ta
kesimdan keyin uvicorn 12.7 GB RSS ga yetgan edi; navbatdagi facefusion
(yana bir necha GB) sig'madi. O'sha paytdagi so'rov 502 oldi, ya'ni mijozga
yuzi almashtirilmagan rasm ketdi.

Endi:

- model faqat qisqa umrli bola jarayonda yuklanadi; ish tugagach jarayon
  yopiladi va xotira to'liq qaytadi (lokal o'lchov: bitta ishchi 2.5–5 GB,
  API jarayoni ~120 MB);
- rasm allaqachon shaffof bo'lsa model umuman chaqirilmaydi;
- og'ir ishlar bittalab bajariladi (`_HEAVY`), endpointlar bloklamaydi —
  almashtirish paytida ham `/health` javob beradi (ilgari har almashtirishda
  health check yiqilib, fly.io boshqa so'rovlarni rad etardi).

## Nega bitta joyda

Avval:
- VPS: API + Postgres + Python cutout (3+ GB RAM)
- fly.io: Facefusion

Endi:
- API serveri: faqat API + Postgres (yengil, ~500MB RAM)
- yuz serveri (ilgari fly.io): Facefusion + Cutout (bitta subprocess chain)

Afzalliklar:
- VPS yengillashadi (RAM 91% → ~20%)
- Network: 2 roundtrip → 1 (API ↔ yuz serveri)
- Facefusion subprocess tugashi bilan cutout darhol boshlanadi
