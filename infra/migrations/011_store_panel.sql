-- 011_store_panel.sql
-- Do'kon paneli va Telegram integratsiyasi uchun qo'shimchalar.

-- Telegramdagi xabarni keyin tahrirlash uchun (09-integrations §2.5).
-- Panelda tasdiqlansa ham Telegramdagi xabar yangilanishi kerak — aks holda
-- sotuvchi bir amalni ikki marta bajaradi.
ALTER TABLE orders
  ADD COLUMN telegram_message_id BIGINT,
  ADD COLUMN telegram_chat_id    BIGINT;

-- Bot ulangan vaqti — panelda "qachondan beri ulangan" ko'rsatish va
-- uzilib qolgan do'konlarni topish uchun
ALTER TABLE stores
  ADD COLUMN telegram_linked_at TIMESTAMPTZ;

-- `SELECT id FROM stores WHERE telegram_chat_id = $1` — har callback'da
CREATE INDEX stores_telegram_chat_idx ON stores (telegram_chat_id)
  WHERE telegram_chat_id IS NOT NULL;

-- Do'kon paneli "yangi buyurtmalar" ro'yxati
CREATE INDEX orders_store_new_idx ON orders (store_id, created_at DESC)
  WHERE status = 'new';
