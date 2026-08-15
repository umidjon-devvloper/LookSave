# 10 — Yo'l xaritasi

**Bog'liq:** [00-README.md](./00-README.md) · [04-3d-pipeline.md](./04-3d-pipeline.md) · [11-shartnoma.md](./11-shartnoma.md)

---

## 1. Asosiy taxmin

| Parametr | Qiymat |
|---|---|
| Jamoa | 1 kishi (Umidjon) |
| Ish rejimi | Kuniga ~6 sof soat, haftada 5 kun |
| Haftalik sig'im | ~30 soat |
| AI vositalari tezlashtiruvi | CRUD/UI 2-3× · 3D 1× · debug 1.2× |

**AI bilan ham 3D modellar tezlashmaydi.** Bu butun rejaning cheklovchi omili (04-3d-pipeline.md).

---

## 2. Uch parallel yo'nalish

Loyiha ketma-ket emas, **uchta yo'nalish bir vaqtda** boradi. Aks holda muddat ikki barobar cho'ziladi.

```
Yo'nalish A — Ilova va backend   (Umidjon)
Yo'nalish B — 3D modellar        (Umidjon yoki autsors)
Yo'nalish C — Biznes             (Mijoz)
```

| Yo'nalish | Kim | Nima |
|---|---|---|
| **A** | Umidjon | Backend, mobil ilova, panellar |
| **B** | Autsors tavsiya etiladi | Base mesh'lar, mahsulot modellari |
| **C** | Mijoz | Do'kon jalb qilish, fotolar, yuridik |

**Agar B ni ham Umidjon qilsa**, Faza 1 muddati 8 haftadan **12-14 haftaga** cho'ziladi. Bu shartnomada aniq yozilishi kerak.

---

## 3. Faza 1 — Prototip (8 hafta)

**Maqsad:** ishlaydigan demo. Mijoz va investorga ko'rsatiladi, real foydalanuvchi sinab ko'ra oladi.

### Yo'nalish A — haftalar

| Hafta | Ish | Soat |
|---|---|---|
| **1** | Repo, monorepo, Expo dev build, **3D siqish sinovi** ⚠️, dizayn tizimi, Docker/VPS | 30 |
| **2** | Baza migratsiyalari, API asosi (auth, profil, do'konlar, katalog), geo-qidiruv | 30 |
| **3** | Mobil: auth oqimi, jins, o'lchamlar, Home | 30 |
| **4** | Mobil: do'konlar (xarita + ro'yxat), do'kon sahifasi, katalog, mahsulot | 30 |
| **5** | **Try-On: 3D sahna, avatar, morph, yuklash** | 30 |
| **6** | **Try-On: slot tizimi, raycast, svayp, kesh, optimizatsiya** | 30 |
| **7** | Savat, checkout, buyurtma oqimi, **Telegram bot** | 30 |
| **8** | Minimal do'kon paneli, test, tuzatish, TestFlight/APK | 30 |

**Jami: ~240 soat**

### Yo'nalish B — 3D (parallel)

| Hafta | Ish | Soat |
|---|---|---|
| 1-4 | 5 ta base mesh (futbolka, xudi, shim, krossovka, kepka) | 60 |
| 5-8 | 10 ta demo model (base mesh asosida) | 50 |

**Jami: ~110 soat**

### Yo'nalish C — biznes (mijoz)

| Hafta | Ish |
|---|---|
| 1-2 | 3-5 ta pilot do'kon bilan kelishuv |
| 3-6 | Mahsulot fotolari (har do'kondan 10-20 ta mahsulot) |
| 7-8 | Do'kon egalarini panelga o'rgatish |

### ✅ Faza 1 yakunida bo'ladi

- Geolokatsiya bo'yicha yaqin do'konlar
- Do'kon katalogi va mahsulot sahifalari
- 3D Try-On: 10 ta model bilan svayp, o'lcham moslash
- Savat va buyurtma so'rovi (to'lovsiz)
- Telegram orqali sotuvchiga xabar va tasdiqlash
- Minimal do'kon paneli
- TestFlight / APK

