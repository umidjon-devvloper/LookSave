# generator — kod bilan yasalgan GLB modellar

Blender modellari tayyor bo'lgunicha butun zanjirni ishga tushirib turadigan
**vaqtinchalik** modellar. `assets-3d/README.md` dagi 3-qadam aynan shuni
talab qiladi: bitta model bilan zanjirni sinab ko'rish, keyin 60 soatlik
modellashtirishga o'tish.

```bash
node assets-3d/generator/build.mjs      # modellarni yasaydi → export/
node assets-3d/generator/validate.mjs   # qaytadan yuklab tekshiradi
node assets-3d/generator/measure.mjs    # proporsiya va aylanalarni o'lchaydi
node assets-3d/generator/publish.mjs    # R2 + bazaga (--apply bilan bajaradi)
```

## Shaklni qanday o'zgartirish

Geometriya kodiga tegish shart emas — hammasi `lib/profiles.mjs` dagi
raqamlar bilan boshqariladi:

```js
[1.24, 0.175 * chest, 0.135, -0.004],  // ko'krak: balandlik, yon, chuqurlik, siljish
```

O'zgartirgandan keyin **albatta** `measure.mjs` ni yuriting. U ikki narsani
ko'rsatadi:

1. **Nisbatlar** — bosh soni, yelka/bo'y, oyoq/bo'y va h.k. Mezonlar
   jinsga bog'liq: erkak mezonini ayolga qo'llash figurani buzadi.
2. **Aylanalar santimetrda** — ko'krak/bel/son. Bu eng muhimi:
   `apps/mobile/src/sizing.ts` razmerni AYLANAdan hisoblaydi. Birinchi
   urinishda ko'krak 84 sm chiqqan — ya'ni avatar o'zi tavsiya qiladigan
   XS dan ham kichik edi. Hozir erkak 98 sm (M), ayol 93 sm (S).

Kiyim ham SHU profildan quriladi (`shellKeys`), shuning uchun tana
kengaysa kiyim ham kengayadi. `validate.mjs` kiyim tanaga botmaganini
raqam bilan tekshiradi.

## Nima yasaladi

| Fayl | Nima | Hajmi |
| --- | --- | --- |
| `male-base-v1.glb` | Erkak tanasi — 15 mesh, 23 suyak, 8 socket | ~460 KB |
| `female-base-v1.glb` | Ayol tanasi — yelka torroq, son kengroq | ~460 KB |
| `tshirt-*.glb` | Futbolka, 3 rang | ~100 KB |
| `jacket-denim-v1.glb` | Jinsi kurtka | ~100 KB |
| `pants-*.glb` | Shim, 2 rang | ~160 KB |
| `sneakers-*.glb` | Krossovka, 2 rang | ~46 KB |
| `cap-*.glb` | Kepka, 2 rang | ~33 KB |
| `manifest.json` | Qaysi fayl qaysi slotga — yuklash skripti uchun | |

Hammasi hujjatdagi byudjetdan ancha past (04-3d-pipeline §0: ~2-2.5 MB).

## Nima qilinmagan

Bu modellar Blender ishini **almashtirmaydi**. Ular:

- **stilizatsiya qilingan base mesh** — skan emas, teri/soch/yuz qirralari yo'q
- **teksturasiz** — faqat bir tusli material, normal map yo'q
- **qattiq bog'langan** — har tana qismi bitta suyakka to'liq og'irlik bilan.
  Bo'g'imlarda teri cho'zilmaydi. Qismlar alohida mesh bo'lgani uchun
  (04-3d-pipeline §2 talabi) bu ko'zga tashlanmaydi, lekin haqiqiy model
  yumshoq og'irlik taqsimoti bilan bo'lishi kerak
- **LOD'siz va siqilmagan** — `gltf-transform` bosqichi qilinmagan

## Bilib qo'yish kerak bo'lgan uchta narsa

### 1. Kiyimlar skinned emas

Kiyim GLB'larida teri og'irliklari yo'q — ular oddiy mesh. Sabab ilova
kodida: `AvatarScene.tsx` da `AnimationRig` faqat **tanadan** quriladi,
kiyim esa sahnaga alohida qo'shiladi va hech qayerda tana skeletiga qayta
bog'lanmaydi.

**Oqibati:** animatsiya qo'shilganda tana harakatlanadi, kiyim joyida qotib
qoladi. Klip qo'shishdan **oldin** ilovada kiyimni skeletga bog'lash kerak.

### 2. Shape key konvensiyasi teskari

Hujjatga ko'ra `0.5` — neytral holat, lekin oddiy shape key'da `0` asos
bo'ladi. Shuning uchun asos geometriya "kichik" chetga, shape key esa
"katta" chetga qo'yilgan — o'rtasi aynan neytral proporsiyani beradi.
Blender'da model yasaganda **shu konvensiya saqlanishi shart**, aks holda
neytral tanadagi odam ilovada kichkina bo'lib ko'rinadi.

### 3. Suyak nomi yuklashda o'zgaradi

Faylda `mixamorig:Hips`, lekin `GLTFLoader` yuklaganda `mixamorigHips`
bo'lib qoladi — `:` belgisi animatsiya yo'llari sintaksisida band va
`PropertyBinding.sanitizeNodeName` uni olib tashlaydi.

Bu muammo emas: Mixamo klipi ham xuddi shu yo'l bilan yuklanadi va uning
trek nomlari bir xil tozalanadi. Lekin skeletni qo'lda qidirsangiz
(`getObjectByName('mixamorig:Hips')`) topolmaysiz — tozalangan nomni
ishlating.

## Bind pozasi

**A-poza** (qo'llar pastga, tanadan ~12°), T-poza emas. Sabab: hozircha
animatsiya klipi yo'q va ilova avatarni bind pozasida ko'rsatadi —
T-pozada qo'llar yonga cho'zilgan holda qotib turadi. Mixamo A-pozani ham
qabul qiladi, shuning uchun keyin animatsiya qo'shishga xalaqit bermaydi.

## Fayl tuzilishi

```
generator/
├── build.mjs           # kirish nuqtasi
├── validate.mjs        # tuzilma, animatsiya va kiyim o'lchamini tekshiradi
├── measure.mjs         # proporsiya va aylana o'lchovi
├── publish.mjs         # R2 ga yuklaydi va bazaga ulaydi
└── lib/
    ├── glb.mjs         # GLTFExporter + Node uchun FileReader polifill
    ├── skeleton.mjs    # Mixamo suyaklari va socket'lar
    ├── loft.mjs        # kesimlardan sirt qurish
    ├── profiles.mjs    # ⭐ tana o'lchamlari — tana ham, kiyim ham shundan
    ├── shape.mjs       # 6 shape key, teri bog'lash
    ├── body.mjs        # 15 ta tana qismi
    ├── garments.mjs    # kiyimlar katalogi
    └── animations.mjs  # idle / turn / walk / sit
```
