# source — Blender manba fayllari

Har mahsulot o'z papkasida. Papka nomi = fayl nomining birinchi ikki
qismi: `{brend}_{mahsulot-slug}`.

```
nike_air-max-90/
├── model.blend
├── textures/
│   ├── albedo.png
│   ├── normal.png
│   └── roughness.png
└── refs/                 do'kondan olingan fotolar (4-8 ta)
```

⚠️ `.blend` fayllar **repoga tushmaydi** (D-37): git-lfs ishlatilmaydi va
og'ir binar fayl oddiy git'ni shishiradi. Ular bulutda yoki tashqi diskda
saqlanadi, repoda esa faqat eksport natijasi (`../export/*.glb`) turadi.

Teksturalar bu yerda qoladi — WebP, 1024px gacha, ya'ni yengil.

## refs/ — nega saqlanadi

Model qayta ishlanganda (rang qo'shildi, proporsiya tuzatildi) asl foto
kerak bo'ladi. Do'kondan qayta so'rash — bir necha kun kechikish.
Fotoni papkada qoldirish esa bir necha megabayt.