### ❌ Faza 1 da bo'lmaydi

- App Store / Play Market'da rasman
- Face scan
- To'lov tizimi
- AI Designer
- Katta 3D katalog
- Animatsiyalar (yurish, o'tirish)
- Analitika

---

## 4. Faza 2 — MVP (12 hafta)

**Maqsad:** haqiqiy foydalanuvchilar uchun ishlaydigan mahsulot, do'konlarda kunlik ishlatiladi.

| Hafta | Ish |
|---|---|
| 9-10 | Face scan (qurilmada), avatar teksturasi |
| 11-12 | Buyurtma oqimi to'liq: barcha statuslar, cron, eslatmalar, expiry |
| 13-15 | Do'kon paneli to'liq: mahsulot boshqaruvi, rasm yuklash, sozlamalar |
| 16-17 | Animatsiyalar (idle, turn, walk, sit), 3D optimizatsiya |
| 18-19 | Push, wishlist, saqlangan look'lar, qidiruv |
| 20 | Do'kon reytingi, javob tezligi, admin panel |

3D yo'nalishi: **40-60 mahsulot modeli** (~250 soat)

### Milestone: App Store / Play Market

| Ish | Muddat |
|---|---|
| Maxfiylik siyosati, foydalanish shartlari | 18-hafta |
| Skrinshotlar, tavsif, ikonka | 19-hafta |
| Akkaunt o'chirish funksiyasi | 19-hafta |
| Birinchi topshirish | 20-hafta |
| Review (odatda 1-7 kun, rad etilsa qayta) | 21-22-hafta |

> Yuz skani — Apple uchun sezgir mavzu. Ma'lumot qurilmada qayta ishlanishini aniq yozing (05-mobile.md, 13-bo'lim).

---

## 5. Faza 3 — To'liq (14 hafta)

| Hafta | Ish |
|---|---|
| 23-25 | AI Designer (Gemini + fallback) |
| 26-28 | Onlayn to'lov (Payme/Click/Telr), komissiya undirish, payout |
| 29-31 | Analitika: do'kon va admin dashboardlari |
| 32-34 | Sharh, reyting, ijtimoiy funksiyalar |
| 35-36 | Chuqur optimizatsiya, A/B test, sayqallash |

3D: **150+ modelgacha** kengaytirish

### Keyingi fazalar (rejada, muddatsiz)

AR / smart mirror · Web try-on · Token / NFT (yuridik qism alohida)

---

## 6. Umumiy vaqt jadvali

```
Hafta   1───8      9──────────20      23────────────36
        │ FAZA 1  │    FAZA 2        │    FAZA 3
        │Prototip │      MVP         │    To'liq
        └─────────┴──────────────────┴──────────────
A: ilova ████████  ████████████       ██████████████
B: 3D    ▓▓▓▓▓▓▓▓  ▓▓▓▓▓▓▓▓▓▓▓▓       ▓▓▓▓▓▓▓▓▓▓▓▓▓▓
C: biznes ░░░░░░░  ░░░░░░░░░░░░       ░░░░░░░░░░░░░░
                    ▲              ▲
                 App Store      To'lov
```

| Faza | Muddat | Yakunlanadi |
|---|---|---|
| Faza 1 | 8 hafta | ~2026-oktabr |
| Faza 2 | +12 hafta | ~2027-yanvar |
| Faza 3 | +14 hafta | ~2027-aprel |

*Boshlanish sanasi shartnoma imzolangandan hisoblanadi.*

---

## 7. Kritik yo'l

Bu ishlar kechiksa, **butun loyiha kechikadi**:

| # | Ish | Qachon | Nega kritik |
|---|---|---|---|
| 1 | **3D siqish sinovi** | 1-hafta | Draco/KTX2 Expo'da ishlamasa, butun pipeline o'zgaradi |
| 2 | **SMS shablonlarini topshirish** | 1-hafta | Tasdiqlash 1-3 kun; kirish shunga bog'liq |
| 3 | **Base mesh'lar** | 4-hafta | Bularsiz har model 2× uzoq |
| 4 | **Pilot do'konlar** | 2-hafta | Do'konsiz demo bo'sh |
| 5 | **Mahsulot fotolari** | 6-hafta | Fotosiz 3D model yasab bo'lmaydi |
| 6 | **Try-On ekrani** | 5-6-hafta | Loyihaning butun qiymati |
| 7 | Apple Developer akkaunt | 16-hafta | Ro'yxatdan o'tish 1-2 hafta olishi mumkin |

