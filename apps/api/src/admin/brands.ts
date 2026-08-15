import type { BrandCreateInput, BrandUpdateInput } from '@looksave/validation';

import { pool } from '../db/pool';
import { ApiError } from '../http/api-error';
import { slugify, uniqueSlug } from '../store/slug';

export interface BrandRow {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  description: string | null;
  is_partner: boolean;
  sort_order: number;
  product_count: string;
}

export interface BrandDto {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  description: string | null;
  isPartner: boolean;
  sortOrder: number;
  /** Nechta mahsulot shu brendga bog'langan — o'chirishdan oldin ogohlantirish uchun */
  productCount: number;
}

export function toBrandDto(row: BrandRow): BrandDto {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    logoUrl: row.logo_url,
    description: row.description,
    isPartner: row.is_partner,
    sortOrder: row.sort_order,
    productCount: Number(row.product_count),
  };
}

const COLUMNS = `b.id, b.name, b.slug, b.logo_url, b.description, b.is_partner, b.sort_order,
                 (SELECT count(*) FROM products p WHERE p.brand_id = b.id) AS product_count`;

export async function findBrands(): Promise<BrandRow[]> {
  const { rows } = await pool.query<BrandRow>(
    `SELECT ${COLUMNS} FROM brands b ORDER BY b.sort_order, b.name`,
  );
  return rows;
}

/**
 * Slug berilmasa nomdan yasaladi. Band bo'lsa oxiriga raqam qo'shiladi —
 * `uniqueSlug` do'kon slug'lari bilan bir xil mantiqda ishlaydi (store/slug.ts).
 */
async function resolveSlug(name: string, requested?: string): Promise<string> {
  if (requested) {
    const { rowCount } = await pool.query(`SELECT 1 FROM brands WHERE slug = $1`, [requested]);
    if (rowCount) throw new ApiError('ALREADY_EXISTS', 'Bu slug band');
    return requested;
  }

  const base = slugify(name);
  if (!base)
    throw new ApiError('VALIDATION_ERROR', 'Nomdan slug yasab bo`lmadi, uni qo`lda kiriting');

  const { rows } = await pool.query<{ slug: string }>(`SELECT slug FROM brands`);
  const slug = uniqueSlug(base, new Set(rows.map((row) => row.slug)));
  if (!slug) throw new ApiError('ALREADY_EXISTS', 'Bunday nomli brendlar juda ko`p, slug kiriting');

  return slug;
}

export async function createBrand(input: BrandCreateInput): Promise<BrandDto> {
  const slug = await resolveSlug(input.name, input.slug);

  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO brands (name, slug, logo_url, description, is_partner, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [
      input.name,
      slug,
      input.logoUrl ?? null,
      input.description ?? null,
      input.isPartner,
      input.sortOrder,
    ],
  );

  return getBrand(rows[0]!.id);
}

export async function getBrand(id: string): Promise<BrandDto> {
  const { rows } = await pool.query<BrandRow>(`SELECT ${COLUMNS} FROM brands b WHERE b.id = $1`, [
    id,
  ]);
  const row = rows[0];
  if (!row) throw new ApiError('NOT_FOUND', 'Brend topilmadi');
  return toBrandDto(row);
}

export async function updateBrand(id: string, input: BrandUpdateInput): Promise<BrandDto> {
  const current = await getBrand(id);

  // Slug faqat ochiq yuborilganda o'zgaradi — nom o'zgarganda eski havolalar
  // buzilmasligi uchun avtomatik qayta yasalmaydi.
  let slug = current.slug;
  if (input.slug !== undefined && input.slug !== current.slug) {
    slug = await resolveSlug(input.name ?? current.name, input.slug);
  }

  const { rows } = await pool.query<{ id: string }>(
    `UPDATE brands
        SET name = $2, slug = $3, logo_url = $4, description = $5,
            is_partner = $6, sort_order = $7
      WHERE id = $1
      RETURNING id`,
    [
      id,
      input.name ?? current.name,
      slug,
      input.logoUrl !== undefined ? input.logoUrl : current.logoUrl,
      input.description !== undefined ? input.description : current.description,
      input.isPartner ?? current.isPartner,
      input.sortOrder ?? current.sortOrder,
    ],
  );
  if (!rows[0]) throw new ApiError('NOT_FOUND', 'Brend topilmadi');

  return getBrand(id);
}

/**
 * Brendga bog'langan mahsulot bo'lsa o'chirilmaydi — aks holda katalogda
 * brendsiz mahsulotlar paydo bo'lardi.
 */
export async function deleteBrand(id: string): Promise<void> {
  const brand = await getBrand(id);

  if (brand.productCount > 0) {
    throw new ApiError(
      'INVALID_STATE',
      `Bu brendda ${brand.productCount} ta mahsulot bor. Avval ularni boshqa brendga o'tkazing.`,
    );
  }

  await pool.query(`DELETE FROM brands WHERE id = $1`, [id]);
}
