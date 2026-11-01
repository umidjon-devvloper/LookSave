# 17 — App Review'ga javob xati (qayta yuborish)

Apple'ning oldingi 4.3(b) rad etishiga javob — App Store Connect'da
**Resolution Center → Reply to Apple**'ga **inglizcha** yoziladi.

> ⚠️ Yuborishdan oldin tekshiring: demo akkauntда (`+998900007777`) **avatar va 1-2 look** haqiqatan sozlanganmi (haqiqiy qurilmada yuz skaneri). Agar yo'q bo'lsa — matndagi "demo account ready" qismini kamtarroq ("full-body photo upload path works") ga o'zgartiring.

---

## Qisqa variant (~250 so'z — eng tavsiya qilinadi)

```
Hi App Review team,

Thank you for the previous feedback under Guideline 4.3(b). We took the
concerns seriously and have made substantial, visible changes before
resubmitting. This build (version 1.0.0) is a focused response, not a
cosmetic update.

WHAT CHANGED SINCE THE PREVIOUS SUBMISSION

• Catalog depth. The marketplace now has multiple real local stores
  across Tashkent (Yunusobod, Chilonzor, Mirzo Ulug'bek, Yakkasaroy,
  Shayxontohur) with ~60 real products across men's and women's
  sections, real photos, realistic local pricing (UZS), and no empty
  categories.

• Fully localized experience. The entire consumer path, seller panel,
  and API error messages are now translated into Uzbek, Russian,
  English and Arabic (RTL), driven by device language.

• Guided onboarding. A new 3-slide onboarding on first launch explains
  the value proposition: AI try-on → nearby stores → direct ordering.

• AI try-on quality. We raised the image generation quality setting so
  the AI avatar output is noticeably sharper and more realistic.

• App Store listing rewritten in three languages (EN/RU/AR) to clearly
  communicate what the app is and how it differs from generic AI try-on
  apps: a hyperlocal marketplace for Uzbekistan, built around physical
  stores, with no in-app payments.

WHY THIS IS NOT A TEMPLATE OR DUPLICATE

LookSave is an original product. It is not an image-generation toy —
it is a real marketplace connecting shoppers with physical boutiques
in Uzbekistan, with AI try-on as the differentiator. There are no
in-app purchases; orders are requests sent to the shop, and the
shopper settles with the shop directly on delivery or in person.

HOW TO REVIEW

Demo account:
  Phone: +998900007777
  Password: AppReview2026!

The avatar needs a face/body photo. On a device, use the
"Upload a full-body photo" option in the avatar flow instead of the
live face scan (live scan cannot run in the iOS Simulator). Then open
the "Try-on" tab, pick a store, tap any item — AI dresses the avatar.

Permissions are only used as the usage strings describe (camera/
photos for the avatar, location for nearby stores).

Thank you for the time you take with each review.

Best regards,
LookSave team
support@looksave.uz
```

---

## Uzun variant (~450 so'z — agar batafsil kerak bo'lsa)

Qisqa variantga quyidagilar qo'shiladi:

```
ADDITIONAL CONTEXT ON ORIGINALITY

LookSave is built from scratch as a monorepo (iOS app, backend API,
seller web panel, admin panel, R2-backed CDN) specifically for the
Uzbek market. The AI try-on pipeline is our own composition on top of
image-generation providers — it is not a wrapper around a third-party
try-on SDK. We would be happy to walk through the architecture or
source if that is helpful.

The business model is explicitly not a payment or subscription app:
there are no in-app purchases, no card capture, no chargeable AI
quotas visible to the user. Revenue, when it comes, is from the
marketplace side (sellers) — not from the shopper installing the app.

PRIVACY

Face and body photos are used only to build the avatar and dress it,
and are sent to our try-on provider (FASHN) solely for that purpose.
Consent is explicit before upload. Users can delete their photos or
their entire account anytime in Settings. Full policy:
https://looksave.uz/en/privacy

LANGUAGES

The app ships in Uzbek, Russian, English and Arabic (RTL mirrored,
not a flat right-aligned copy). The device language picks the
locale; the user can also change it inside Settings.

AVAILABILITY

The app is intended for Uzbekistan first, but can be downloaded
globally — a user outside the country sees an empty "nearby stores"
list, which the UI handles gracefully (clear empty state, no error).
```

---

## Qayerga yozish

App Store Connect → ilova sahifasi → **Resolution Center** (yoki ilovaning
rad etilgan versiyasi ustiga bosib) → **"Reply to Apple"** / **"Отправить ответ"**.

## ⚠️ Takrorlangan rad etilishning oldini olish

- Shu matnni yuborgach **darhol yangi build yubormang** — avval **tasdiq
  so'rang** yoki Apple o'zi "resubmit with changes" degan javob bersin.
- Shu bir xil ilovani **o'zgarishsiz qayta yuborish** 4.3(b) ni yomonlashtiradi.
- Agar yangi build yuborilsa — Review Notes'da ham (`docs/16-appstore-metadata.md §5`)
  yuqoridagi ro'yxatga qisqacha ishora qilib qo'ying.