**1 va 2 — birinchi hafta, kechiktirmasdan.** Ikkalasi ham "keyin qilamiz" deb qoldirilsa, keyinroq katta yo'qotish keltiradi.

---

## 8. Go / No-Go nuqtalari

Har faza oxirida qaror qabul qilinadi. Shart bajarilmasa — davom etilmaydi, avval tuzatiladi.

### 4-hafta oxiri

- [ ] 3D siqish sinovi o'tdi, strategiya aniq
- [ ] Base mesh'lar tayyor
- [ ] Backend va geo-qidiruv ishlayapti
- [ ] Kamida 3 ta pilot do'kon kelishildi

❌ bo'lsa: Try-On ni boshlamang, avval blokerni yeching.

### 8-hafta oxiri (Faza 1)

- [ ] Try-On real telefonda 30+ FPS
- [ ] 10 ta model katalogda
- [ ] Buyurtma Telegramga yetib boradi
- [ ] Sotuvchi tugma bilan tasdiqlay oladi
- [ ] Demo mijozga ko'rsatildi

❌ bo'lsa: Faza 2 ni boshlamang, ko'lamni qayta ko'rib chiqing.

### 20-hafta oxiri (Faza 2)

- [ ] 40+ 3D model
- [ ] 5+ faol do'kon
- [ ] 50+ haqiqiy buyurtma
- [ ] Do'kon o'rtacha javob vaqti < 60 daqiqa
- [ ] Ilova do'konlarda

❌ bo'lsa: Faza 3 ni kechiktiring, mahsulot-bozor mosligini tekshiring.

---

## 9. Muvaffaqiyat ko'rsatkichlari

Deckdagi "investor-ready metrics" aynan shu (05-mobile.md, 12-bo'lim):

| Ko'rsatkich | Faza 1 | Faza 2 | Faza 3 |
|---|---|---|---|
| Ro'yxatdan o'tgan | 50 | 1 000 | 10 000 |
| Faol do'kon | 3 | 10 | 40 |
| 3D modellar | 10 | 50 | 150 |
| Try-On ochilishi (haftalik) | 100 | 2 000 | 20 000 |
| Buyurtma (haftalik) | 5 | 50 | 400 |
| Tasdiqlash foizi | — | > 70% | > 85% |
| Do'kon javob vaqti | — | < 60 daq | < 20 daq |
| Try-On → buyurtma | — | > 2% | > 4% |
| Qaytish (7 kun) | — | > 15% | > 25% |

**Eng muhim ikkitasi:** do'kon javob vaqti va tasdiqlash foizi. Ular past bo'lsa, qolgan hamma raqam ahamiyatsiz — foydalanuvchi qaytmaydi.

---

## 10. Risk reyestri

| # | Risk | Ehtimol | Ta'sir | Chora |
|---|---|---|---|---|
| R1 | Draco/KTX2 Expo'da ishlamaydi | O'rta | Yuqori | 1-haftada sinash, zaxira strategiya tayyor |
| R2 | 3D modellar rejadan sekin | **Yuqori** | Yuqori | Base mesh, autsors, katalogni cheklash |
| R3 | Do'konlar qiziqmadi | O'rta | **Juda yuqori** | Bepul, komissiyasiz; 3D modelni biz yasaymiz |
| R4 | Do'kon buyurtmaga javob bermaydi | **Yuqori** | Yuqori | Telegram + SMS + expiry + reyting |
| R5 | Soxta buyurtmalar ko'p | O'rta | O'rta | 4 qatlamli himoya (01, 6-bo'lim) |
| R6 | Eski Android'da qotadi | O'rta | Yuqori | LOD, avtomatik sifat, 2D fallback |
| R7 | App Store rad etadi (yuz skani) | O'rta | O'rta | Maxfiylik hujjatlari, aniq tushuntirish |
| R8 | Sifatsiz mahsulot fotolari | **Yuqori** | O'rta | Shartnomada talab, namuna beriladi |
| R9 | Ko'lam kengayadi | **Yuqori** | Yuqori | Yozma tasdiqsiz ish yo'q |
| R10 | VPS o'chdi, backup yo'q | Past | **Juda yuqori** | Kunlik backup + oylik tiklash sinovi |
| R11 | SMS provayder o'chdi | Past | Yuqori | Ikkinchi provayder oldindan ulangan |
| R12 | Solo developer kasal/band | O'rta | Yuqori | Hujjatlar to'liq, kod toza, bufer vaqt |

