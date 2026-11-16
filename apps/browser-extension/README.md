# LookSave — operator kengaytmasi

`developer_ai` navbatidagi kiyimlarni **brauzerdagi AI** orqali mijozning
avatariga kiydiradi va natijani darhol mijozga yuboradi.

Qo'lda bajarilgan uchta qadamni bosib o'tadi: kiyimni yuklab olish → AI'ga
berish → natijani panelga qaytarish.

## Nima qiladi

Navbatdagi ishni oladi, brauzerdagi AI'da bajaradi va natijani serverga
qaytaradi. **Ikki xil ish bor va ularning ishlashi boshqacha:**

**`render` — bitta kiyim, bitta mijoz.** Payloaddagi gavda + kiyim (+ yuz)
surati AI'ga beriladi, natija `POST /tasks/:id/result` bilan yopiladi va
mijozning `tryon_renders` yozuviga tushadi.

**`avatar` — gavda, keyin butun do'kon.** Avval yuz suratidan to'liq bo'yli
gavda yasaladi — **bitta rasm, faqat old ko'rinish** (prompt shu yerda
o'lchovlardan tuziladi, `payload.prompt` ishlatilmaydi) — va ish yopiladi. Keyin o'sha
gavdaga do'konning AI'ga yaroqli hamma kiyimi bittalab kiydiriladi:
**ustki kiyim birinchi**, so'ng `outer → bottom → feet`. Har kiyim tayyor
bo'lishi bilan mijozga ketadi — u oxirini kutmaydi.

Kiyimlar bir-birining ustiga taxlanmaydi: har biri yalang'och avatarga
alohida kiydiriladi (serverda `base_render_id = NULL`). Bitta kiyim yiqilsa
navbat to'xtamaydi — xato sanaladi va keyingisiga o'tiladi.

Prompt mijozning **o'lchovlarini** oladi (`payload.measurements`), ya'ni kiyim
o'sha odamning haqiqiy razmerida o'tirgandek chiziladi.

## O'rnatish

```bash
npm run build -w @looksave/browser-extension
```

Keyin Chrome'da: `chrome://extensions` → **Developer mode** → **Load unpacked**
→ `apps/browser-extension/dist`.

Ishlab chiqishda: `npm run watch -w @looksave/browser-extension` va har
o'zgarishdan keyin `chrome://extensions` da kengaytmani yangilash.

## Ishlatish

Avval bir marta: kengaytma belgisini bosing va **admin** raqami bilan kiring.
Parol faqat shu oynada so'raladi va panelga hech qachon o'tmaydi.

Keyin ikki rejimdan biri — ular bir-birining o'rnini bosmaydi:

**Avtomatik (asosiysi).** «Avtomatik rejim» belgisini qo'ying. Kengaytma
navbatni o'zi kuzatadi: ish tushishi bilan hech kim bosmasdan boshlaydi,
tugagach keyingisiga o'tadi, navbat bo'shasa har daqiqada qarab turadi.
Belgi `chrome.storage` da saqlanadi — brauzer qayta ochilsa ham rejim
qoladi.

**Qo'lda.** «Shu ishni boshlash» — faqat ochiq turgan ishni bajaradi va
to'xtaydi. Avtomatik rejim yoqilganda bu tugma yopiladi: ikkita navbat bir
AI tabida urishsa suratlar aralashib ketardi.

Ikkala rejim ham panelda (ish sahifasidagi **Avtomatik bajarish** bloki) va
kengaytma popupida bir xil turadi. Ish kengaytmada bajariladi — panelni
yopsangiz ham davom etadi. **To'xtatish** joriy qadam tugagach to'xtaydi.

## Bilib qo'yish kerak

**Sessiya alohida.** Kengaytma panelning tokenini olmaydi: server
`/auth/refresh` da tokenni rotatsiya qilib eskisini bekor qiladi, ya'ni token
bo'lishib olinsa operator panelidan uchib chiqardi.

**Sayt shartlari.** ChatGPT va Gemini veb interfeysini skript bilan haydash
ularning foydalanish shartlariga zid bo'lishi mumkin va hisob cheklanishi
mumkin. Rasmiy yo'l — server tomonidagi OpenAI API (`OPENAI_API_KEY`,
`apps/api/src/integrations/openai.ts`). Shuning uchun kiyimlar orasida
8 soniya tanaffus bor va bir vaqtda faqat bitta so'rov ketadi; bu
tanaffusni nolga tushirmang.

**«Sahifani tekshirish» — avval shuni bosing.** Navbatga umuman tegmaydi:
ochiq AI tabida matn maydonini, fayl maydonini va yuborish tugmasini topadi,
sinov suratini biriktirib ko'radi va matn yozadi — **lekin hech narsa
yubormaydi**, oxirida esa tozalaydi. Natija jurnalga yoziladi:

```
✓ matn maydoni: <textarea> #mobile-composer-prompt
✓ fayl maydoni: #octane-mobile-composer-files-input
✓ SURAT BIRIKTIRILDI — usul: fayl maydoni
✓ PROMPT YOZILDI
✓ yuborish tugmasi FAOLLASHDI
```

