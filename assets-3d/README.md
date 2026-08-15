# assets-3d

Blender manba fayllari (`.blend`) va eksport qilingan `.glb` modellar.
**Barchasi `git-lfs` orqali saqlanadi** — `.gitattributes` ga qarang.

Ish tartibi va eksport sozlamalari: [`docs/04-3d-pipeline.md`](../docs/04-3d-pipeline.md)

Klon qilgandan keyin:

```bash
git lfs install
git lfs pull
```

⚠️ `git lfs pull` qilinmasa `.blend` va tekstura fayllari 130 baytli
matn ko'rsatkichi bo'lib ochiladi. Blender "faylni o'qib bo'lmadi"
deydi — sabab shu, fayl buzilgan emas.

---

## Tuzilma

| Papka | Nima | Holat |
| --- | --- | --- |
| [`_base/`](./_base) | Tana, skelet, animatsiyalar — bir marta yasaladi | ⏳ bo'sh |
| [`source/`](./source) | Har mahsulot: `.blend`, teksturalar, fotolar | ⏳ bo'sh |
| [`export/`](./export) | Blender'dan chiqqan xom GLB | ⏳ bo'sh |
| [`dist/`](./dist) | LOD'lar va thumbnail — R2 ga yuklanadi | ⏳ bo'sh |

Har papkada o'z `README.md` si bor: nima turishi va nima tekshirilishi.

## Qayerdan boshlanadi

Kritik yo'l shu papkadan o'tadi (10-roadmap §7). Tartib:

1. `_base/body_male_v3.blend` — 15 mesh, 8 socket, 6 shape key
2. `_base/skeleton_mixamo.blend`
3. Bitta sinov modeli (futbolka) → `source/` → `export/` → `dist/`
4. Qurilmada tekshirish: kiyim tana bilan birga harakatlanadimi
5. Qolgan 4 base mesh, keyin katalog

**3-qadamgacha to'xtamang.** Beshta base mesh yasab, keyin birinchi
marta telefonda ochish — 60 soatlik ishni xavf ostiga qo'yish. Bitta
model bilan butun zanjirni sinab ko'ring.

Hozircha ilova **namuna avatar** bilan ishlaydi (kod bilan yasalgan
shakl) — GLB paydo bo'lishi bilan avtomatik almashadi.
