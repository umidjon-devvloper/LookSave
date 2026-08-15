import { pool } from '../db/pool';

/**
 * Statistika va komissiya hisoblari (07-web-panels §4.6-4.7).
 *
 * Eng qimmatli raqam — **Try-On → buyurtma nisbati**. Mahsulot ko'p
 * kiyib ko'rilib kam sotib olinsa, sabab uchtadan biri: narx yuqori,
 * o'lcham yo'q yoki 3D model sifatsiz.
 */

export type Period = 7 | 30 | 90;

interface TotalsRow {
  views: string;
  tryons: string;
  orders: string;
  completed: string;
  revenue: string;
}

async function totals(storeId: string, days: number): Promise<TotalsRow> {
  const { rows } = await pool.query<TotalsRow>(
    `SELECT
       COALESCE((SELECT SUM(p.view_count) FROM products p WHERE p.store_id = $1), 0) AS views,
       (SELECT COUNT(*) FROM tryon_events e
          JOIN product_variants v ON v.id = e.variant_id
          JOIN products p ON p.id = v.product_id
         WHERE p.store_id = $1 AND e.created_at > now() - ($2 || ' days')::interval) AS tryons,
       (SELECT COUNT(*) FROM orders o
         WHERE o.store_id = $1 AND o.created_at > now() - ($2 || ' days')::interval) AS orders,
       (SELECT COUNT(*) FROM orders o
         WHERE o.store_id = $1 AND o.status = 'completed'
           AND o.created_at > now() - ($2 || ' days')::interval) AS completed,
       -- Pul: NUMERIC → text, aniqlik yo'qolmasin
       COALESCE((SELECT SUM(o.total)::text FROM orders o
                  WHERE o.store_id = $1 AND o.status = 'completed'
                    AND o.created_at > now() - ($2 || ' days')::interval), '0') AS revenue`,
    [storeId, String(days)],
  );

  return rows[0] ?? { views: '0', tryons: '0', orders: '0', completed: '0', revenue: '0' };
}

export async function getAnalytics(storeId: string, days: Period) {
  const current = await totals(storeId, days);

  const { rows: daily } = await pool.query<{ day: string; orders: string; completed: string }>(
    `SELECT to_char(d.day, 'YYYY-MM-DD') AS day,
            COUNT(o.id) AS orders,
            COUNT(o.id) FILTER (WHERE o.status = 'completed') AS completed
       FROM generate_series(
              date_trunc('day', now()) - ($2 || ' days')::interval,
              date_trunc('day', now()),
              interval '1 day'
            ) AS d(day)
       LEFT JOIN orders o ON o.store_id = $1 AND date_trunc('day', o.created_at) = d.day
      GROUP BY d.day
      ORDER BY d.day`,
    [storeId, String(days - 1)],
  );

  const { rows: top } = await pool.query<{
    id: string;
    title: string;
    views: number;
    tryons: number;
    orders: string;
  }>(
    `SELECT p.id, p.title, p.view_count AS views, p.tryon_count AS tryons,
            COUNT(oi.id) AS orders
       FROM products p
       LEFT JOIN product_variants v ON v.product_id = p.id
       LEFT JOIN order_items oi ON oi.variant_id = v.id
      WHERE p.store_id = $1
      GROUP BY p.id, p.title, p.view_count, p.tryon_count
      ORDER BY COUNT(oi.id) DESC, p.tryon_count DESC
      LIMIT 10`,
    [storeId],
  );

  const tryons = Number(current.tryons);
  const orders = Number(current.orders);

  return {
    period: days,
    totals: {
      views: Number(current.views),
      tryons,
      orders,
      completed: Number(current.completed),
      revenue: current.revenue,
      // Try-On qilganlarning necha foizi buyurtma berdi
      conversion: tryons === 0 ? null : Math.round((orders / tryons) * 1000) / 10,
    },
    daily: daily.map((row) => ({
      day: row.day,
      orders: Number(row.orders),
      completed: Number(row.completed),
    })),
    topProducts: top.map((row) => ({
      id: row.id,
      title: row.title,
      views: row.views,
      tryons: row.tryons,
      orders: Number(row.orders),
      // Mahsulot darajasidagi nisbat — qaysi model ishlamayotganini ko'rsatadi
      conversion:
        row.tryons === 0 ? null : Math.round((Number(row.orders) / row.tryons) * 1000) / 10,
    })),
  };
}

/**
 * Komissiya hisoblari. Faza 1-2 da stavka 0 (K-12) — raqamlar
 * yig'ilib boradi va keyinchalik argument bo'ladi.
 * Hisoblarni oyning 1-sanasida cron yaratadi (`jobs/scheduler.ts`).
 */
export async function getInvoices(storeId: string) {
  const { rows } = await pool.query<{
    id: string;
    period_start: Date;
    period_end: Date;
    orders_count: number;
    gross_amount: string;
    commission: string;
    currency: string;
    status: string;
  }>(
    `SELECT id, period_start, period_end, orders_count, gross_amount, commission,
            currency, status
       FROM store_invoices
      WHERE store_id = $1
      ORDER BY period_start DESC
      LIMIT 24`,
    [storeId],
  );

  return rows.map((row) => ({
    id: row.id,
    periodStart: row.period_start.toISOString().slice(0, 10),
    periodEnd: row.period_end.toISOString().slice(0, 10),
    ordersCount: row.orders_count,
    grossAmount: row.gross_amount,
    commission: row.commission,
    currency: row.currency,
    status: row.status,
    isFree: Number(row.commission) === 0,
  }));
}
