# blender_scripts

Blender 4.2 LTS uchun yordamchi skriptlar. Ular **model yasamaydi** —
modellash sizniki. Skriptlar faqat qo'lda qilinganda xato bo'ladigan
mexanik ishni bajaradi: nomlash, socket bog'lash, shape key ko'chirish,
tekshirish.

Spetsifikatsiya: [`docs/04-3d-pipeline.md`](../docs/04-3d-pipeline.md)

---

## ⚠️ Sinov holati

| Fayl                 | Holat                                                        |
| -------------------- | ------------------------------------------------------------ |
| `looksave_rules.py`  | ✅ 32 test o'tgan                                            |
| `test_rules.py`      | ✅ `python3 test_rules.py`                                   |
| `validate.py`        | ❌ Blender'da ishga tushirilmagan                            |
| `rig_template.py`    | ❌ Blender'da ishga tushirilmagan                            |
| `transfer_morphs.py` | ✅ Ishlaydi — 6 kalit ko'chirildi, o'lchov bilan tasdiqlandi |
| `build_garment.py`   | ✅ Ishlaydi — kiyim 1.5 soniyada yasaladi                    |
| `export_bodies.py`   | ✅ Ishlaydi — 15 mesh, 52 suyak, 6/6 `mt_*` (2026-08-24)     |

Qoidalar (nomlar, byudjetlar, tekshiruvlar) testlangan.

⚠️ Bu yerda ilgari "men Blender'ni ishga tushira olmayman" deb yozilgan edi.
Bu **eskirgan**: Blender 5.2 o'rnatildi va oynasiz rejimda ishlaydi —

    /Applications/Blender.app/Contents/MacOS/Blender --background --python <skript>

`transfer_morphs.py` haqiqiy ma'lumotda sinaldi: `body_torso` dan mato
simulyatsiyasi qilingan futbolkaga 6 ta kalit ko'chirildi va ular to'g'ri
ishlashi o'lchandi — `mt_weight` kenglikni +4.6 sm, `mt_height` balandlikni
+4.6 sm o'zgartiradi, ya'ni har biri o'z o'qiga.

`surfacedeform_bind` Blender 5.2 da muammosiz ishladi.

Test fayl bilan sinang, ishlayotgan `.blend` bilan emas.

---

## Fayllar

### `looksave_rules.py`

Barcha kelishuvlar bitta joyda: suyak nomlari, socket → suyak jadvali,
15 ta tana mesh'i, 6 ta shape key, poligon byudjeti, fayl nomi qoidasi.

`bpy` ni import qilmaydi — shuning uchun Blender'siz sinaladi:

```bash
python3 blender_scripts/test_rules.py
```

Blender'dagi nom o'zgarsa **faqat shu fayl** tuzatiladi.

### `validate.py` — eksportdan oldingi to'siq

```bash
# Tana fayli
blender --background _base/body_male_v3.blend \
        --python blender_scripts/validate.py -- base

# Kiyim
blender --background source/nike_air-max-90/model.blend \
        --python blender_scripts/validate.py -- feet
```

Xato bo'lsa chiqish kodi `1` — eksport zanjirida to'siq sifatida
ishlatiladi.

Tekshiradi: suyak nomlari · socket'lar va ular qaysi suyakda ·
15 ta tana mesh'i · shape key'lar slotga mos kelishi · uchburchak
soni · material soni.

### `rig_template.py` — nomlashni to'g'ri qo'yish

```bash
blender --background mixamo_import.blend \
        --python blender_scripts/rig_template.py -- _base/body_male_v3.blend
```

8 ta socket yaratib suyaklarga bog'laydi, mesh'larga 6 ta bo'sh shape
key qo'shadi. Bir necha marta ishga tushirish xavfsiz — mavjudi
qayta yaratilmaydi.

### `transfer_morphs.py` — shape key'ni kiyimga ko'chirish

```bash
blender --background model.blend \
        --python blender_scripts/transfer_morphs.py -- hoodie_mesh
```

Yoki GUI'da: kiyimni tanlang → Scripting → Run Script.

Surface Deform bilan tanadagi har bir `mt_*` ni kiyimda takrorlaydi.
Bind bo'lmasa aniq sabab aytiladi (kiyim uzoq / n-gon / stack tartibi).

---

## Nega bu skriptlar bor

Uchta xato eng ko'p uchraydi va uchalasi ham **telefonda ochgunga qadar
ko'rinmaydi**:

**1. Suyak nomi o'zgargan.** Blender FBX import qilganda `mixamorig:Hips`
ni `mixamorig_Hips` yoki `mixamorig:Hips.001` ga aylantirishi mumkin.
Natija: kiyim tana skeletiga bog'lanmaydi va bind pozasida qotib
qoladi — tana harakatlanadi, ko'ylak joyida turadi.

**2. Tana bir butun mesh.** `hide_body_parts` mesh nomiga tayanadi.
Tana bo'linmagan bo'lsa hech narsa yashirilmaydi va oyoq krossovka
ichidan chiqib turadi.

**3. Kiyimda shape key yo'q.** Foydalanuvchi o'lchamini o'zgartiradi,
tana kengayadi, ko'ylak eski o'lchamda qoladi.

Uchalasini ham `validate.py` eksportdan **oldin** ushlaydi.

---

## Tartib

```
1. Mixamo'dan skelet         → mixamo.com, "T-Pose" yuklab oling
2. rig_template.py           → socket va shape key nomlari
3. Tanani 15 mesh'ga bo'ling → body_head … body_foot_R
4. Shape key'larni modellang → 6 ta, neytral 0.5
5. validate.py -- base       → o'tmaguncha davom etmang
6. Birinchi kiyim            → transfer_morphs.py → validate.py -- top
7. Eksport → optimizatsiya   → dist/ → R2
8. QURILMADA TEKSHIRING      → keyin qolgan modellar
```

**7-qadamdan 8-qadamga o'tmasdan ko'p model yasamang.** Bitta model
bilan butun zanjirni sinash — 12 soat. Beshta base mesh yasab keyin
zanjir buzuq ekanini bilish — 60 soat.
