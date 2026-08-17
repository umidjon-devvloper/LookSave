import type { AuthResult, AuthUser } from '@looksave/shared-types';

import { api, apiList, saveTokens } from './client';

// ── Auth ──

export async function register(input: {
  phone: string;
  fullName: string;
  password: string;
}): Promise<AuthUser> {
  const result = await api<AuthResult>('/auth/register', { method: 'POST', body: input });
  await saveTokens(result.accessToken, result.refreshToken);
  return result.user;
}

export async function login(phone: string, password: string): Promise<AuthUser> {
  const result = await api<AuthResult>('/auth/login', {
    method: 'POST',
    body: { phone, password },
  });
  await saveTokens(result.accessToken, result.refreshToken);
  return result.user;
}

export const getProfile = (): Promise<AuthUser> => api<AuthUser>('/profile');

// ── Do'konlar ──

export interface NearbyStore {
  id: string;
  name: string;
  logoUrl: string | null;
  address: string;
  distanceM: number;
  rating: number;
  isOpen: boolean;
  closesAt: string | null;
  opensAt: string | null;
  productCount: number;
  product3dCount: number;
  currency: string;
  location: { lat: number; lng: number };
}

export const getNearbyStores = (
  lat: number,
  lng: number,
  options: { radius?: number; only3d?: boolean; openNow?: boolean } = {},
): Promise<NearbyStore[]> => {
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    radius: String(options.radius ?? 5000),
  });
  if (options.only3d) params.set('only3d', 'true');
  if (options.openNow) params.set('openNow', 'true');
  return api<NearbyStore[]>(`/stores/nearby?${params.toString()}`);
};

// ── Katalog ──

export interface ProductCard {
  id: string;
  title: string;
  brand: { id: string; name: string } | null;
  store: { id: string; name: string; distanceM: number | null };
  price: string;
  oldPrice: string | null;
  currency: string;
  image: string | null;
  has3d: boolean;
  isLimited: boolean;
  availableSizes: string[];
}

export type ProductSort = 'newest' | 'popular' | 'priceAsc' | 'priceDesc' | 'nearest';

export interface ProductFilters {
  category?: string;
  gender?: string;
  brand?: string;
  q?: string;
  only3d?: boolean;
  sort?: ProductSort;
  lat?: number;
  lng?: number;
  cursor?: string;
}

export function getProducts(filters: ProductFilters = {}) {
  const params = new URLSearchParams({ limit: '20' });
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  return apiList<ProductCard>(`/products?${params.toString()}`);
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  slot: string | null;
  sizeType: string | null;
  children: Category[];
}

export const getCategories = (): Promise<Category[]> => api<Category[]>('/categories');

export interface Brand {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  isPartner: boolean;
}

/** Deckdagi "TOP BRANDS" qatori (08-slayd). */
export const getBrands = (): Promise<Brand[]> => api<Brand[]>('/brands');

// ── Savat ──

export interface CartStore {
  store: { id: string; name: string; currency: string };
  items: Array<{
    id: string;
    variantId: string;
    productId: string;
    title: string;
    colorName: string;
    image: string | null;
    size: string;
    qty: number;
    unitPrice: string;
    totalPrice: string;
    available: boolean;
    stock: number;
  }>;
  subtotal: string;
  deliveryFee: string;
  total: string;
}

export interface Cart {
  stores: CartStore[];
  itemCount: number;
}

export const getCart = (): Promise<Cart> => api<Cart>('/cart');

export const addToCart = (variantId: string, size: string, qty = 1): Promise<Cart> =>
  api<Cart>('/cart/items', { method: 'POST', body: { variantId, size, qty } });

export const setCartItemQty = (itemId: string, qty: number): Promise<Cart> =>
  api<Cart>(`/cart/items/${itemId}`, { method: 'PATCH', body: { qty } });

export const removeCartItem = (itemId: string): Promise<Cart> =>
  api<Cart>(`/cart/items/${itemId}`, { method: 'DELETE' });

// ── Buyurtmalar ──

export interface OrderCard {
  id: string;
  orderNumber: string;
  status: string;
  statusLabel: string;
  createdAt: string;
  expiresAt: string;
  deliveryType: string;
  total: string;
  currency: string;
  itemCount: number;
  preview: { title: string | null; image: string | null };
  store: { id: string; name: string; logoUrl: string | null };
  canCancel: boolean;
}

export const getOrders = (status: 'active' | 'completed' | 'cancelled' | 'all' = 'active') =>
  apiList<OrderCard>(`/orders?status=${status}&limit=20`);

export const cancelOrder = (id: string, reason?: string): Promise<unknown> =>
  api(`/orders/${id}/cancel`, { method: 'POST', body: reason ? { reason } : {} });

// ── Buyurtma yaratish ──

