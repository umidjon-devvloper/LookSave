import { idParamSchema, pointQuerySchema, productsQuerySchema } from '@looksave/validation';
import { Router } from 'express';

import { paginate } from '../catalog/cursor';
import { computeOpenState } from '../catalog/hours';
import { localeOf, pickName } from '../catalog/locale';
import {
  findProductById,
  findProductVariants,
  findProducts,
  findVariantAsset,
  incrementViewCount,
  isFavorite,
  productCursorKey,
  toProductListDto,
  type VariantRow,
} from '../catalog/products';
import { ApiError } from '../http/api-error';
import { getAuthOptional } from '../http/auth-middleware';
import { sendData, sendList } from '../http/respond';
import { route } from '../http/validate';
import { logger } from '../logger';

export const productsRouter: Router = Router();

/** GET /v1/products — katalog filtri, keyset pagination */
productsRouter.get(
  '/products',
  route({ query: productsQuerySchema }, async (input, _req, res) => {
    const rows = await findProducts(input.query);
    const keyOf = productCursorKey(input.query.sort);

    const page = paginate(rows, input.query.limit, (row) => ({ k: keyOf(row), id: row.id }));
    sendList(res, page.items.map(toProductListDto), page);
  }),
);

/** GET /v1/stores/:id/products — `/products` bilan bir xil filtrlar */
productsRouter.get(
  '/stores/:id/products',
  route({ params: idParamSchema, query: productsQuerySchema }, async (input, _req, res) => {
    const rows = await findProducts({ ...input.query, storeId: input.params.id });
    const keyOf = productCursorKey(input.query.sort);

    const page = paginate(rows, input.query.limit, (row) => ({ k: keyOf(row), id: row.id }));
    sendList(res, page.items.map(toProductListDto), page);
  }),
);

function toAsset3d(row: VariantRow): Record<string, unknown> | null {
  if (row.asset_status === null) return null;
  return {
    status: row.asset_status,
    glbUrl: row.glb_url,
    lodUrls: row.lod_urls,
    thumbnailUrl: row.thumbnail_url,
    fileSizeBytes: row.file_size_bytes,
    hideBodyParts: row.hide_body_parts ?? [],
    hasMorphs: row.has_morphs ?? false,
  };
}

const SIZE_SYSTEMS: Record<string, string | null> = {
  shoes: 'EU',
  clothing: 'INT',
  onesize: null,
};

/** GET /v1/products/:id */
productsRouter.get(
  '/products/:id',
  route(
    {
      params: idParamSchema,
      query: pointQuerySchema,
    },
    async (input, req, res) => {
      const point =
        input.query.lat !== undefined && input.query.lng !== undefined
          ? { lat: input.query.lat, lng: input.query.lng }
          : null;

      const product = await findProductById(input.params.id, point);
      if (!product) throw ApiError.notFound('Mahsulot topilmadi');

      const [variants, auth] = [await findProductVariants(product.id), getAuthOptional(res)];
      const locale = localeOf(req);
      const open = computeOpenState(product.store_working_hours, product.store_country);

      // Sanoq javobni kechiktirmasin — xato bo'lsa faqat log'ga tushadi
      void incrementViewCount(product.id).catch((err: unknown) => {
        logger.warn({ err, productId: product.id }, 'view_count yangilanmadi');
      });

      sendData(res, {
        id: product.id,
        title: product.title,
        description: product.description,
        category: {
          id: product.category_id,
          slug: product.category_slug,
          name: pickName(product.category_name, locale),
        },
        slot: product.slot,
        gender: product.gender,
        brand: product.brand_id
          ? {
              id: product.brand_id,
              name: product.brand_name,
              // Logo faqat shartnoma bo'lsa (00-README §8)
              logoUrl: product.brand_is_partner === true ? product.brand_logo : null,
            }
          : null,
        store: {
          id: product.store_id,
          name: product.store_name,
          logoUrl: product.store_logo,
          distanceM: product.distance_m,
          isOpen: open.isOpen,
          avgResponseMin: product.store_avg_response_min,
        },
        price: product.base_price,
        oldPrice: product.old_price,
        currency: product.currency,
        images: Array.isArray(product.images) ? product.images : [],
        tags: product.tags,
        isLimited: product.is_limited,
        variants: variants.map((variant) => ({
          id: variant.id,
          colorHex: variant.color_hex,
          colorName: pickName(variant.color_name, locale),
          images: Array.isArray(variant.images) ? variant.images : [],
          priceDelta: variant.price_delta,
          sizes: (variant.sizes ?? []).map((size) => ({
            size: size.size,
            available: size.stock > size.reserved,
            stock: Math.max(0, size.stock - size.reserved),
          })),
          asset3d: toAsset3d(variant),
        })),
        isFavorite: auth ? await isFavorite(auth.sub, product.id) : false,
        sizeChart: product.size_type
          ? { type: product.size_type, system: SIZE_SYSTEMS[product.size_type] ?? null }
          : null,
      });
    },
  ),
);

/** GET /v1/variants/:id/asset3d — Try-On uchun bitta modelni olish */
productsRouter.get(
  '/variants/:id/asset3d',
  route({ params: idParamSchema }, async (input, _req, res) => {
    const variant = await findVariantAsset(input.params.id);
    if (!variant) throw ApiError.notFound('Variant topilmadi');

    const asset = toAsset3d(variant);
    if (!asset || variant.asset_status !== 'ready') {
      throw ApiError.notFound('Bu variant uchun 3D model tayyor emas');
    }

    res.setHeader('Cache-Control', 'public, max-age=3600');
    sendData(res, { variantId: variant.id, ...asset });
  }),
);
