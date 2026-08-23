# LookSave

AI fashion marketplace — yaqin atrofdagi kiyim do'konlari, 3D avatarda kiyib ko'rish, do'konga to'g'ridan-to'g'ri buyurtma.

**Bozorlar:** Dubay (BAA) · Toshkent (O'zbekiston)

---

## Hujjatlar

Loyihaning yagona haqiqat manbai — [`docs/`](./docs) katalogi. Kod hujjatga zid bo'lsa, hujjat to'g'ri.

| #   | Fayl                                            | Nima haqida                               |
| --- | ----------------------------------------------- | ----------------------------------------- |
| 00  | [00-README.md](./docs/00-README.md)             | Qarorlar (K-01…K-17), ko'lam, kelishuvlar |
| 01  | [01-arxitektura.md](./docs/01-arxitektura.md)   | Texnik arxitektura, DB sxemasi, 3D tizimi |
| 02  | [02-database.md](./docs/02-database.md)         | Migratsiyalar, indexlar, seed data        |
| 03  | [03-api-spec.md](./docs/03-api-spec.md)         | Endpointlar, xato kodlari                 |
| 04  | [04-3d-pipeline.md](./docs/04-3d-pipeline.md)   | Blender qadamlari, eksport, QA            |
| 05  | [05-mobile.md](./docs/05-mobile.md)             | Ekran spetsifikatsiyasi                   |
| 06  | [06-dizayn.md](./docs/06-dizayn.md)             | Rang, tipografika, komponentlar           |
| 07  | [07-web-panels.md](./docs/07-web-panels.md)     | Do'kon kabineti, admin panel              |
| 08  | [08-deployment.md](./docs/08-deployment.md)     | Docker, VPS, backup, CI/CD                |
| 09  | [09-integrations.md](./docs/09-integrations.md) | Telegram, SMS, Gemini, Maps, R2           |
| 10  | [10-roadmap.md](./docs/10-roadmap.md)           | Fazalar, sprintlar, risklar               |
| 11  | [11-deck-audit.md](./docs/11-deck-audit.md)     | Deck ↔ kod solishtiruvi                   |
| 12  | [12-tz.md](./docs/12-tz.md)                     | Kamchiliklar reyestri, ish paketlari      |

---

## Tuzilma

```
looksave/
├── docs/                  ← texnik hujjatlar (yagona haqiqat manbai)
├── apps/
│   ├── api/               ← Node 20 + Express + TypeScript
│   ├── mobile/            ← Expo SDK 52 + React Native
│   ├── store-panel/       ← Vite + React (do'kon kabineti)
│   └── admin-panel/       ← Vite + React (admin)
├── packages/
│   ├── shared-types/      ← API kontrakti (TypeScript tiplar)
│   └── validation/        ← Zod sxemalar (mobil + server birgalikda)
├── infra/
│   ├── docker-compose.yml
│   ├── Caddyfile
│   └── migrations/        ← 001…008.sql
├── assets-3d/             ← 3D modellar, generator, base mesh'lar
└── blender_scripts/       ← QA, rig shabloni, morph ko'chirish
```

`packages/*` **build qilinmaydi** — TypeScript manba sifatida eksport qilinadi.
API'ni tsup, panellarni Vite/esbuild, mobilni Metro/babel kompilyatsiya qiladi.
Shuning uchun bu paketlarga Node'ga xos modul (`fs`, `crypto`, `pg`) import qilinmaydi — mobil build buziladi.

---

## Birinchi ishga tushirish

Haqiqiy muhitga qo'yish uchun: [`RUNBOOK.md`](./RUNBOOK.md) — bosqichma-bosqich,
har bosqichda kutilayotgan xatolar va ularning yechimi bilan.

---

## Boshlash

Talab: **Node 20** (`.nvmrc`), npm 10+, Docker (baza uchun).

```bash
nvm use
npm install

npm run check        # format + lint + typecheck
```

| Buyruq              | Nima qiladi                           |
| ------------------- | ------------------------------------- |
| `npm run typecheck` | Barcha workspace'larda `tsc --noEmit` |
| `npm run lint`      | ESLint (flat config)                  |
| `npm run format`    | Prettier                              |
| `npm run check`     | Uchalasi ketma-ket — commit oldidan   |

---

## Kod qoidalari

Batafsil: [`docs/00-README.md` §7](./docs/00-README.md).

- TypeScript `strict: true`, **hech qayerda `any`** — ESLint xato beradi
- API javobi: `{ data, meta }` yoki `{ error: { code, message, details }, meta }`
- Xato kodlari — `SCREAMING_SNAKE_CASE`, ro'yxat: `packages/shared-types/src/errors.ts`
- Pul — `NUMERIC(12,2)` bazada, API'da **string**. Hech qachon `float`/`number`
- Vaqt — hamma joyda UTC, `TIMESTAMPTZ`, API'da ISO 8601
- ID — UUID v4
- Migratsiyalar raqamlangan va **orqaga qaytmaydi** — har o'zgarish yangi fayl

### Git

- Branch: `main` (stable) · `dev` · `feat/*` · `fix/*`
- Commit: `feat: add nearby stores endpoint`
- 3D fayllar — oddiy git (LFS ishlatilmaydi). **25 MB dan katta fayl qo'yilmaydi** — `.gitattributes` ga qarang

---

## Holat

| Bosqich                                            | Holat   |
| -------------------------------------------------- | ------- |
| 1. Monorepo tuzilmasi                              | ✅      |
| 2. `infra/` — docker-compose + Caddyfile           | ✅      |
| 3. `infra/migrations/`                             | ✅      |
| 4. `apps/api` — Express + Zod + health             | ✅      |
| 5. Auth — parol bilan (OTP'siz, Faza 1)            | ✅      |
| 6. Geo + katalog                                   | ✅      |
| 7. Savat + buyurtma oqimi                          | ✅      |
| 8. Do'kon paneli API + Telegram + SSE              | ✅      |
| 9. Mahsulot CRUD + R2 presign                      | ✅      |
| 10. `apps/store-panel` — buyurtma va mahsulot      | ✅      |
| 11. Admin API — moderatsiya, 3D navbat             | ✅      |
| 12. `apps/admin-panel`                             | ✅      |
| 13. `apps/mobile` — Expo skeleti                   | ✅      |
| 14. Mobil: savat, checkout, buyurtmalar            | ✅      |
| 15. Push bildirishnomalar + i18n                   | ✅      |
| 16. Cron vazifalar, eas.json, deploy CI            | ✅      |
| 17. Try-On API, sevimlilar, komplektlar            | ✅      |
| 18. Profil, o'lchamlar, avatar config              | ✅      |
| 19. Try-On sof mantiqi (GPU'siz)                   | ✅      |
| 20. Katalog, sevimlilar, o'lchamlar, til           | ✅      |
| 21. Mahsulotni tahrirlash + ombor                  | ✅      |
| 22. Integratsion testlar (haqiqiy baza, CI)        | ✅      |
| 23. Admin, Try-On, Telegram, cron testlari         | ✅      |
| 24. Statistika, hisoblar, admin buyurtmalari       | ✅      |
| 25. Panellarda statistika, hisoblar, buyurtma      | ✅      |
| 26. Do'kon jamoasi (xodimlar)                      | ✅      |
| 27. Do'kon sozlamalari (ish vaqti, joylashuv)      | ✅      |
| 28. Komplektlar ekrani, logo va muqova             | ✅      |
| 29. Mobil ekranlarni i18n ga o'tkazish             | ✅      |
| 30. i18n ni barcha ekranlarga yoyish               | ✅      |
| 31. Dockerfile simulyatsiyasi + RUNBOOK            | ✅      |
| 32. Caddy konfiguratsiyasini haqiqiy sinash        | ✅      |
| 33. Try-On render: sahna, svayp, kesh              | ✅ \*   |
| 34. Xarita ekrani (marker, klaster)                | ✅ \*   |
| 35. Akkauntni o'chirish (App Store talabi)         | ✅ \*   |
| 36. Do'kon arizasi va ro'yxatdan o'tish            | ✅ \*   |
| 37. Yangi oqimlar uchun integratsion testlar       | ✅      |
| 38. Panelda xarita tanlagich                       | ✅ \*   |
| 39. Blender skriptlari (QA, rig, morph)            | ✅ \*\* |
| 40. Animatsiya qatlami (idle, turn, walk, sit)     | ✅ \*   |
| **Keyingi:** qurilmada sinov va birinchi base mesh | ⏳      |

**317 test** (birlik 199 · integratsion 86 · Blender qoidalari 32) ·
~87 endpoint · 12 migratsiya · 4 ilova.

\* Kod yozilgan, qurilmada ishga tushirilmagan.
\*\* Qoidalar testlangan, `bpy` chaqiruvlari Blender'da sinalmagan.

Birinchi ishga tushirish: [`RUNBOOK.md`](./RUNBOOK.md)
