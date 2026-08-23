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
  /** To'liq bo'yli surat — AI kiyintirish shusiz ishlamaydi */
  bodyPhotoUrl: string | null;
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
  /**
   * Yuz skaneridagi surat. Asosiy vazifasi — AI avatar yasashda
   * o'xshashlikni belgilash (`face_reference`).
   *
   * ⚠️ 3D avatarga ham tekstura sifatida qo'llanadi, LEKIN bosh mesh'ida
   * yuz UV joylashuvi yo'q va natija dog' bo'lib chiqadi (12-tz.md D-41).
   */
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

// ============================================================
// AI kiyintirish
// ============================================================

/**
 * Kiyintirish holati.
 *
 * `pending`/`processing` — hali tayyorlanmoqda, ilova so'rab turishi kerak.
 * `ready` — `imageUrl` bor. `failed` — `error` da sabab.
 */
export type RenderStatus = 'pending' | 'processing' | 'ready' | 'failed';

export interface TryonRender {
  id: string;
  variantId: string;
  /** Qaysi burchak uchun — har biri alohida natija va alohida to'lov */
  angle: AvatarAngle;
  status: RenderStatus;
  imageUrl: string | null;
  /** Fondan ajratilgan variant — qorong'i sahnaga qo'yish uchun */
  cutoutUrl: string | null;
  error: string | null;
}

/**
 * To'liq bo'yli suratni yuklaydi va profilga bog'laydi.
 *
 * ⚠️ `purpose: 'body'` — bu surat `private` kesh bilan saqlanadi. Oddiy
 * profil rasmidan farqi shu: gavda surati ochiq bo'lmasligi kerak.
 */
export async function uploadBodyPhoto(localUri: string): Promise<string> {
  const fileName = localUri.split('/').pop() ?? 'body.jpg';
  const contentType = fileName.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';

  const signed = await api<PresignResult>('/profile/uploads/presign', {
    method: 'POST',
    body: { fileName, contentType, purpose: 'body' },
  });

  const blob = await (await fetch(localUri)).blob();
  const response = await fetch(signed.uploadUrl, {
    method: 'PUT',
    headers: signed.headers,
    body: blob,
  });
  if (!response.ok) throw new Error('Surat yuklanmadi');

  await api<{ bodyPhotoUrl: string }>('/tryon/body-photo', {
    method: 'PUT',
    body: { url: signed.publicUrl },
  });

  return signed.publicUrl;
}

/**
 * AI yasagan to'liq bo'yli avatar.
 *
 * ⚠️ BU KIYINTIRISHNING ASOSI. Yuz skaneri va o'lchovlardan yasaladi va
 * barcha kiyimlar shu suratga kiydiriladi. Tayyor bo'lmasa kiyintirish
 * ishlamaydi.
 */
/** Aylantirish burchaklari — har biri alohida yasaladi va alohida to'lanadi. */
export type AvatarAngle = 'front' | 'side' | 'back';

export const ANGLE_ORDER: AvatarAngle[] = ['front', 'side', 'back'];

export const ANGLE_LABEL: Record<AvatarAngle, string> = {
  front: 'Old',
  side: 'Yon',
  back: 'Orqa',
};

export interface UserAvatar {
  status: 'none' | 'processing' | 'ready' | 'failed';
  imageUrl: string | null;
  /** Fondan ajratilgan variant — qorong'i sahnaga qo'yish uchun. `null` bo'lishi mumkin. */
  cutoutUrl: string | null;
  error: string | null;
  /** Yasalgan burchaklar: `{ front: url, side: url }` */
  angles: Partial<Record<AvatarAngle, string>>;
  /** Hozir yasalayotgan burchak — ilova kutish holatini ko'rsatadi */
  anglePending: AvatarAngle | null;
}

/** Avatarni yasashni boshlaydi. Tayyori bo'lsa qayta yasalmaydi. */
export const requestAvatar = (): Promise<UserAvatar> =>
  api<UserAvatar>('/tryon/avatar', { method: 'POST' });

/** Holat — ilova tayyor bo'lguncha takrorlaydi. */
export const getAvatar = (): Promise<UserAvatar> => api<UserAvatar>('/tryon/avatar');

