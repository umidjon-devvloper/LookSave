-- 007_functions.sql
-- Trigger funksiyalari: updated_at, buyurtma raqami, status jurnali,
-- vaqt belgilari, ishonch balli, qora ro'yxat eskalatsiyasi, has_3d.
-- docs/02-database.md §8

-- ============================================================
-- 1) updated_at avtomatik yangilanishi
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated    BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER profiles_updated BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER stores_updated   BEFORE UPDATE ON stores
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER products_updated BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ============================================================
-- 2) Buyurtma raqami: LS-260812-0043
-- ============================================================

CREATE OR REPLACE FUNCTION next_order_number() RETURNS TEXT AS $$
DECLARE n INT;
BEGIN
  INSERT INTO order_counters (day, counter)
  VALUES (CURRENT_DATE, 1)
  ON CONFLICT (day) DO UPDATE SET counter = order_counters.counter + 1
  RETURNING counter INTO n;

  RETURN 'LS-' || to_char(CURRENT_DATE, 'YYMMDD') || '-' || lpad(n::text, 4, '0');
END;
$$ LANGUAGE plpgsql;


CREATE OR REPLACE FUNCTION prepare_order() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := next_order_number();
  END IF;
  IF NEW.expires_at IS NULL THEN
    NEW.expires_at := now() + interval '24 hours';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER orders_prepare BEFORE INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION prepare_order();


-- ============================================================
-- 3) Status o'zgarishini jurnalga yozish
-- Ilova `SET LOCAL app.actor_type = 'store'` qilib yuboradi
-- ============================================================

CREATE OR REPLACE FUNCTION log_order_status() RETURNS TRIGGER AS $$
DECLARE
  a_type TEXT := COALESCE(NULLIF(current_setting('app.actor_type', true), ''), 'system');
  a_id   TEXT := NULLIF(current_setting('app.actor_id', true), '');
  a_ch   TEXT := NULLIF(current_setting('app.channel', true), '');
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO order_events (order_id, from_status, to_status,
                              actor_type, actor_id, channel)
    VALUES (NEW.id, NULL, NEW.status, a_type, a_id::UUID, a_ch);

  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO order_events (order_id, from_status, to_status,
                              actor_type, actor_id, channel)
    VALUES (NEW.id, OLD.status, NEW.status, a_type, a_id::UUID, a_ch);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER orders_log_insert AFTER INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION log_order_status();
CREATE TRIGGER orders_log_update AFTER UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION log_order_status();


-- ============================================================
-- 4) Vaqt belgilarini avtomatik qo'yish
-- ============================================================

CREATE OR REPLACE FUNCTION stamp_order_times() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    CASE NEW.status
      WHEN 'seen'      THEN NEW.seen_at      := COALESCE(NEW.seen_at, now());
      WHEN 'confirmed' THEN NEW.confirmed_at := COALESCE(NEW.confirmed_at, now());
      WHEN 'ready'     THEN NEW.ready_at     := COALESCE(NEW.ready_at, now());
      WHEN 'completed' THEN NEW.completed_at := COALESCE(NEW.completed_at, now());
      ELSE NULL;
    END CASE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER orders_stamp BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION stamp_order_times();


-- ============================================================
-- 5) user_trust avtomatik yangilanishi
-- ============================================================

CREATE OR REPLACE FUNCTION update_user_trust() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_trust (user_id) VALUES (NEW.user_id)
  ON CONFLICT (user_id) DO NOTHING;

  IF TG_OP = 'INSERT' THEN
    UPDATE user_trust SET orders_total = orders_total + 1, updated_at = now()
    WHERE user_id = NEW.user_id;
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    UPDATE user_trust SET
      orders_completed = orders_completed + (NEW.status = 'completed')::int,
      orders_cancelled = orders_cancelled + (NEW.status = 'cancelled')::int,
      orders_expired   = orders_expired   + (NEW.status = 'expired')::int,
      updated_at = now()
    WHERE user_id = NEW.user_id;

    -- 3 marta expired/cancelled → 7 kun cheklov
    UPDATE user_trust SET
      is_restricted = true,
      restricted_until = now() + interval '7 days',
      restriction_note = 'auto: 3+ bekor qilingan yoki javobsiz buyurtma'
    WHERE user_id = NEW.user_id
      AND (orders_cancelled + orders_expired + orders_noshow) >= 3
      AND orders_completed = 0
      AND NOT is_restricted;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER orders_trust_insert AFTER INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION update_user_trust();
CREATE TRIGGER orders_trust_update AFTER UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_user_trust();


-- ============================================================
-- 6) 3 do'kon bloklasa → global blok
-- ============================================================

CREATE OR REPLACE FUNCTION escalate_blocklist() RETURNS TRIGGER AS $$
DECLARE cnt INT;
BEGIN
  IF NEW.store_id IS NULL THEN RETURN NEW; END IF;

  SELECT COUNT(DISTINCT store_id) INTO cnt
  FROM order_blocklist
  WHERE phone = NEW.phone AND store_id IS NOT NULL;

  IF cnt >= 3 THEN
    INSERT INTO order_blocklist (store_id, phone, user_id, reason, created_by)
    VALUES (NULL, NEW.phone, NEW.user_id,
            format('auto: %s ta do''kon bloklagan', cnt), 'system')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER blocklist_escalate AFTER INSERT ON order_blocklist
  FOR EACH ROW EXECUTE FUNCTION escalate_blocklist();


-- ============================================================
-- 7) has_3d bayrog'ini yangilash
-- ============================================================

CREATE OR REPLACE FUNCTION sync_product_has_3d() RETURNS TRIGGER AS $$
DECLARE
  vid UUID;
  pid UUID;
BEGIN
  -- DELETE da NEW mavjud emas (plpgsql'da NEW.field ga murojaat xato beradi),
  -- shuning uchun TG_OP bo'yicha ajratiladi.
  IF TG_OP = 'DELETE' THEN
    vid := OLD.variant_id;
  ELSE
    vid := NEW.variant_id;
  END IF;

  SELECT product_id INTO pid FROM product_variants WHERE id = vid;
  IF pid IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE products p SET has_3d = EXISTS (
    SELECT 1 FROM product_variants v
    JOIN assets_3d a ON a.variant_id = v.id
    WHERE v.product_id = pid AND a.status = 'ready'
  ) WHERE p.id = pid;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER assets_sync_has3d
  AFTER INSERT OR UPDATE OF status OR DELETE ON assets_3d
  FOR EACH ROW EXECUTE FUNCTION sync_product_has_3d();
