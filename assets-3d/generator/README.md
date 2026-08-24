# generator — kod bilan yasalgan GLB modellar

Blender modellari tayyor bo'lgunicha butun zanjirni ishga tushirib turadigan
**vaqtinchalik** modellar. `assets-3d/README.md` dagi 3-qadam aynan shuni
talab qiladi: bitta model bilan zanjirni sinab ko'rish, keyin 60 soatlik
modellashtirishga o'tish.

## ⭐ Avtomatik 3D: sotuvchi suratidan → 3D kiyim

Bu — loyihaning asosiy g'oyasi: **qo'lda modellash yo'q**. Sotuvchi
mahsulotni rasmi bilan qo'shib "3D so'rash" bosadi → tizim o'zi 3D yasaydi.

```bash
node assets-3d/generator/from-photo.mjs          # navbatni ko'rsatadi (quruq)
node assets-3d/generator/from-photo.mjs --apply  # yasaydi
node assets-3d/generator/worker-3d.mjs           # ⭐ AVTOMATIK: navbatni doim kuzatadi
```

**Qanday ishlaydi** (`from-photo.mjs`):
1. `assets_3d` dagi `status='queued'` mahsulotlarni oladi
2. Har biriga: mahsulot suratidan **asosiy rangni** chiqaradi (markazdan,
   fon va soyani tashlab)
3. Slotga mos kiyim qolipini **o'sha rangda**, tanaga moslangan holda,
   6 shape key bilan yasaydi
4. R2 ga yuklaydi, `status='ready'` qiladi
5. Mahsulot 3D svayp ro'yxatida paydo bo'ladi

**⚠️ NEGA SURATDAN TO'G'RIDAN-TO'G'RI MESH EMAS.** Meshy/Tripo kabi
xizmatlar tanaga moslanmagan, morflarsiz "yopiq buyum" qaytaradi — u
tanadan chetda osilib qoladi. Shuning uchun geometriya **tanadan**
quriladi (moslik kafolatli), surat esa rangni beradi.

**Cheklov:** bu haqiqiy rangdagi qolip, aniq mahsulotning piksel nusxasi
emas. Bir tusli kiyim — a'lo; katta bosmali — faqat asosiy rang. Piksel
nusxa uchun 2-bosqich "yaxshilash" (tashqi xizmat) yoki qo'lda modellash.

`worker-3d.mjs` — `from-photo.mjs` ni davriy (standart 30 s) chaqiradigan
worker. Ishlab chiqarishda alohida jarayon/konteyner
(`infra/docker-compose.yml`, `08-deployment.md`).

## Barcha skriptlar

```bash
node assets-3d/generator/build.mjs      # modellarni yasaydi → export/
node assets-3d/generator/validate.mjs   # qaytadan yuklab tekshiradi
node assets-3d/generator/poke.mjs       # tana kiyim ostidan chiqib turmayaptimi
node assets-3d/generator/measure.mjs    # proporsiya va aylanalarni o'lchaydi
node assets-3d/generator/publish.mjs    # R2 + bazaga (--apply bilan bajaradi)
```

## ⚠️ `poke.mjs` — nega alohida vosita

`validate.mjs` gavdani **silindr** sifatida o'lchaydi: har balandlikda eng
chetdagi nuqtani oladi. Bu ikki narsani yashiradi va ikkalasi ham 2026-08-24
da topildi (12-tz.md D-39, D-40):

1. **Yeng va shtanina umuman tekshirilmaydi** — ular Y o'qidan uzoqda
2. **Mahalliy siqilish ko'rinmaydi** — nominal oraliq 22 mm bo'lgan holda
   deltasimon mushak ustida yoki chovda u 0.1 mm gacha tushadi

Natijada `validate.mjs` «✅ hammasi mos» deb turgan holda krossovkada oraliq
**0.0 mm** edi — ya'ni yuzalar ustma-ust va z-fighting.

`poke.mjs` har tana verteksidan **ikki tomonga** nur otadi:

| Natija | Ma'nosi |
| --- | --- |
| `+normal` da tegdi | vertex kiyim ichida ✅ |
| faqat `−normal` da (6 mm ichida) tegdi | kiyim orqada, vertex tashqarida ❌ |
| ikkalasida ham tegmadi | kiyim bu yerda yo'q — hisobga olinmaydi |

Uchinchi holat muhim: yeng uchi ostidagi qo'l ochiq bo'lishi **normal**.
Birinchi ikki urinish aynan shu farqni ajratmagani uchun yolg'on natija
bergan (88% va 20%) — o'lchov usulini o'zgartirmasdan raqamga ishonmang.

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
