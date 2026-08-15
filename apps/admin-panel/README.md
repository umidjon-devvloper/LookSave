# apps/admin-panel

Platforma administratori paneli. Vite + React 18 + TypeScript + Tailwind.
Cloudflare Pages'ga alohida proyekt sifatida deploy qilinadi.

Spetsifikatsiya: [`docs/07-web-panels.md` §5](../../docs/07-web-panels.md)

---

## Ishga tushirish

```bash
cd apps/api && npm run dev            # http://localhost:3000
cd ../admin-panel && npm run dev      # http://localhost:5174
```

Admin foydalanuvchi bazada qo'lda belgilanadi — ro'yxatdan o'tish orqali
admin bo'lib bo'lmaydi:

```sql
UPDATE users SET role = 'admin' WHERE phone = '+998901234567';
```

---

## Sahifalar

| Yo'l          | Nima                                                                          |
| ------------- | ----------------------------------------------------------------------------- |
| `/`           | sanoqlar + "diqqat talab qiladi" ro'yxati (har biri tegishli sahifaga havola) |
| `/stores`     | do'kon arizalari: egasi, manzil xaritada, javob tezligi, tasdiqlash foizi     |
| `/products`   | mahsulot moderatsiyasi: rasmlar, variantlar, ombor                            |
| `/3d`         | 3D navbat: ishga olish, model yuklash, QA natijasi                            |
| `/moderation` | global bloklar va cheklangan foydalanuvchilar                                 |

---

## Qoidalar

**Rad etish va to'xtatishda sabab majburiy.** Do'kon nima uchun rad
etilganini bilmasa, arizani qayta-qayta yuboraveradi.

**3D nashr qilish uchun uch shart:** GLB havolasi, beshta QA raqami va
"QA ro'yxati to'liq bajarildi" belgisi. Belgi qo'yilmasa tugma ishlamaydi.
Server ham shu qoidani tekshiradi — forma faqat oldindan ogohlantiradi.

**Global blokni admin bekor qila oladi.** U baza triggeri bilan avtomatik
qo'yiladi (uch do'kon bloklaganda), lekin uchala do'kon ham xato qilishi
mumkin. Har bir do'konning sababi ro'yxatda ko'rsatiladi.

---

## Do'kon paneli bilan takrorlanish

`api/client.ts`, `components/Spinner.tsx`, `lib/format.ts` va `hooks/useAuth.tsx`
ikkala panelda deyarli bir xil. Hujjatda `packages/ui` ko'zda tutilgan, lekin
hozircha nusxa ko'chirildi: umumiy paket qilish uchun ikkalasining ham
ehtiyoji barqarorlashishi kerak. Uchinchi marta takrorlansa — ajratamiz.

`localStorage` kaliti boshqa (`looksave.admin.refresh`) — bir brauzerda
ikkala panel ochilsa sessiyalar aralashib ketmasin.

---

## Hali yo'q

- Analitika
- Do'kon nazorati jadvali (javob bermayotgan do'konlar ro'yxati alohida)
