# incoming — tashqi kiyim modellari (Sketchfab va boshqalar)

Bu yerga to'g'ridan-to'g'ri `.glb` fayl tashlanadi. Keyin:

```bash
node assets-3d/generator/adopt-external.mjs incoming/<fayl>.glb --slot top --key sketchfab-tshirt
```

Skript modelni ilova formatiga o'tkazadi: masshtab, markazlash, +Y up,
tekstura/material hisoboti, `export/` ga yozish. Keyin `publish.mjs` R2 ga
yuklaydi va bazaga ulaydi.

## Sketchfab'dan qanday yuklab olinadi (siz, hisobga kirgan holda)

1. Modelni oching → **Download 3D Model** tugmasi
2. Format: **glTF** (`.glb` yoki `.zip`) tanlang
3. Yuklab olingan faylni shu papkaga ko'chiring

⚠️ **Litsenziya:** faqat CC0 yoki CC-BY. CC-BY bo'lsa muallif nomini
saqlash kerak — skript uni `credits.json` ga yozadi.

## Nega bu yerda

Sketchfab download API auth (hisobga kirish) talab qiladi — server
avtomatik ololmaydi (401). Shuning uchun fayl qo'lda tashlanadi, qolgan
hammasini skript qiladi.
