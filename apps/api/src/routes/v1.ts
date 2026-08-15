import { localeSchema } from '@looksave/validation';
import { Router } from 'express';
import { z } from 'zod';

import { pool } from '../db/pool';
import { sendData } from '../http/respond';
import { route } from '../http/validate';

export const v1Router: Router = Router();

interface CategoryRow {
  id: string;
  parent_id: string | null;
  slug: string;
  name: Record<string, string>;
  icon: string | null;
  slot: string | null;
  size_type: string | null;
  sort_order: number;
}

interface CategoryNode {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  slot: string | null;
  sizeType: string | null;
  children: CategoryNode[];
}

/**
 * Nom `Accept-Language` bo'yicha tanlanadi. Tanlangan til bo'lmasa —
 * `en`, u ham bo'lmasa birinchi mavjud qiymat (bo'sh nom qaytmasligi uchun).
 */
function pickName(name: Record<string, string>, locale: string): string {
  return name[locale] ?? name['en'] ?? Object.values(name)[0] ?? '';
}

function toNode(row: CategoryRow, locale: string): CategoryNode {
  return {
    id: row.id,
    slug: row.slug,
    name: pickName(row.name, locale),
    icon: row.icon,
    slot: row.slot,
    sizeType: row.size_type,
    children: [],
  };
}

/** GET /v1/categories — daraxt ko'rinishida (03-api-spec §8). */
v1Router.get(
  '/categories',
  route({ query: z.object({ locale: localeSchema.optional() }) }, async (input, req, res) => {
    const headerLocale = localeSchema.safeParse(req.get('Accept-Language')?.slice(0, 2));
    const locale = input.query.locale ?? (headerLocale.success ? headerLocale.data : 'uz');

    const { rows } = await pool.query<CategoryRow>(
      `SELECT id, parent_id, slug, name, icon, slot, size_type, sort_order
         FROM categories
        WHERE is_active
        ORDER BY sort_order, slug`,
    );

    const byId = new Map<string, CategoryNode>();
    for (const row of rows) byId.set(row.id, toNode(row, locale));

    const roots: CategoryNode[] = [];
    for (const row of rows) {
      const node = byId.get(row.id);
      if (!node) continue;
      const parent = row.parent_id === null ? undefined : byId.get(row.parent_id);
      if (parent) parent.children.push(node);
      else roots.push(node);
    }

    // Kategoriya daraxti kamdan-kam o'zgaradi (03-api-spec §8: 24 soat)
    res.setHeader('Cache-Control', 'public, max-age=86400');
    sendData(res, roots);
  }),
);

interface BrandRow {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  is_partner: boolean;
}

/** GET /v1/brands */
v1Router.get('/brands', async (_req, res) => {
  const { rows } = await pool.query<BrandRow>(
    `SELECT id, name, slug, logo_url, is_partner
       FROM brands
      ORDER BY sort_order, name`,
  );

  res.setHeader('Cache-Control', 'public, max-age=3600');
  sendData(
    res,
    rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      // ⚠️ Logo faqat shartnoma bo'lsa ko'rsatiladi (00-README §8)
      logoUrl: row.is_partner ? row.logo_url : null,
      isPartner: row.is_partner,
    })),
  );
});
