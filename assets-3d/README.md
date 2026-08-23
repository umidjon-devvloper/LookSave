# assets-3d

Eksport qilingan `.glb` modellar va ularni yasaydigan generator.

Ish tartibi va eksport sozlamalari: [`docs/04-3d-pipeline.md`](../docs/04-3d-pipeline.md)

Klon qilgandan keyin qo'shimcha qadam **kerak emas** — hamma narsa oddiy
git'da. Modellarni qayta yasash:

```bash
node generator/build.mjs
```

⚠️ **git-lfs ISHLATILMAYDI** (D-37). Ilgari `.gitattributes` uni talab
qilardi, lekin LFS hech qachon o'rnatilmagan va git filtrni jim
e'tiborsiz qoldirardi — ya'ni `git lfs pull` hech narsa qilmasdi.

⚠️ **25 MB dan katta fayl repoga qo'yilmaydi.** `.blend` manba fayllari
og'ir, shuning uchun ular bu yerda emas — bulutda yoki tashqi diskda
saqlanadi. Repoda faqat eksport natijasi turadi.

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