export interface CreateOrderInput {
  storeId: string;
  deliveryType: 'delivery' | 'pickup';
  contactName: string;
  contactPhone: string;
  address?: { text: string; lat: number; lng: number; landmark?: string };
  note?: string;
  items: Array<{ variantId: string; size: string; qty: number }>;
}

export interface CreatedOrder {
  id: string;
  orderNumber: string;
  status: string;
  statusLabel: string;
  expiresAt: string;
  store: { id: string; name: string; phone: string; avgResponseMin: number | null };
  subtotal: string;
  deliveryFee: string;
  total: string;
  currency: string;
  paymentNote: string;
}

/**
 * `Idempotency-Key` MAJBURIY — tarmoq uzilib ilova so'rovni qayta
 * yuborsa, ikkinchi buyurtma yaratilmaydi (03-api-spec §12).
 * Kalit har urinishda emas, har CHECKOUT uchun bir marta yaratiladi.
 */
export const createOrder = (input: CreateOrderInput, idempotencyKey: string) =>
  api<CreatedOrder>('/orders', { method: 'POST', body: input, idempotencyKey });

export interface OrderDetail {
  id: string;
  orderNumber: string;
  status: string;
  statusLabel: string;
  createdAt: string;
  expiresAt: string;
  deliveryType: 'delivery' | 'pickup';
  contactName: string;
  contactPhone: string;
  address: { text?: string; lat?: number; lng?: number; landmark?: string } | null;
  note: string | null;
  store: {
    id: string;
    name: string;
    logoUrl: string | null;
    phone: string;
    location: { lat: number; lng: number };
  };
  items: Array<{
    title: string | null;
    image: string | null;
    brand: string | null;
    colorName: string | null;
    size: string;
    qty: number;
    unitPrice: string;
    totalPrice: string;
  }>;
  subtotal: string;
  deliveryFee: string;
  total: string;
  currency: string;
  paymentMethod: string;
  paymentStatus: string;
  rejectReason: string | null;
  cancelReason: string | null;
  canCancel: boolean;
}

export const getOrder = (id: string): Promise<OrderDetail> => api<OrderDetail>(`/orders/${id}`);

export interface StoreDetail {
  id: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  address: string;
  landmark: string | null;
  city: string;
  phone: string;
  location: { lat: number; lng: number };
  isOpen: boolean;
  closesAt: string | null;
  opensAt: string | null;
  rating: number;
  reviewCount: number;
  avgResponseMin: number | null;
  delivery: { enabled: boolean; radiusM: number; fee: string; freeFrom: string | null };
  pickupEnabled: boolean;
  currency: string;
  categories: Array<{ id: string; slug: string; name: string; count: number }>;
}

export const getStore = (id: string): Promise<StoreDetail> => api<StoreDetail>(`/stores/${id}`);

export const getStoreProducts = (storeId: string) =>
  apiList<ProductCard>(`/stores/${storeId}/products?limit=20`);

// ── Profil va o'lchamlar ──

export interface Measurements {
  height?: number;
  weight?: number;
  chest?: number;
  waist?: number;
  hips?: number;
  shoeSize?: number;
  shoeSizeSystem?: string;
}

export interface MorphTargets {
  height: number;
  weight: number;
  shoulderWidth: number;
  chest: number;
  waist: number;
  hips: number;
}

export interface FullProfile extends AuthUser {
  measurements: Measurements;
  morphTargets: MorphTargets;
  faceTextureUrl: string | null;
  faceScanStatus: string;
  favoritesCount: number;
  looksCount: number;
  trust: { isRestricted: boolean; openOrders: number };
}

export const getFullProfile = (): Promise<FullProfile> => api<FullProfile>('/profile');

export const updateProfile = (input: {
  fullName?: string;
  gender?: 'male' | 'female';
  locale?: string;
  avatarUrl?: string | null;
  /** Yuz skaneridagi surat — 3D avatar boshiga tekstura bo'lib tushadi */
  faceTextureUrl?: string | null;
}): Promise<FullProfile> => api<FullProfile>('/profile', { method: 'PATCH', body: input });

interface PresignResult {
  uploadUrl: string;
  publicUrl: string;
  headers: Record<string, string>;
}

/**
 * Profil surati to'g'ridan-to'g'ri R2 ga yuklanadi — server kanalini band
 * qilmaydi (09-integrations §4.2). Server faqat imzolangan havola beradi.
 */
export async function uploadAvatar(localUri: string): Promise<string> {
  const fileName = localUri.split('/').pop() ?? 'avatar.jpg';
  const contentType = fileName.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';

  const signed = await api<PresignResult>('/profile/uploads/presign', {
    method: 'POST',
    body: { fileName, contentType, purpose: 'avatar' },
  });

  // `fetch` lokal `file://` havolasini blob'ga o'giradi — RN'da shu usul ishlaydi
  const blob = await (await fetch(localUri)).blob();

  const response = await fetch(signed.uploadUrl, {
    method: 'PUT',
    headers: signed.headers,
    body: blob,
  });
  if (!response.ok) throw new Error('Surat yuklanmadi');

  return signed.publicUrl;
}

