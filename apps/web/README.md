# @looksave/web — tanishtiruv sayti

Ommaviy sayt: investorlar, do'konlar va birinchi foydalanuvchilar uchun.
Panellardan farqi — bu marketing sahifasi, ma'lumot paneli emas.

```bash
npm run dev --workspace @looksave/web     # http://localhost:5175
npm run build --workspace @looksave/web   # dist/
```

## Bo'limlar va deck

Har bir bo'lim deckning slaydiga mos keladi (`docs/11-deck-audit.md` §2):

| Bo'lim | Slayd |
|---|---|
| `Hero` | 01 — EXPLORE. SHOP. ELEVATE. |
| `Problem` | 02 — The Problem |
| `HowItWorks` | 03 — Create Your Avatar |
| `TryOn` | 04–05 — Avatar & Fit Data, Virtual Try-On Flow |
| `Marketplace` | 07–08 — MEN / WOMEN / LIMITED, Premium Brands |
| `Stores` | 10 — Business Model, sotuvchi tomoni |

Yangi bo'lim qo'shilganda shu jadvalga ham yozing — aks holda sayt deckdan
sekin-asta uzoqlashadi va buni hech kim sezmaydi.

## Ranglar

`tailwind.config.js` dagi qiymatlar `docs/06-dizayn.md` §2 dan olingan —
mobil ilova va panellar bilan bitta manba. Ularni bu yerda o'zgartirmang:
avval hujjatni, keyin hamma joyni.

Panel variantidan ikki farqi bor va ikkalasi ataylab: asos shrift 16px
(panelda 14px) va `shadow-glow` saqlanadi — deckdagi "nurlanuvchi binafsha"
hissi aynan shundan keladi.

## Forma

`Waitlist` bo'limi `POST /v1/waitlist` ga yuboradi
([routes/waitlist.ts](../api/src/routes/waitlist.ts), migratsiya
[019_waitlist.sql](../../infra/migrations/019_waitlist.sql)).

⚠️ Takroriy manzil **xato emas**: odam formani ikki marta to'ldirishi oddiy
holat. Server uni jimgina yutadi va bir xil javob qaytaradi — aks holda
"meni qabul qilishmadimi?" degan savol tug'iladi.

Dev'da API ga proksi `vite.config.ts` da sozlangan, ya'ni CORS kerak emas.
