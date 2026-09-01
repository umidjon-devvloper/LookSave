import { api } from './client';

export type ProductStatus = 'draft' | 'pending' | 'active' | 'archived' | 'rejected';

export interface StoreProduct {
  id: string;
  title: string;
  status: ProductStatus;
  image: string | null;
  category: { slug: string; name: string };
  price: string;
  oldPrice: string | null;
  currency: string;
  stock: { total: number; reserved: number; available: number };
  canTryOn: boolean;
  viewCount: number;
  tryonCount: number;
  createdAt: string;
}

export interface SizeStock {
  size: string;
  stock: number;
  sku?: string;
}

export interface VariantInput {
  colorHex?: string;
  colorName?: Record<string, string>;
  images: string[];
  priceDelta: string;
  sizes: SizeStock[];
}

export interface CreateProductBody {
  title: string;
  description?: string;
  categoryId: string;
  brandId?: string;
  gender: 'male' | 'female' | 'unisex';
  basePrice: string;
  oldPrice?: string;
  images: string[];
  tags: string[];
  isLimited: boolean;
  status: 'draft' | 'pending';
  variants: VariantInput[];
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  slot: string | null;
  sizeType: string | null;
  children: Category[];
}

export interface Brand {
  id: string;
  name: string;
  slug: string;
}

export interface PresignResult {
  uploadUrl: string;
  publicUrl: string;
  expiresIn: number;
  /**
   * PUT so'rovida aynan shu sarlavhalar yuborilishi kerak.
   * Ular imzoga kirmagan, lekin yuborilmasa R2 obyektni kesh
   * sarlavhasisiz saqlaydi va CDN keshi ishlamaydi.
   */
  headers: Record<string, string>;
}

export const getStoreProducts = (
  status: ProductStatus | 'all',
  q?: string,
): Promise<StoreProduct[]> => {
  const params = new URLSearchParams({ status, limit: '50' });
  if (q && q.length >= 2) params.set('q', q);
  return api<StoreProduct[]>(`/store/products?${params.toString()}`);
};

export const createProduct = (body: CreateProductBody): Promise<{ id: string }> =>
  api<{ id: string }>('/store/products', { method: 'POST', body });

export const updateProduct = (
  id: string,
  body: Partial<Omit<CreateProductBody, 'variants'>>,
): Promise<unknown> => api(`/store/products/${id}`, { method: 'PATCH', body });

export const archiveProduct = (id: string): Promise<void> =>
  api<void>(`/store/products/${id}`, { method: 'DELETE' });

export const getCategories = (): Promise<Category[]> => api<Category[]>('/categories');

export const getBrands = (): Promise<Brand[]> => api<Brand[]>('/brands');

export type UploadPurpose = 'product' | 'store';

const presign = (
  fileName: string,
  contentType: string,
  purpose: UploadPurpose,
): Promise<PresignResult> =>
  api<PresignResult>('/store/uploads/presign', {
    method: 'POST',
    body: { fileName, contentType, purpose },
  });

/**
 * Rasm to'g'ridan-to'g'ri R2 ga yuklanadi — serverdan o'tmaydi,
 * VPS kanali bo'shab qoladi (09-integrations §4.2).
 */
export async function uploadImage(file: File, purpose: UploadPurpose = 'product'): Promise<string> {
  if (!['image/webp', 'image/jpeg', 'image/png'].includes(file.type)) {
    throw new Error('Faqat WEBP, JPEG yoki PNG');
  }
  if (file.size > 8 * 1024 * 1024) {
    throw new Error("Rasm 8 MB dan katta bo'lmasin");
  }

  const signed = await presign(file.name, file.type, purpose);

  const response = await fetch(signed.uploadUrl, {
    method: 'PUT',
    headers: signed.headers,
    body: file,
  });

  if (!response.ok) {
    throw new Error('Rasm yuklanmadi. Qaytadan urinib ko`ring.');
  }

  return signed.publicUrl;
}

export interface StoreProductDetail {
  id: string;
  title: string;
  description: string | null;
  status: ProductStatus;
  price: string;
  oldPrice: string | null;
  currency: string;
  images: string[];
  tags: string[];
  isLimited: boolean;
  gender: 'male' | 'female' | 'unisex';
  categoryId: string;
  categorySlug: string;
  brandId: string | null;
  createdAt: string;
  variants: Array<{
    id: string;
    colorHex: string | null;
    colorName: string;
    priceDelta: string;
    images: string[];
    assetStatus: string | null;
    sizes: Array<{ size: string; stock: number; reserved: number }>;
  }>;
}

export const getStoreProduct = (id: string): Promise<StoreProductDetail> =>
  api<StoreProductDetail>(`/store/products/${id}`);

export const updateStock = (
  variantId: string,
  sizes: Array<{ size: string; stock: number }>,
): Promise<Array<{ size: string; stock: number; reserved: number }>> =>
  api(`/store/variants/${variantId}/stock`, { method: 'PATCH', body: { sizes } });
