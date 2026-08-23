# 04 — 3D asset pipeline

**Bog'liq:** [01-arxitektura.md](./01-arxitektura.md) · [02-database.md](./02-database.md)

> Bu loyihaning eng ko'p vaqt yeydigan qismi. Bitta kiyim — **8-15 soat**. AI vositalari bu bosqichni tezlashtirmaydi. Butun rejalashtirish shu raqamdan boshlanadi.

---

## ⚠️ 0. Birinchi haftada sinash kerak

Kod yozishdan oldin, **100 ta model yasashdan oldin**, quyidagini real qurilmada sinang:

| Sinov | Nima uchun |
|---|---|
| Draco siqilgan GLB Expo'da ochiladimi | `DRACOLoader` WASM/JS decoder talab qiladi. Hermes'da WASM cheklangan |
| KTX2 tekstura Expo'da ochiladimi | `KTX2Loader` basis transcoder (WASM) ishlatadi — RN'da ishonchsiz |
| Meshopt siqilgan GLB ochiladimi | Draco'ga alternativa, kichikroq decoder |
| 60k poligonli sahna eski Android'da necha FPS | Butun performance byudjeti shunga bog'liq |

**Nega bu muhim:** agar Draco yoki KTX2 ishlamasa, siqish strategiyasi butunlay o'zgaradi — poligonni ko'proq kamaytirish va WebP tekstura ishlatish kerak bo'ladi. Buni 100 ta model tayyorlab bo'lgandan keyin bilib qolsangiz, hammasini qayta qilasiz.

