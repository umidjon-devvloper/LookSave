-- 019_waitlist.sql
-- Tanishtiruv saytidagi "erta kirish" formasi.
--
-- NEGA ALOHIDA JADVAL: bular hali foydalanuvchi emas — parol yo'q, tasdiqlash
-- yo'q, telefon yo'q. Ularni `users` ga yozish autentifikatsiya mantig'iga
-- yarim to'ldirilgan qatorlar olib kiradi va har bir so'rovda "bu haqiqiy
-- foydalanuvchimi" degan tekshiruv qo'shishga majbur qiladi.
--
-- Migratsiya orqaga qaytmaydi. O'zgarish kerak bo'lsa — yangi raqamlangan fayl.

CREATE TABLE waitlist (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT NOT NULL,
  name        TEXT,
  role        TEXT NOT NULL CHECK (role IN ('shopper', 'store')),
  -- Qayerdan kelgani: reklama kanallarini solishtirish uchun
  source      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Bitta manzil ikki marta yozilmasin. Kichik/katta harf farqi hisobga
-- olinmaydi: "Ali@x.uz" va "ali@x.uz" — bitta odam.
CREATE UNIQUE INDEX waitlist_email_key ON waitlist (lower(email));

COMMENT ON TABLE waitlist IS
  'Saytdagi erta kirish so''rovlari. Foydalanuvchi emas — hali ro''yxatdan o''tmagan.';