export const updateMeasurements = (
  input: Measurements,
): Promise<{ measurements: Measurements; morphTargets: MorphTargets }> =>
  api('/profile/measurements', { method: 'PATCH', body: input });

// ── Sevimlilar ──

export interface FavoriteProduct {
  id: string;
  title: string;
  price: string;
  currency: string;
  image: string | null;
  has3d: boolean;
  isAvailable: boolean;
  store: { id: string; name: string };
}

export const getFavorites = (): Promise<FavoriteProduct[]> =>
  api<FavoriteProduct[]>('/favorites?limit=50');

export const addFavorite = (productId: string): Promise<{ isFavorite: boolean }> =>
  api(`/favorites/${productId}`, { method: 'PUT', body: {} });

export const removeFavorite = (productId: string): Promise<{ isFavorite: boolean }> =>
  api(`/favorites/${productId}`, { method: 'DELETE' });

// ── Komplektlar ──

export interface LookItem {
  slot: string;
  variantId: string;
  size: string | null;
  title: string;
  colorName: string;
  price: string;
  currency: string;
}

export interface Look {
  id: string;
  name: string | null;
  thumbnailUrl: string | null;
  occasion: string | null;
  createdAt: string;
  items: LookItem[];
}

export const getLooks = (): Promise<Look[]> => api<Look[]>('/looks?limit=50');

export const createLook = (input: {
  name?: string;
  /** AI oqimida tanlangan tadbir — komplekt ro'yxatida ko'rinadi */
  occasion?: string;
  items: Array<{ slot: string; variantId: string; size?: string }>;
}): Promise<{ id: string }> => api('/looks', { method: 'POST', body: input });

export const deleteLook = (id: string): Promise<void> =>
  api<void>(`/looks/${id}`, { method: 'DELETE' });

// ── Xarita ──

export interface StoreMapResult {
  clusters: Array<{ lat: number; lng: number; count: number }>;
  markers: Array<{ id: string; name: string; logoUrl: string | null; lat: number; lng: number }>;
}

/**
 * Xaritadagi do'konlar. Zoom 12 dan past bo'lsa server klaster,
 * yuqori bo'lsa marker qaytaradi (03-api-spec §8).
 */
export const getStoresMap = (bounds: {
  swLat: number;
  swLng: number;
  neLat: number;
  neLng: number;
  zoom: number;
}): Promise<StoreMapResult> => {
  const query = new URLSearchParams({
    swLat: String(bounds.swLat),
    swLng: String(bounds.swLng),
    neLat: String(bounds.neLat),
    neLng: String(bounds.neLng),
    zoom: String(bounds.zoom),
  });

  return api<StoreMapResult>(`/stores/map?${query.toString()}`);
};

/**
 * Barcha faol do'konlar (300 tagacha) — masofadan qat'i nazar.
 *
 * NEGA XARITA ENDPOINTI: "hamma do'konlar" uchun alohida marshrut yo'q.
 * `GET /stores/nearby` radiusi eng ko'pi 50 km (`packages/validation`),
 * ya'ni boshqa viloyatdagi do'kon unga tushmaydi. `GET /stores/map` esa
 * `zoom >= 12` da chegara ichidagi hamma faol do'konni masofaga qaramay
 * qaytaradi — shuning uchun butun dunyo chegarasi beriladi.
 *
 * ⚠️ Marker'da faqat nom va koordinata bor: manzil, reyting va 3D
 * modellar soni yo'q. Masofa ilovada hisoblanadi (`map/distance.ts`).
 * Yaqin atrofdagilar uchun baribir `getNearbyStores` afzal — u boyroq
 * ma'lumot beradi.
 */
export const getAllStoreMarkers = (): Promise<StoreMapResult['markers']> =>
  getStoresMap({ swLat: -85, swLng: -180, neLat: 85, neLng: 180, zoom: 12 }).then(
    (result) => result.markers,
  );

// ── Akkauntni o'chirish (App Store talabi) ──

export interface DeletionStatus {
  pending: boolean;
  requestedAt: string | null;
  scheduledFor: string | null;
}

export const getDeletionStatus = (): Promise<DeletionStatus> =>
  api<DeletionStatus>('/auth/account/deletion');

/**
 * `confirm` doim `'DELETE'` — server shuni talab qiladi
 * (`deleteAccountSchema`). Foydalanuvchi shu so'zni qo'lda yozadi,
 * shunda tugma tasodifan bosilmaydi.
 */
export const deleteAccount = (
  password: string,
): Promise<{ deletionRequestedAt: string; scheduledFor: string }> =>
  api('/auth/account', { method: 'DELETE', body: { password, confirm: 'DELETE' } });

export const restoreAccount = (): Promise<{ restored: boolean }> =>
  api('/auth/account/restore', { method: 'POST', body: {} });
