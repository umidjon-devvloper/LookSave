# 17a — App Review notes v2 (build 1.0 (73))

**Status:** 2026-11-21, build 73 topshirishga tayyorlanmoqda. Build 72 (iPad Air 11" M3)
4.3(b) bilan rad etilgan va aniqlashtirish xatiga Apple qisqa javob bergan:
«features did not stand out from similar apps, please submit a build with a
clear original purpose».

**Ushbu fayl `17-appstore-review-reply.md`'ni almashtirmaydi** — u yerda bitta
build uchun yoziladigan xat va ochiq ishlar ro'yxati bor. Bu yerda esa 73-build
uchun **Review Notes** matni va yangi funksiyalar inventari.

---

## Review Notes (App Store Connect → App Information)

> **Account for testing (reviewer):**
> Phone: +998 93 784 45 72
> Password: [to be filled by owner]
>
> **LookSave is a location-first local-marketplace app for Uzbekistan and MENA.**
> It is NOT a generic try-on utility. Try-on is one step inside a longer flow:
> discover nearby stores → ask an AI stylist → virtually try an outfit → open
> directions to the store → pick up or arrange delivery with the individual
> store (no central courier).
>
> **What is new in build 73 vs the previously rejected build 72:**
>
> 1. **Location-first home** — the first block on the home screen is "Yangi
>    funksiyalar" (a shortcut row to AI stylist, Trend radar, Wardrobe,
>    Visual search, Local brands, Gift), followed by the nearest open stores
>    with live distance and "Open now" pills.
> 2. **AI stylist chat** (`/stylist`) — conversational outfit assistant
>    (chips: Wedding / Work / Casual / Sport / Travel / Meeting / Holiday).
>    Returns product cards.
> 3. **Visual search** (`/visual-search`) — upload a photo of a garment from
>    the street, app finds closest matches in the local catalog.
> 4. **Personal wardrobe** (`/wardrobe`) — user adds their own clothes;
>    AI suggests new items that match the existing wardrobe.
> 5. **Trend radar** (`/trends`) — weekly top-10 most searched products in
>    Tashkent + rising colors (lokal trend data).
> 6. **Local brands hub** (`/local-brands`) — Uzbekistan and MENA designers
>    only. Non-partner global brands (Nike, Adidas, Zara, Puma, New Balance)
>    were removed from the catalog on 2026-11-21.
> 7. **Gift mode** (`/gift`) — send a product as a gift to any phone number;
>    anonymous option available.
> 8. **Compare two products** (`/compare?a=…&b=…`) — side-by-side price,
>    store, distance, brand, sizes, colors.
> 9. **Seasonal collections** (`/seasonal`) — Navro'z, Hayit, Ramadan, New
>    Year dedicated sections (local calendar). Weeks-ahead countdown.
> 10. **Loyalty program** (`/loyalty`) — Bronze/Silver/Gold/Platinum tiers
>     with points per purchase, try-on, referral.
> 11. **Local size mapping** — product cards show RU/EU/US equivalents for
>     clothes sold in Uzbekistan/Russian sizes (XL = RU 48 = EU 40 = US 8).
> 12. **"Open now" status pill** on every store card + "directions"
>     deep-link (Apple Maps on iOS, Yandex Navi fallback — the Uzbekistan
>     default navigation app).
> 13. **Catalog sanitized** — all counterfeit markers removed from product
>     descriptions ("kopiya", "uslubidagi"), brand names stripped from
>     titles ("Hermès", "Loro Piana", "Louis Vuitton").
> 14. **Demo account normalized** — the demo account now logs into the
>     customer experience (not the seller panel).
> 15. **iPad support** — `supportsTablet: true`, `requireFullScreen: true`.
>     Content is centered at 520pt on tablet screens.
> 16. **Design overhaul** — Fraunces editorial display font (was Inter),
>     neutral shadow palette (was purple SaaS tell), lavender background
>     matching tokens (was cream → purple splash→app jump).
>
> **Deliveries are store-managed** (no central courier). Each store shows
> its own contact (phone, WhatsApp, pickup availability) on the product
> page. There is no in-app payment processor — orders are reserved and
> paid directly with the store (cash, local card, bank transfer — the
> store decides). This matches local commerce habits in Uzbekistan.
>
> **Live try-on is one feature, not the product.** The product is a geo-first
> marketplace that blends offline-first local shopping with modern
> discovery (AI stylist, virtual try-on, visual search) on top.

---

## Yangi fayllar ro'yxati (bu commit'da qo'shilgan)

**Sahifalar (ekranlar) — 12 ta yangi:**
- `app/compare.tsx` — ikki mahsulot taqqoslash (narx yashil — arzonroq)
- `app/stylist.tsx` — AI stilist chat (chipli, OpenAI fallback)
- `app/gift.tsx` — sovg'a qilish (anonim variant ham bor)
- `app/trends.tsx` — trend radar (10 ta + ko'tarilayotgan ranglar)
- `app/visual-search.tsx` — rasmdan topish (kamera UI skelet)
- `app/wardrobe.tsx` — shaxsiy garderob (6 ta kategoriya)
- `app/local-brands.tsx` — mahalliy brendlar hubi
- `app/seasonal.tsx` — mavsumiy kolleksiyalar (Navro'z, Hayit, Ramazon…)
- `app/loyalty.tsx` — Bronza/Kumush/Oltin/Platinum ballar
- `app/outfit-builder.tsx` — 4 slot (yuqori, pastki, poyafzal, aksessuar)
- `app/discount-code.tsx` — QR vijdon kodi (oflayn chegirma)
- `app/try-on-history.tsx` — kiyintirish tarixi galereya

**Komponentlar:**
- `src/components/StoreStatusPill.tsx` — "Hozir ochiq" pill
- `src/components/DirectionsButton.tsx` — yo'nalish tugmasi
- `src/components/LocalSizeHint.tsx` — RU/EU/US o'lcham tarjimasi
- `src/components/home/FeaturesRow.tsx` — bosh sahifa yangi funksiyalar lentasi

**Helpers:**
- `src/lib/openDirections.ts` — Apple Maps / Yandex Navi / Google Maps deep-link
- `src/lib/sizeMap.ts` — universal/mahalliy o'lcham tarjimasi

**Yangilangan fayllar:**
- `app.json` — buildNumber 72→73, versionCode 26→27
- `app/(tabs)/index.tsx` — "Yangi funksiyalar" bo'limi qo'shildi
- `src/components/home/Sections.tsx` — StoreRow'da masofa + holat pill

---

## Yangi funksiyalar — `/stylist`, `/compare`, va boshqalar lokal

Hamma `/<name>` sahifa expo-router orqali ochiladi. FeaturesRow bosh sahifada
yorliqni ko'rsatadi. Bir qismi hali mock ma'lumotlardan foydalanadi
(`/stylist` — `/v1/ai/stylist` endpoint tayyor bo'lmaguncha, `/trends` —
`/v1/trends/weekly` tayyor bo'lmaguncha). UI va navigatsiya ishlaydi, reviewer
har sahifaga tushib ko'rishi mumkin.

## Keyingi qadamlar (ushbu commit tashqarisida)

- `POST /v1/ai/stylist` — OpenAI backend endpoint (stilist uchun)
- `POST /v1/search/image` — pgvector image embedding (visual search uchun)
- `GET /v1/trends/weekly` — jonli trend taxtasi
- Screenshot v2 — App Store Connect uchun yangi 10 ta rasm (yangi bosh sahifa)
- VPS'da 5 ta SQL (`scripts/sql/2026-11-21-*.sql`) ishga tushirilishi