**Zaxira reja (agar WASM ishlamasa):**
- Geometriya: siqishsiz, lekin poligon ≤ 5 000
- Tekstura: WebP 1024×1024 (three.js native qo'llab-quvvatlaydi)
- Fayl hajmi: ~2-2.5 MB (Draco bilan 1.2 MB o'rniga)
- Yechim: agressiv LOD + prefetch

---

## 1. Vositalar

| Vosita | Vazifa | Narx |
|---|---|---|
| **Blender 4.2 LTS** | Modellash, retopology, rigging, eksport | Bepul |
| **Marvelous Designer** | Mato patternidan kiyim (ixtiyoriy, lekin tez) | $50/oy |
| **Substance Painter** | Tekstura | $20/oy |
| Materialize / ArmorPaint | Substance o'rniga bepul variant | Bepul |
| **Mixamo** | Skelet va animatsiyalar | Bepul |
| **gltf-transform CLI** | Optimizatsiya, siqish, LOD | Bepul |
| **glTF Viewer** (gltf.report) | Tekshirish, statistika | Bepul |
| **Meshroom / RealityScan** | Fotogrammetriya (poyabzal uchun qulay) | Bepul |

```bash
npm install -g @gltf-transform/cli
gltf-transform --version
```

---

## 2. Standart skelet

Barcha avatarlar va kiyimlar **bitta skeletda**. Mixamo humanoid rig — sabab: tayyor animatsiyalar bepul va cheksiz.

### Suyak nomlari (o'zgartirilmaydi)

```
mixamorig:Hips
├── mixamorig:Spine
│   └── mixamorig:Spine1
│       └── mixamorig:Spine2
│           ├── mixamorig:Neck
│           │   └── mixamorig:Head
│           │       └── mixamorig:HeadTop_End
│           ├── mixamorig:LeftShoulder
│           │   └── mixamorig:LeftArm
│           │       └── mixamorig:LeftForeArm
│           │           └── mixamorig:LeftHand
│           └── mixamorig:RightShoulder
│               └── … (nosimmetrik)
├── mixamorig:LeftUpLeg
│   └── mixamorig:LeftLeg
│       └── mixamorig:LeftFoot
│           └── mixamorig:LeftToeBase
└── mixamorig:RightUpLeg
    └── … (nosimmetrik)
```

**Qoida:** kiyim eksport qilinganda skelet **qo'shilmaydi** (`Export Skinning: yes`, lekin armature alohida fayl emas). Ilovada tana skeleti yuklanadi, kiyim unga bog'lanadi. Shunday qilinmasa, har bir kiyim bilan skelet takrorlanadi va fayl 3 barobar kattalashadi.

### Socket'lar (aksessuar biriktirish nuqtalari)

| Socket | Ota suyak | Nima biriktiriladi |
|---|---|---|
| `socket_head` | `Head` | Kepka, shlyapa, beanie |
| `socket_face` | `Head` | Ko'zoynak, niqob |
| `socket_neck` | `Neck` | Sharf, marjon |
| `socket_wrist_L` | `LeftHand` | Soat, bilaguzuk |
| `socket_wrist_R` | `RightHand` | Soat, bilaguzuk |
| `socket_foot_L` | `LeftFoot` | Poyabzal (chap) |
| `socket_foot_R` | `RightFoot` | Poyabzal (o'ng) |
| `socket_bag` | `Spine2` | Sumka, ryukzak |

Socket — bo'sh `Empty` obyekt, suyakka `parent` qilingan. Blender'da: `Object → Parent → Bone`.

### Tana mesh'lari (yashirish uchun)

Avatar tanasi bitta mesh emas, **qismlarga bo'linadi** — kiyim ostidagi qismni yashirish uchun:

```
body_head          body_torso         body_hand_L / body_hand_R
body_neck          body_upperArm_L/R  body_thigh_L / body_thigh_R
                   body_forearm_L/R   body_calf_L  / body_calf_R
                                      body_foot_L  / body_foot_R
```

`assets_3d.hide_body_parts` shu nomlarni saqlaydi:

| Kiyim | `hide_body_parts` |
|---|---|
| Futbolka (qisqa yeng) | `["body_torso"]` |
| Ko'ylak (uzun yeng) | `["body_torso","body_upperArm_L","body_upperArm_R","body_forearm_L","body_forearm_R"]` |
| Shim | `["body_thigh_L","body_thigh_R","body_calf_L","body_calf_R"]` |
| Shorti | `["body_thigh_L","body_thigh_R"]` |
| Krossovka | `["body_foot_L","body_foot_R"]` |
| Kepka | `[]` (soch alohida hal qilinadi) |

**Nega kerak:** yashirilmasa, tana kiyim ichidan "qalqib" chiqadi (Z-fighting) — ayniqsa harakatda. Bu eng tez-tez uchraydigan vizual xato.

---

## 3. Blendshape standarti (majburiy)

Tana o'lchami o'zgarganda **kiyim ham u bilan birga o'zgarishi** shart. Buning uchun har bir kiyimda tana bilan **bir xil 6 ta shape key** bo'lishi kerak.

| Shape key nomi | Nima o'zgaradi | Diapazon |
|---|---|---|
| `mt_height` | Bo'y (vertikal cho'zilish) | 0.0 → 1.0 |
| `mt_weight` | Umumiy hajm | 0.0 → 1.0 |
| `mt_shoulderWidth` | Yelka kengligi | 0.0 → 1.0 |
| `mt_chest` | Ko'krak | 0.0 → 1.0 |
| `mt_waist` | Bel | 0.0 → 1.0 |
| `mt_hips` | Son | 0.0 → 1.0 |

`0.5` — neytral holat. Ilova `profiles.morph_targets` dan qiymatlarni oladi va bir vaqtda tanaga ham, barcha kiyimlarga ham qo'llaydi.

### Blender'da yaratish

1. Tana modelidagi shape key'lardan boshlang (ular bir marta yasaladi)
2. Kiyimni neytral tanaga moslang
3. Har bir shape key uchun:
   - Tanada shape key'ni `1.0` ga qo'ying
   - Kiyimni **Surface Deform** modifikatori bilan tanaga bog'lang
   - `Apply as Shape Key` → kiyimda shu nomdagi shape key hosil bo'ladi
4. Tanadagi shape key'ni `0.0` ga qaytaring
5. Keyingi shape key'ga o'ting

Bu Blender'da skript bilan avtomatlashtiriladi:

```python
# blender_scripts/transfer_morphs.py
import bpy

MORPHS = ['mt_height','mt_weight','mt_shoulderWidth',
          'mt_chest','mt_waist','mt_hips']

body = bpy.data.objects['body_torso']
cloth = bpy.context.active_object

# Surface Deform modifikatori
mod = cloth.modifiers.new(name='SD', type='SURFACE_DEFORM')
mod.target = body
bpy.ops.object.surfacedeform_bind(modifier='SD')

for name in MORPHS:
    key = body.data.shape_keys.key_blocks[name]
    key.value = 1.0
    bpy.ops.object.modifier_apply_as_shapekey(keep_modifier=True, modifier='SD')
    cloth.data.shape_keys.key_blocks[-1].name = name
    key.value = 0.0

cloth.modifiers.remove(mod)
print(f'✅ {len(MORPHS)} ta shape key ko'chirildi')
```

### ⚠️ Xarajat ogohlantirishi

Har bir shape key **vertex pozitsiyalarini takrorlaydi**. 6 ta shape key = fayl hajmi ~2-3 barobar oshadi.

**Yechim:**
- Shape key'lar faqat **o'zgargan vertex'larni** saqlaydi (glTF sparse accessor). `gltf-transform` buni avtomatik qiladi
- Aksessuarlarda (soat, ko'zoynak, sumka) shape key **kerak emas** — ular tana o'lchamiga bog'liq emas. `has_morphs: false`
- Poyabzalda ham kerak emas (oyoq razmeri alohida model)

**Shape key kerak:** `top`, `outer`, `bottom`
**Shape key kerak emas:** `head`, `face`, `feet`, `wrist`, `neck`, `bag`

Bu fayl hajmini sezilarli kamaytiradi.

---

## 4. Nomlash va papka tuzilmasi

### Fayl nomi

```
{brend}_{mahsulot-slug}_{rang}_{slot}.glb

nike_air-max-90_black_feet.glb
zara_oversize-hoodie_beige_top.glb
local_leather-jacket_brown_outer.glb
```

Faqat kichik harf, `-` va `_`. Probel, kirill, o'zbek harflari yo'q.

### Papka tuzilmasi

```
assets-3d/
├── _base/                        # bir marta yasaladi
│   ├── body_male_v3.blend
│   ├── body_female_v3.blend
│   ├── skeleton_mixamo.blend
│   └── animations/
│       ├── idle.glb  turn.glb  walk.glb  run.glb  sit.glb
├── source/                       # Blender manba fayllari (repoda emas)
│   └── nike_air-max-90/
│       ├── model.blend
│       ├── textures/
│       │   ├── albedo.png  normal.png  roughness.png
│       └── refs/                 # mahsulot fotolari
├── export/                       # Blender'dan chiqqan xom GLB
│   └── nike_air-max-90_black_feet.glb
└── dist/                         # optimizatsiyadan keyin, R2 ga yuklanadi
    └── nike_air-max-90_black_feet/
        ├── lod0.glb  lod1.glb  lod2.glb
        └── thumb.webp
```

⚠️ `source/` dagi `.blend` fayllar **repoga tushmaydi** (D-37): git-lfs
ishlatilmaydi va og'ir binar fayl tarixni shishiradi. Ular bulutda yoki
tashqi diskda saqlanadi. Repoda faqat `export/` va teksturalar turadi.

---

## 5. Bosqichma-bosqich jarayon

### 1-bosqich: Manba (30 daq)

Har bir mahsulot uchun kerak:
- **4-8 ta foto**: old, orqa, yon, detal (yoqa, tikuv, logo)
- **O'lcham jadvali** do'kondan
- **Rang kodlari** (HEX)

> Do'kondan sifatli foto olish — mijozning javobgarligi. Shartnomaga yozilgan. Sifatsiz foto = sifatsiz model = qayta ish.

### 2-bosqich: Modellash (3-6 soat)

| Kiyim turi | Usul |
|---|---|
| Futbolka, ko'ylak, xudi | Marvelous Designer (pattern) yoki base mesh'ni tahrirlash |
| Kurtka, palto | Marvelous Designer |
| Shim, jinsi | Base mesh + tahrirlash |
| Krossovka, tufli | Blender'da qo'lda yoki fotogrammetriya |
| Kepka, ko'zoynak, soat | Blender'da qo'lda (sodda formalar) |

**Base mesh yondashuvi** — eng tez. Har kategoriya uchun bir marta "shablon" kiyim yasaladi (futbolka, shim, krossovka), keyin har yangi mahsulot uchun forma va tekstura o'zgartiriladi. Bu 3-6 soatni 1-2 soatga tushiradi.

Natija: 50 000 – 200 000 poligon (high-poly).

### 3-bosqich: Retopology (1-2 soat)

High-poly → low-poly.

```
Blender: Modifier → Decimate → Collapse
Ratio: 0.05 – 0.15 (tajriba bilan)
```

Yoki `Quad Remesher` addon (pullik, lekin sifatli).

**Maqsad:**

| Kiyim | Poligon |
|---|---|
| Futbolka, oddiy top | 2 000 – 4 000 |
| Xudi, kurtka (detalli) | 4 000 – 6 000 |
| Shim, jinsi | 3 000 – 5 000 |
| Krossovka | 4 000 – 8 000 |
| Kepka | 1 000 – 2 000 |
| Ko'zoynak, soat | 800 – 2 000 |

**Chegara: 8 000.** Bundan oshsa — qayta retopology.

### 4-bosqich: UV va tekstura (2-3 soat)

1. UV unwrap (Blender: `U → Smart UV Project`, keyin qo'lda tuzatish)
2. High-poly'dan low-poly'ga **normal map bake** (`Bake → Normal`)
3. Substance Painter'da bo'yash yoki fotodan tekstura loyihalash

**Tekstura to'plami:**

| Xarita | O'lcham | Format |
|---|---|---|
| Albedo (rang) | 1024×1024 | PNG → keyin siqiladi |
| Normal | 1024×1024 | PNG |
| Roughness + Metallic | 1024×1024 | PNG (ORM packed) |

**ORM packing:** Occlusion → R, Roughness → G, Metallic → B. Bitta faylda uchta xarita — 3 barobar tejaydi. glTF buni native qo'llab-quvvatlaydi.

Kichik obyektlar (ko'zoynak, soat) uchun 512×512 yetarli.

### 5-bosqich: Rigging (1-2 soat)

**Kiyim (top, outer, bottom) uchun:**
1. Skeletni import qiling (`_base/skeleton_mixamo.blend`)
2. Kiyimni tanlang → Shift+skelet → `Ctrl+P → With Automatic Weights`
3. Weight paint'ni tekshiring (yeng, etak — muammoli joylar)
4. Shape key'larni ko'chiring (yuqoridagi skript)

**Aksessuar (head, face, feet, wrist) uchun:**
1. Skinning **kerak emas**
2. Tegishli socket'ga parent qiling
3. Pozitsiya va burchakni sozlang

### 6-bosqich: Eksport (10 daq)

Blender `File → Export → glTF 2.0 (.glb)`:

```
Format:              glTF Binary (.glb)

── Include ──
☑ Selected Objects
☐ Custom Properties
☐ Cameras
☐ Punctual Lights

── Transform ──
☑ +Y Up

── Data / Mesh ──
☑ Apply Modifiers
☑ UVs
☑ Normals
☐ Tangents            (Draco bilan ziddiyat, three.js o'zi hisoblaydi)
☑ Vertex Colors: None
☐ Loose Edges / Points

── Data / Material ──
Materials: Export
Images: Automatic

── Data / Shape Keys ──
☑ Shape Keys          (faqat top/outer/bottom uchun)
☑ Shape Key Normals
☐ Shape Key Tangents

── Data / Armature ──
☑ Export Deformation Bones Only
☐ Use Rest Position

── Animation ──
☐ Animation           (kiyimda animatsiya YO'Q — tanada bor)

── Compression ──
☐ Draco               (bu bosqichda emas — gltf-transform qiladi)
```

**Muhim:** Draco'ni Blender'da yoqmang. `gltf-transform` yaxshiroq siqadi va LOD yaratishga imkon beradi.

### 7-bosqich: Optimizatsiya (30-60 daq)

```bash
#!/usr/bin/env bash
# scripts/optimize-3d.sh <fayl.glb>
set -euo pipefail

IN="$1"
NAME=$(basename "$IN" .glb)
OUT="dist/$NAME"
mkdir -p "$OUT"

# 1) Keraksiz ma'lumotni tozalash
gltf-transform prune "$IN" /tmp/step1.glb
gltf-transform dedup /tmp/step1.glb /tmp/step2.glb

# 2) Teksturani 1024 ga keltirish + WebP
gltf-transform resize /tmp/step2.glb /tmp/step3.glb --width 1024 --height 1024
gltf-transform webp /tmp/step3.glb /tmp/step4.glb --quality 85

# 3) LOD0 — to'liq sifat, geometriya siqilgan
gltf-transform draco /tmp/step4.glb "$OUT/lod0.glb" --method edgebreaker

# 4) LOD1 — 50% poligon
gltf-transform simplify /tmp/step4.glb /tmp/lod1.glb --ratio 0.5 --error 0.01
gltf-transform draco /tmp/lod1.glb "$OUT/lod1.glb" --method edgebreaker

# 5) LOD2 — 25% poligon, 512 tekstura
gltf-transform simplify /tmp/step4.glb /tmp/lod2a.glb --ratio 0.25 --error 0.02
gltf-transform resize /tmp/lod2a.glb /tmp/lod2b.glb --width 512 --height 512
gltf-transform draco /tmp/lod2b.glb "$OUT/lod2.glb" --method edgebreaker

# 6) Statistika
echo "── $NAME ──"
gltf-transform inspect "$OUT/lod0.glb" | head -30
ls -lh "$OUT"

rm -f /tmp/step*.glb /tmp/lod*.glb
```

**Agar Draco Expo'da ishlamasa** (0-bo'limdagi sinov) — `draco` qadamini `meshopt` ga almashtiring yoki butunlay olib tashlang:

```bash
gltf-transform meshopt /tmp/step4.glb "$OUT/lod0.glb"
# yoki siqishsiz:
cp /tmp/step4.glb "$OUT/lod0.glb"
```

### 8-bosqich: QA va test (1-2 soat)

Quyidagi bo'limga qarang.

---

## 6. QA checklist

Har bir model uchun **majburiy**. Bittasi ham o'tkazib yuborilmaydi.

### Geometriya

- [ ] Poligon ≤ 8 000 (`gltf-transform inspect`)
- [ ] Normal'lar to'g'ri (ichkariga qaragan yuz yo'q)
- [ ] Tuynuk yo'q (`Mesh → Cleanup → Fill Holes`)
- [ ] Duplikat vertex yo'q (`M → By Distance`)
- [ ] Masshtab to'g'ri (odam bo'yi 1.75 birlik ≈ 175 sm)
- [ ] Pivot markazda, `Apply All Transforms` qilingan

### Tekstura

- [ ] Albedo 1024×1024 (kichik obyektda 512)
- [ ] Normal map mavjud
- [ ] UV overlap yo'q
- [ ] Tekstura WebP, sifat 85
- [ ] Rang do'kondagi mahsulotga mos

### Rigging

- [ ] Skelet — standart Mixamo, nomlar o'zgarmagan
- [ ] Weight paint tekshirilgan (yeng, etak, tizza)
- [ ] Animatsiyada kiyim tanadan chiqib ketmaydi (`walk`, `sit` da sinaladi)
- [ ] 6 ta shape key mavjud (`top`/`outer`/`bottom` uchun)
- [ ] Shape key'lar tana bilan sinxron ishlaydi
- [ ] Aksessuar to'g'ri socket'da, pozitsiya to'g'ri

### Fayl

- [ ] `lod0.glb` ≤ 1.5 MB
- [ ] `lod1.glb`, `lod2.glb` mavjud
- [ ] `thumb.webp` mavjud (256×256)
- [ ] Nom konvensiyaga mos
- [ ] Ortiqcha material/tekstura yo'q (`prune` ishlagan)

### Qurilmada test

- [ ] iPhone 12 yoki yangiroq: 60 FPS
- [ ] O'rta Android (Redmi Note 12): ≥ 30 FPS
- [ ] Eski Android (4 GB RAM): ≥ 24 FPS, qotmaydi
- [ ] Yuklanish vaqti < 800 ms (Wi-Fi)
- [ ] RAM o'sishi < 60 MB
- [ ] Boshqa kiyimlar bilan birga sinalgan (jami sahna ≤ 60k poligon)
- [ ] Tana o'lchami o'zgartirilganda kiyim to'g'ri o'zgaradi
- [ ] Tana kiyim ichidan chiqib ketmaydi (`hide_body_parts` to'g'ri)

### QA natijasi bazaga yoziladi

```json
{
  "fps_iphone12": 60,
  "fps_redmi_note12": 38,
  "fps_low_android": 27,
  "load_ms": 640,
  "ram_delta_mb": 42,
  "poly_count": 5840,
  "file_size_kb": 1180,
  "tested_at": "2026-08-12",
  "tested_by": "umidjon"
}
```

→ `assets_3d.qa_result` (02-database.md, 5-bo'lim)

---

## 7. Tez-tez uchraydigan muammolar

| Muammo | Sabab | Yechim |
|---|---|---|
| Tana kiyim ichidan chiqadi | `hide_body_parts` bo'sh yoki noto'g'ri | Bazada to'g'ri ro'yxatni yozing |
| Kiyim harakatda "yirtiladi" | Weight paint noto'g'ri | Yeng va tizza atrofida qayta bo'yang |
| Tana o'lchami o'zgarganda kiyim qolib ketadi | Shape key yo'q yoki nomi boshqa | `mt_*` nomlarini tekshiring |
| Fayl juda katta | Shape key + tekstura | Aksessuarda shape key o'chiring, tekstura 512 ga tushiring |
| Rang telefonda boshqacha | Color space | Albedo — sRGB, normal/roughness — Non-Color |
| Model qora ko'rinadi | Normal'lar teskari | `Mesh → Normals → Recalculate Outside` |
| Yuklanish sekin | Draco yo'q yoki tekstura katta | Optimizatsiya skriptini qayta ishga tushiring |
| Poyabzal oyoqqa mos kelmaydi | Socket pozitsiyasi | `socket_foot_L/R` ni qayta sozlang |
| Ko'zoynak boshdan uzoq | Socket burchagi | `socket_face` transform'ini tuzating |
| FPS past, lekin poligon kam | Draw call ko'p | Material'larni birlashtiring (≤ 3 material) |

---

## 8. Paketli qayta ishlash

Bir necha modelni birdan:

```bash
#!/usr/bin/env bash
# scripts/batch-optimize.sh
set -euo pipefail

mkdir -p dist logs
TOTAL=0; OK=0; FAIL=0

for f in export/*.glb; do
  NAME=$(basename "$f" .glb)
  TOTAL=$((TOTAL+1))
  echo "→ [$TOTAL] $NAME"

  if ./scripts/optimize-3d.sh "$f" > "logs/$NAME.log" 2>&1; then
    SIZE=$(stat -c%s "dist/$NAME/lod0.glb")
    POLY=$(gltf-transform inspect "dist/$NAME/lod0.glb" \
           | grep -oP 'triangles.*?\K[0-9,]+' | head -1 | tr -d ',')

    if [ "$SIZE" -gt 1572864 ]; then
      echo "  ⚠️  Fayl katta: $((SIZE/1024)) KB (limit 1536)"
    fi
    if [ "${POLY:-0}" -gt 8000 ]; then
      echo "  ⚠️  Poligon ko'p: $POLY (limit 8000)"
    fi
    echo "  ✅ $((SIZE/1024)) KB · $POLY tri"
    OK=$((OK+1))
  else
    echo "  ❌ Xato — logs/$NAME.log ga qarang"
    FAIL=$((FAIL+1))
  fi
done

echo "─────────────────────"
echo "Jami: $TOTAL · ✅ $OK · ❌ $FAIL"
```

### R2 ga yuklash va bazaga yozish

```bash
#!/usr/bin/env bash
# scripts/upload-3d.sh <model-nomi>
set -euo pipefail

NAME="$1"
DIR="dist/$NAME"
BASE="https://cdn.looksave.app/models/$NAME"

for f in lod0 lod1 lod2; do
  aws s3 cp "$DIR/$f.glb" "s3://looksave-assets/models/$NAME/$f.glb" \
    --endpoint-url "$R2_ENDPOINT" \
    --content-type "model/gltf-binary" \
    --cache-control "public, max-age=31536000, immutable"
done

aws s3 cp "$DIR/thumb.webp" "s3://looksave-assets/models/$NAME/thumb.webp" \
  --endpoint-url "$R2_ENDPOINT" --content-type "image/webp" \
  --cache-control "public, max-age=31536000, immutable"

echo "✅ Yuklandi: $BASE/lod0.glb"
```

**`immutable` cache-control muhim:** GLB fayllari hech qachon o'zgarmaydi (o'zgarsa — yangi nom). Brauzer va CDN ularni bir yil keshlaydi, trafik keskin kamayadi.

Model o'zgarsa — versiya qo'shiladi: `nike_air-max-90_black_feet_v2`.

---

## 9. Vaqt va xarajat

### Bitta model

| Bosqich | Birinchi model | Base mesh bilan |
|---|---|---|
| Manba tayyorlash | 0.5 soat | 0.3 soat |
| Modellash | 3-6 soat | 1-2 soat |
| Retopology | 1-2 soat | 0.5 soat |
| UV + tekstura | 2-3 soat | 1-1.5 soat |
| Rigging + shape key | 1-2 soat | 0.5 soat |
| Optimizatsiya | 0.5 soat | 0.2 soat |
| QA + qurilma testi | 1 soat | 0.5 soat |
| **Jami** | **9-15 soat** | **4-6 soat** |

**Base mesh strategiyasi ikki barobar tejaydi.** Har kategoriya uchun bir marta shablon yasang: futbolka, xudi, shim, krossovka, kepka. Keyin har yangi mahsulot — shablonni o'zgartirish.

Shablonlar yaratish: **5 ta × 12 soat = 60 soat** (bir martalik investitsiya).

### Katalog rejalari

| Modellar | Base mesh'siz | Base mesh bilan | Real vaqt (kuniga 6 soat) |
|---|---|---|---|
| 10 (Faza 1 demo) | 120 soat | 60 + 50 = 110 soat | ~3 hafta |
| 50 (Faza 2) | 600 soat | 60 + 250 = 310 soat | ~2 oy |
| 150 (Faza 3) | 1 800 soat | 60 + 750 = 810 soat | ~5.5 oy |

**Xulosa:** 3D katalog — alohida, uzun ish oqimi. Ilova ishlab chiqish bilan **parallel** borishi kerak, ketma-ket emas.

### Autsors qilish variantlari

Bir o'zingiz 150 ta model yasashingiz shart emas:

| Manba | Narx (bitta model) | Sifat |
|---|---|---|
| Fiverr / Upwork frilanser | $30-80 | O'zgaruvchan, portfolio ko'ring |
| O'zbekistondagi 3D artist | $20-50 | Nazorat oson |
| Tayyor model bozorlari (Sketchfab, TurboSquid) | $10-40 | Litsenziyani tekshiring |
| Do'kon o'zi buyurtma qiladi | $0 (sizga) | Faza 3 modeli |

**Uzoq muddatli yechim:** do'konlar o'z mahsulotlari uchun 3D model buyurtma qilishadi (SaaS xizmati sifatida). Bu deckdagi "SaaS tools — brand revenue" bandiga to'g'ri keladi.

---

## 10. Ilova tomonidagi yuklash

```ts
// src/three/AssetLoader.ts (soddalashtirilgan)

const memCache = new Map<string, THREE.Group>();

async function loadGarment(
  variantId: string,
  urls: { lod0: string; lod1: string; lod2: string },
  quality: 'low' | 'medium' | 'high'
): Promise<THREE.Group> {

  // 1. Xotira keshi
  const cached = memCache.get(variantId);
  if (cached) return cached.clone();

  const url = quality === 'high' ? urls.lod0
            : quality === 'medium' ? urls.lod1
            : urls.lod2;

  // 2. Disk keshi
  const localPath = `${FileSystem.cacheDirectory}glb/${variantId}-${quality}.glb`;
  const info = await FileSystem.getInfoAsync(localPath);

  if (!info.exists) {
    // 3. CDN
    await FileSystem.downloadAsync(url, localPath);
  }

  const gltf = await gltfLoader.loadAsync(localPath);

  // 4. Xotiraga (limit 12 ta model)
  if (memCache.size >= 12) {
    const oldest = memCache.keys().next().value;
    memCache.get(oldest)?.traverse(disposeObject);
    memCache.delete(oldest);
  }
  memCache.set(variantId, gltf.scene);

  return gltf.scene.clone();
}
```

### Prefetch

```ts
// Faol slotdagi keyingi 2 va oldingi 2 modelni fonda yuklash
function prefetchAround(items: TryonItem[], index: number, quality: Quality) {
  [index - 2, index - 1, index + 1, index + 2]
    .filter(i => i >= 0 && i < items.length)
    .forEach(i => {
      loadGarment(items[i].variantId, items[i].lodUrls, quality)
        .catch(() => {});   // jim yiqiladi, foydalanuvchi sezmaydi
    });
}
```

### Sifatni avtomatik tanlash

```ts
// FPS pasaysa — sifatni tushirish
let frames = 0, lastCheck = Date.now();

function onFrame() {
  frames++;
  const now = Date.now();
  if (now - lastCheck < 3000) return;

  const fps = frames / ((now - lastCheck) / 1000);
  frames = 0; lastCheck = now;

  if (fps < 24 && quality !== 'low')  setQuality('low');
  else if (fps < 40 && quality === 'high') setQuality('medium');
  else if (fps > 55 && quality === 'low')  setQuality('medium');
}
```

Foydalanuvchi sozlamalarda qo'lda ham tanlay olsin — avtomatik tizim doim to'g'ri qaror qilmaydi.

---

## 11. Yodda tutish kerak

**Base mesh'lardan boshlang.** 5 ta shablon (futbolka, xudi, shim, krossovka, kepka) yasashga 60 soat sarflang. Bu keyingi har bir modelni ikki barobar tezlashtiradi.

**Siqishni birinchi haftada sinang.** Draco/KTX2 Expo'da ishlashini 100 ta model yasashdan oldin bilib oling.

**Har bir modelni real telefonda sinang.** Emulyatorda 60 FPS, Redmi'da 18 FPS bo'lishi mumkin.

**Shape key faqat kerak joyda.** Aksessuar va poyabzalda ular fayl hajmini bekorga oshiradi.

**3D ishni ilova bilan parallel olib boring.** Ketma-ket qilsangiz, muddat ikki barobar cho'ziladi.

**Mijozdan sifatli foto talab qiling.** Bu shartnomada yozilgan. Sifatsiz foto — qayta ish va bahs sababi.