### Eng jiddiy uchtasi

**R3 — do'konlar qiziqmasligi.** Bu texnik emas, biznes riski, lekin butun loyihani o'ldiradi. Chora: birinchi do'konlar uchun hamma narsa bepul, 3D modellarni biz yasaymiz, komissiya yo'q.

**R4 — do'kon javob bermasligi.** Foydalanuvchi buyurtma beradi, 24 soat kutadi, javob yo'q. U qaytib kelmaydi. Chora: Telegram bot, SMS eslatma, avtomatik expiry, reytingda jarima.

**R2 — 3D modellar sekinligi.** Yagona ishonchli chora: autsors. Bir o'zingiz 150 ta model yasashga 5.5 oy ketadi.

---

## 11. Bufer va haqiqat

Yuqoridagi jadval **ideal sharoit** uchun. Amalda:

| Omil | Ta'sir |
|---|---|
| Kutilmagan xatolar | +10-15% |
| Mijoz javobini kutish | +5-10% |
| Ko'lam aniqlashtirish | +5-10% |
| Kasallik, bayram, shaxsiy | +5% |

**Tavsiya: har fazaga 20% bufer qo'shing va mijozga shu raqamni ayting.**

| Faza | Ideal | Buferi bilan |
|---|---|---|
| Faza 1 | 8 hafta | **10 hafta** |
| Faza 2 | 12 hafta | **14 hafta** |
| Faza 3 | 14 hafta | **17 hafta** |

Erta tugatish — yaxshi yangilik. Kechikish — ishonch yo'qotish. Har doim buferi bilan ayting.

---

## 12. Haftalik ritm

| Kun | Ish |
|---|---|
| Dushanba | Hafta rejasi, blokerlarni aniqlash |
| Dush-Payshanba | Asosiy ishlab chiqish |
| Juma | Test, tuzatish, deploy, **mijozga hisobot** |
| Juma | Keyingi hafta rejasi |

**Mijozga haftalik hisobot** — qisqa xabar: nima tugadi, nima qolyapti, nima kerak. Bu ishonchni saqlaydi va kutilmagan savollarni oldini oladi.

Namuna:

```
LookSave — 5-hafta hisoboti

✅ Tugadi
• 3D sahna ishga tushdi, avatar telefonda ko'rinadi
• O'lcham slider'lari real vaqtda ishlaydi

🔄 Jarayonda
• Svayp bilan kiyim almashtirish (60%)

⚠️ Kerak
• Do'kondan 10 ta mahsulot fotosi (5-hafta oxirigacha)

📅 Keyingi hafta
• Svayp tugallanadi, kesh va optimizatsiya
```

---

## 13. Nima o'zgarishi mumkin

Bu hujjat **qotib qolgan reja emas**. Har faza oxirida qayta ko'rib chiqiladi.

Rejani o'zgartirishga arziydigan sabablar:

- 3D siqish sinovi kutilmagan natija berdi
- Do'konlar boshqa narsani so'rayapti
- Foydalanuvchilar Try-On'ni ishlatmayapti (unda butun farazni qayta ko'rish kerak)
- Mijoz bozorni o'zgartirdi (Dubay ↔ Toshkent)

Rejani o'zgartirish — yomon emas. Yomoni — eskirgan rejaga amal qilishda davom etish.