/**
 * Aylantirish uchun burchak so'raydi.
 *
 * ⚠️ HAR BURCHAK PUL TURADI, shuning uchun u faqat foydalanuvchi
 * "aylantirish" bosganda chaqiriladi. Yasalgani saqlanadi — keyingi
 * safar bepul.
 */
export const requestAvatarAngle = (angle: AvatarAngle): Promise<UserAvatar> =>
  api<UserAvatar>('/tryon/avatar/angle', { method: 'POST', body: { angle } });

export interface Garment {
  variantId: string;
  productId: string;
  title: string;
  slot: string;
  price: string;
  currency: string;
  image: string;
  /** Variant rangi — tanlagichda nuqta bo'lib ko'rsatiladi */
  colorHex: string | null;
  /** Faqat OMBORDA BOR o'lchamlar (band qilinganlar chegirilgan) */
  sizes: string[];
  store: { id: string; name: string };
}

/**
 * AI kiyintirish uchun kiyimlar.
 *
 * ⚠️ `getProducts` YARAMAYDI: unda `variantId` yo'q, kiyintirish esa aynan
 * variantga bog'lanadi (rang muhim). `/tryon/slot/:slot` ham yaramaydi —
 * u 3D modeli borlarini qaytaradi, AI'ga esa oddiy surat kerak.
 */
export const getGarments = (slot?: string, gender?: string): Promise<Garment[]> => {
  const params = new URLSearchParams({ limit: '30' });
  if (slot) params.set('slot', slot);
  if (gender) params.set('gender', gender);
  return api<Garment[]>(`/tryon/garments?${params.toString()}`);
};

/** Bitta kiyimni kiyintirishni so'raydi. Kesh bo'lsa darhol `ready` qaytadi. */
export const requestRender = (variantId: string, angle: AvatarAngle = 'front') =>
  api<TryonRender>('/tryon/render', { method: 'POST', body: { variantId, angle } });

/** Holatni so'raydi — ilova buni tayyor bo'lguncha takrorlaydi. */
export const getRender = (id: string): Promise<TryonRender> =>
  api<TryonRender>(`/tryon/render/${id}`);

/**
 * Gallereya uchun bir nechta variantning holati.
 *
 * Svayp paytida har rasm uchun alohida so'rov yuborilsa tarmoq bo'g'iladi —
 * ro'yxat oldindan olinadi va faqat tayyor bo'lmaganlari kuzatiladi.
 */
export const getRenders = (
  variantIds: string[],
  angle: AvatarAngle = 'front',
): Promise<TryonRender[]> =>
  variantIds.length === 0
    ? Promise.resolve([])
    : api<TryonRender[]>(`/tryon/renders?angle=${angle}&variantIds=${variantIds.join(',')}`);

/**
 * AI kiyintirish qaysi slotlarda ishlaydi.
 *
 * ⚠️ MODEL FAQAT KIYIM UCHUN O'QITILGAN. Oyoq kiyim, soat, sumka va bosh
 * kiyimda natija ishonchsiz chiqadi — ularni AI'ga yubormaymiz va oddiy
 * mahsulot suratini ko'rsatamiz. Pul ham, foydalanuvchining ishonchi ham
 * behuda ketmaydi.
 */
export const AI_TRYON_SLOTS = ['top', 'outer', 'bottom'] as const;

export function supportsAiTryon(slot: string): boolean {
  return (AI_TRYON_SLOTS as readonly string[]).includes(slot);
}

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

// ============================================================
// Sotuvchi paneli
// ============================================================

/**
 * ⚠️ ILOVADA FAQAT OPERATIV QISM.
 *
 * Backend to'liq panelni qo'llab-quvvatlaydi (katalog, analitika, jamoa,
 * hisob-fakturalar), lekin ilovaga faqat SHOSHILINCH ishlar olingan:
 * ariza yuborish va buyurtmalarga javob berish.
 *
 * Sabab: buyurtma kelganda sotuvchi darhol javob berishi kerak va telefon
 * doim yonida. Mahsulot qo'shish, narx tahrirlash va analitika esa
 * klaviatura hamda katta ekran talab qiladi — ular veb-panelda qoladi
 * (`STORE_PANEL_URL`). Ikkalasini ham telefonga tiqish har ikkalasini
 * noqulay qilardi.
 */

