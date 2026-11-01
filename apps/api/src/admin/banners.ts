import type { BannerCreateInput, BannerUpdateInput } from '@looksave/validation';

import { pool } from '../db/pool';
import { ApiError } from '../http/api-error';

interface BannerRow {
  id: string;
  title: string;
  subtitle: string | null;
  image_url: string;
  target_url: string | null;
  audience: 'all' | 'men' | 'women' | 'limited';
  is_active: boolean;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
}

export interface BannerDto {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  targetUrl: string | null;
  audience: BannerRow['audience'];
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

function toDto(row: BannerRow): BannerDto {
  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle,
    imageUrl: row.image_url,
    targetUrl: row.target_url,
    audience: row.audience,
    isActive: row.is_active,
    sortOrder: row.sort_order,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

const COLUMNS = `id, title, subtitle, image_url, target_url, audience,
                 is_active, sort_order, created_at, updated_at`;

export async function findBanners(): Promise<BannerDto[]> {
  const { rows } = await pool.query<BannerRow>(
    `SELECT ${COLUMNS} FROM marketplace_banners ORDER BY sort_order, created_at DESC`,
  );
  return rows.map(toDto);
}

export async function findActiveBanners(
  audience: BannerRow['audience'],
): Promise<BannerDto[]> {
  const { rows } = await pool.query<BannerRow>(
    `SELECT ${COLUMNS}
       FROM marketplace_banners
      WHERE is_active AND (audience = 'all' OR audience = $1)
      ORDER BY sort_order, created_at DESC`,
    [audience],
  );
  return rows.map(toDto);
}

export async function createBanner(input: BannerCreateInput): Promise<BannerDto> {
  const { rows } = await pool.query<BannerRow>(
    `INSERT INTO marketplace_banners
       (title, subtitle, image_url, target_url, audience, is_active, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING ${COLUMNS}`,
    [
      input.title,
      input.subtitle ?? null,
      input.imageUrl,
      input.targetUrl ?? null,
      input.audience,
      input.isActive,
      input.sortOrder,
    ],
  );
  const row = rows[0];
  if (!row) throw new ApiError('INTERNAL_ERROR', 'Banner yaratilmadi');
  return toDto(row);
}

export async function updateBanner(id: string, input: BannerUpdateInput): Promise<BannerDto> {
  const current = await pool.query<BannerRow>(
    `SELECT ${COLUMNS} FROM marketplace_banners WHERE id = $1`,
    [id],
  );
  const row = current.rows[0];
  if (!row) throw new ApiError('NOT_FOUND', 'Banner topilmadi');

  const { rows } = await pool.query<BannerRow>(
    `UPDATE marketplace_banners
        SET title = $2, subtitle = $3, image_url = $4, target_url = $5,
            audience = $6, is_active = $7, sort_order = $8, updated_at = now()
      WHERE id = $1
      RETURNING ${COLUMNS}`,
    [
      id,
      input.title ?? row.title,
      input.subtitle === undefined ? row.subtitle : input.subtitle,
      input.imageUrl ?? row.image_url,
      input.targetUrl === undefined ? row.target_url : input.targetUrl,
      input.audience ?? row.audience,
      input.isActive ?? row.is_active,
      input.sortOrder ?? row.sort_order,
    ],
  );
  const updated = rows[0];
  if (!updated) throw new ApiError('NOT_FOUND', 'Banner topilmadi');
  return toDto(updated);
}

export async function deleteBanner(id: string): Promise<void> {
  const result = await pool.query('DELETE FROM marketplace_banners WHERE id = $1', [id]);
  if (result.rowCount === 0) throw new ApiError('NOT_FOUND', 'Banner topilmadi');
}
