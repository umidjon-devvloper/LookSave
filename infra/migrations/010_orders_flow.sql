-- 010_orders_flow.sql
-- Buyurtma oqimi: idempotentlik, ombor rezervini qaytarish, muddat cron'i.
--
-- ⚠️ Hujjatda YO'Q, lekin zarur:
-- 02-database §10.5 buyurtma yaratilganda `reserved` ni oshiradi, ammo uni
-- QAYTARISH qayerda ekani hech qayerda aytilmagan. Buyurtma bekor qilinsa
-- yoki muddati o'tsa, rezerv abadiy qolib ketadi va tovar "yo'q" bo'lib
-- ko'rinaveradi. Shu sababli quyidagi trigger qo'shildi.

-- ============================================================
-- 1) IDEMPOTENTLIK (03-api-spec §12: POST /orders da majburiy)
-- ============================================================

CREATE TABLE idempotency_keys (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key           TEXT NOT NULL,
  endpoint      TEXT NOT NULL,
  -- So'rov tanasining SHA-256 hashi: bir xil kalit bilan BOSHQA so'rov
  -- yuborilsa, bu xato — eski javobni qaytarish noto'g'ri bo'lardi.
  request_hash  TEXT NOT NULL,
  status_code   INT,
  response_body JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, key)
);

-- 24 soatdan eski kalitlarni tozalash uchun
CREATE INDEX idempotency_cleanup_idx ON idempotency_keys (created_at);

-- ============================================================
-- 2) OMBOR REZERVINI QAYTARISH
-- ============================================================

CREATE OR REPLACE FUNCTION release_order_stock() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  -- Buyurtma faol holatdan chiqdi
  IF OLD.status IN ('new', 'seen', 'confirmed', 'ready')
     AND NEW.status IN ('completed', 'cancelled', 'rejected', 'expired') THEN

    IF NEW.status = 'completed' THEN
      -- Tovar sotildi: ham rezerv, ham ombor kamayadi
      UPDATE variant_stock vs
         SET stock    = GREATEST(0, vs.stock - oi.qty),
             reserved = GREATEST(0, vs.reserved - oi.qty)
        FROM order_items oi
       WHERE oi.order_id = NEW.id
         AND vs.variant_id = oi.variant_id
         AND vs.size = oi.size;
    ELSE
      -- Buyurtma amalga oshmadi: tovar omborga qaytadi
      UPDATE variant_stock vs
         SET reserved = GREATEST(0, vs.reserved - oi.qty)
        FROM order_items oi
       WHERE oi.order_id = NEW.id
         AND vs.variant_id = oi.variant_id
         AND vs.size = oi.size;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER orders_release_stock
  AFTER UPDATE OF status ON orders
  FOR EACH ROW EXECUTE FUNCTION release_order_stock();

-- ============================================================
-- 3) MUDDATI O'TGAN BUYURTMALAR (cron har 10 daqiqada chaqiradi)
-- ============================================================

CREATE OR REPLACE FUNCTION expire_stale_orders() RETURNS INT AS $$
DECLARE
  affected INT;
BEGIN
  -- `system` aktori: order_events jurnalida kim o'zgartirgani ko'rinadi
  PERFORM set_config('app.actor_type', 'system', true);
  PERFORM set_config('app.channel', 'cron', true);

  WITH expired AS (
    UPDATE orders
       SET status = 'expired'
     WHERE status = 'new'
       AND expires_at < now()
    RETURNING 1
  )
  SELECT COUNT(*) INTO affected FROM expired;

  RETURN affected;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION expire_stale_orders() IS
  'Sotuvchi 24 soatda javob bermagan buyurtmalarni yopadi. Rezerv trigger orqali qaytadi.';