export interface StoreApplication {
  id: string;
  name: string;
  slug: string;
  status: 'pending' | 'active' | 'rejected' | 'suspended';
  rejectReason?: string | null;
}

export interface StoreApplicationInput {
  name: string;
  description?: string;
  phone: string;
  address: string;
  landmark?: string;
  city: string;
  country: 'UZ' | 'AE';
  location: { lat: number; lng: number };
  currency: 'UZS' | 'AED' | 'USD';
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
}

export const applyForStore = (input: StoreApplicationInput): Promise<StoreApplication> =>
  api<StoreApplication>('/stores/apply', { method: 'POST', body: input });

export interface StoreOrderItem {
  title: string;
  size: string | null;
  qty: number;
  unitPrice: string;
}

export interface StoreOrder {
  id: string;
  orderNumber: string;
  status: 'new' | 'seen' | 'confirmed' | 'ready' | 'completed' | 'rejected' | 'expired';
  createdAt: string;
  /** `new` holatida qancha daqiqa qolgani; boshqa holatda `null` */
  minutesLeft: number | null;
  customer: { name: string; phone: string };
  deliveryType: string;
  address: string | null;
  note: string | null;
  items: StoreOrderItem[];
  subtotal: string;
  total: string;
  currency: string;
}

export type StoreOrderFilter = 'new' | 'active' | 'completed' | 'cancelled' | 'all';

export const getStoreOrders = (status: StoreOrderFilter = 'new') =>
  apiList<StoreOrder>(`/store/orders?status=${status}&limit=30`);

export interface StoreDashboard {
  newOrders: number;
  inProgress: number;
  completedMonth: number;
  revenueMonth: string;
  currency: string;
  productCount: number;
}

export const getStoreDashboard = (): Promise<StoreDashboard> =>
  api<StoreDashboard>('/store/dashboard');

/** Rad etish sabablari — server aynan shu qiymatlarni qabul qiladi. */
export const REJECT_REASONS = [
  'out_of_stock',
  'size_unavailable',
  'price_changed',
  'fake_order',
  'other',
] as const;

export type RejectReason = (typeof REJECT_REASONS)[number];

/**
 * Buyurtma holatini o'zgartiradi.
 *
 * ⚠️ `seen` ALOHIDA: u sotuvchi buyurtmani ochganini bildiradi va mijozga
 * "ko'rildi" bo'lib chiqadi. Uni tugma bosilganda emas, ekran ochilganda
 * yuborish kerak — mijoz javob kutayotganini bilishi muhim.
 */
export const storeOrderAction = (
  id: string,
  action: 'seen' | 'confirm' | 'ready' | 'complete' | 'reject',
  body?: Record<string, unknown>,
): Promise<unknown> =>
  api(`/store/orders/${id}/${action}`, { method: 'POST', ...(body ? { body } : {}) });

// ── Do'kon: mahsulotlar va sozlamalar ──

/**
 * Ro'yxatdagi mahsulot.
 *
 * ⚠️ BU BATAFSIL JAVOBDAN FARQ QILADI. Ro'yxat yengil bo'lishi uchun
 * server faqat bitta rasm (`image`) va UMUMIY qoldiq (`stock`) beradi —
 * variantlar va o'lchamlar ro'yxati yo'q. Ularni tahrirlash uchun
 * `getMyProduct` chaqiriladi.
 *
 * Buni sinovda topdim: tipni `basePrice`/`images`/`variants` deb yozgan
 * edim va ilova `product.images[0]` da qulagan.
 */
export interface StoreProduct {
  id: string;
  title: string;
  status: 'draft' | 'pending' | 'active' | 'rejected' | 'archived';
  price: string;
  oldPrice: string | null;
  currency: string;
  image: string | null;
  category: { slug: string; name: string } | null;
  stock: { total: number; reserved: number; available: number };
  has3d: boolean;
}

