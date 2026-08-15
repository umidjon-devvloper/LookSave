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

`.blend` va tekstura fayllari **git-lfs** da (`.gitattributes`). Klondan
keyin `git lfs pull` qilinmasa, bu fayllar 130 baytli ko'rsatkich bo'lib
ochiladi va Blender ularni ocholmaydi.

## refs/ — nega saqlanadi

Model qayta ishlanganda (rang qo'shildi, proporsiya tuzatildi) asl foto
kerak bo'ladi. Do'kondan qayta so'rash — bir necha kun kechikish.
Fotoni papkada qoldirish esa bir necha megabayt.