Biror qatorda `✗` bo'lsa — nosozlik o'sha yerda va uni tuzatish uchun butun
navbatni qurbon qilish shart emas. Sayt tuzilishi hisobga qarab farq qiladi,
shuning uchun buni tashqaridan taxmin qilib bo'lmaydi.

**Xatolar jurnalda ko'rinadi.** Ish yiqilsa sabab popupda va paneldagi blokda
yoziladi. Bu ataylab: ilgari xato chaqiruvchining `catch` ida yo'qolardi va
operator sababsiz «Bo'sh 0/0» ni ko'rardi — kengaytma «umuman ishlamaydi»
bo'lib tuyulardi.

**ChatGPT'ning ikki qurilmasi.** Sayt ikki xil bo'lishi mumkin: eskisida matn
maydoni `contenteditable` (`#prompt-textarea`) va tugmalarda `data-testid`
bor; yangisida («octane») matn maydoni haqiqiy `<textarea>`
(`#mobile-composer-prompt` — nomida «mobile» bo'lsa ham keng oynada ham
shu), `data-testid` umuman yo'q, tugma `aria-disabled` bilan o'chiriladi va
sinf nomlari hosil qilingan. Adapter ikkalasini ham sinaydi. 2026-09-23 da
jonli sahifada tekshirilgan: matn maydoni, yuborish tugmasi va fayl maydoni
(`#octane-mobile-composer-files-input`) topiladi, matn yozilgach tugma
faollashadi.

**Selektorlar sinadi.** Butun mantiq begona saytning DOM'iga tayanadi. Sayt
yangilanganda kengaytma to'xtaydi va popupda sabab ko'rinadi (masalan
«Matn maydoni topilmadi»). Tuzatish — faqat `src/content/adapters/` ichidagi
selektorlar; qadamlar mantiqi `src/content/index.ts` da va unga tegilmaydi.

**Prompt ikki nusxada.** `src/shared/prompt.ts` serverdagi `buildPrompt` ning
nusxasi. Serverdagi prompt o'zgarsa shu fayl ham o'zgarishi kerak, aks holda
bitta mijozning gallereyasida ikki xil uslubdagi surat paydo bo'ladi.

**Manzillar `host_permissions` da bo'lishi shart.** Surat yuklash va olish
service worker'da bajariladi — u `host_permissions` dagi manzillarga CORS'siz
chiqadi, ya'ni R2 bucketining CORS sozlamasiga tegish KERAK EMAS (panel
uchun kerak bo'lgan `npm run r2:cors --workspace=apps/api` bu yerga taalluqli
emas). Buning o'rniga `public/manifest.json` dagi ro'yxat `R2_ENDPOINT` va
`CDN_BASE_URL` bilan mos kelishi kerak. Hozir ro'yxatda
`*.cloudflarestorage.com`, `*.r2.dev`, `cdn.looksave.app` va `cdn.looksave.uz`
bor.

⚠️ `*.r2.dev` ni unutmang: `CDN_BASE_URL` amalda `pub-….r2.dev` bo'lishi
mumkin (hozirgi `apps/api/.env` da shunday), imzolangan havolalar esa
`*.cloudflarestorage.com` da — ikkalasi ham kerak. Domen ro'yxatda
bo'lmasa brauzer faqat `Failed to fetch` deydi va sabab ko'rinmaydi;
shuning uchun kengaytma xato matniga qaysi domen yetishmayotganini
qo'shib beradi.

## Tuzilishi

```
src/shared/     prompt va xabarlar tipi (ikkala tomon ishlatadi)
src/background/ navbat, API, R2 — service worker
src/content/    AI sahifasidagi qo'l; adapters/ — saytga xos selektorlar
src/bridge/     panel sahifasidagi ko'prik (paneldagi tugma shu orqali ishlaydi)
src/popup/      kirish, ish tanlash, holat
```

Panel tomoni: `apps/developer-ai/src/lib/extension.ts` (mijoz) va
`src/components/AutoDress.tsx` (tugma).

## Panel tugmasi qanday ishlaydi

Panel kengaytmaning ID'sini bilmaydi — `Load unpacked` da u har kompyuterda
boshqacha bo'ladi. Shuning uchun aloqa ko'prik orqali:

```
panel sahifasi ⇄ window.postMessage ⇄ bridge.js ⇄ chrome.runtime ⇄ worker
```

Ko'prik faqat panel domenlarida ishga tushadi (`manifest.json` →
`content_scripts`) va `<html>` ga belgi qo'yadi — panel kengaytma borligini
shundan biladi.

Sahifadan faqat `STATUS`, `START` va `STOP` o'tadi. Kirish buyrug'i ataylab
yo'q: parol popupda qoladi. Chegara ikki joyda — ko'prikda va worker'da
(`sender.tab` bo'lsa boshqa buyruqlar rad etiladi).

**Panel boshqa domenda bo'lsa** `manifest.json` dagi ikkinchi
`content_scripts` ro'yxatiga o'sha manzilni qo'shing, aks holda tugma
o'rniga «kengaytma o'rnatilmagan» eslatmasi turadi.