/** Batafsil — variantlar va o'lchamlar shu yerda. */
export interface StoreProductDetail {
  id: string;
  title: string;
  description: string | null;
  status: string;
  price: string;
  currency: string;
  images: string[];
  variants: Array<{
    id: string;
    colorName: string;
    sizes: Array<{ size: string; stock: number; reserved: number }>;
  }>;
}

export const getMyProduct = (id: string): Promise<StoreProductDetail> =>
  api<StoreProductDetail>(`/store/products/${id}`);

export type ProductStatusFilter = 'all' | 'draft' | 'pending' | 'active' | 'rejected' | 'archived';

export const getMyProducts = (status: ProductStatusFilter = 'all') =>
  apiList<StoreProduct>(`/store/products?status=${status}&limit=30`);

export interface CreateProductInput {
  title: string;
  description?: string;
  categoryId: string;
  gender: 'male' | 'female' | 'unisex';
  basePrice: string;
  images: string[];
  /**
   * `draft` — qoralama, katalogda ko'rinmaydi va rasm soni tekshirilmaydi.
   * `pending` — moderatsiyaga yuboriladi, kamida 3 rasm SHART.
   */
  status: 'draft' | 'pending';
  variants: Array<{ sizes: Array<{ size: string; stock: number }> }>;
}

export const createStoreProduct = (input: CreateProductInput): Promise<{ id: string }> =>
  api<{ id: string }>('/store/products', { method: 'POST', body: input });

export const deleteStoreProduct = (id: string): Promise<void> =>
  api<void>(`/store/products/${id}`, { method: 'DELETE' });

/** Ombor qoldig'i — variant bo'yicha, o'lchamlar ro'yxati bilan. */
export const updateVariantStock = (
  variantId: string,
  sizes: Array<{ size: string; stock: number }>,
): Promise<unknown> =>
  api(`/store/variants/${variantId}/stock`, { method: 'PATCH', body: { sizes } });

export interface StoreProfile {
  id: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  address: string;
  landmark: string | null;
  city: string;
  phone: string;
  status: string;
  currency: string;
  deliveryEnabled?: boolean;
  pickupEnabled?: boolean;
}

export const getStoreProfile = (): Promise<StoreProfile> => api<StoreProfile>('/store/profile');

export const updateStoreProfile = (input: Partial<StoreProfile>): Promise<StoreProfile> =>
  api<StoreProfile>('/store/profile', { method: 'PATCH', body: input });

/**
 * Do'kon rasmini R2 ga yuklaydi.
 *
 * ⚠️ `purpose: 'product'` — kesh `immutable`, ya'ni rasm bir yil saqlanadi.
 * Do'kon rasmi almashtirilganda yangi UUID beriladi, shuning uchun eski
 * havola keshda qolsa ham zarari yo'q.
 */
export interface PreparedGarment {
  originalUrl: string;
  cleanedUrl: string;
  /** Kiyim kadrning necha qismini egallaydi (0–1) */
  coverage: number;
  warning: string | null;
}

/**
 * Yuklangan kiyim suratini kiyintirish uchun tayyorlaydi.
 *
 * Server fonni olib tashlaydi va oq fonli variant qaytaradi. Do'konchi
 * ikkalasini ko'rib o'zi tanlaydi — avtomatik almashtirmaymiz, chunki
 * ba'zan asl surat yaxshiroq bo'ladi.
 */
export const prepareGarmentImage = (url: string): Promise<PreparedGarment> =>
  api<PreparedGarment>('/store/uploads/prepare', { method: 'POST', body: { url } });

export async function uploadStoreImage(localUri: string): Promise<string> {
  const fileName = localUri.split('/').pop() ?? 'photo.jpg';
  const contentType = fileName.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';

  const signed = await api<PresignResult>('/store/uploads/presign', {
    method: 'POST',
    body: { fileName, contentType, purpose: 'product' },
  });

  const blob = await (await fetch(localUri)).blob();
  const response = await fetch(signed.uploadUrl, {
    method: 'PUT',
    headers: signed.headers,
    body: blob,
  });
  if (!response.ok) throw new Error('Rasm yuklanmadi');

  return signed.publicUrl;
}
