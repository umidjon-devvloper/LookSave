import { api, apiList, query, type ApiOptions, type Page } from './client';

/**
 * Endpointlar — `docs/03-api-spec.md` bo'yicha, mobil ilovadagi
 * `src/api/endpoints.ts` bilan bir xil shakllar.
 *
 * ⚠️ Tiplar bu yerda QAYTA e'lon qilingan, mobil ilovadan import
 * qilinmagan: `apps/*` bir-birini import qilmaydi (har biri o'z bundleri).
 * Umumiy tiplar `@looksave/shared-types` da, lekin u API kontraktining
 * faqat konvert qismini qamraydi. To'liq birlashtirish — alohida ish.
 */

// ── Katalog ──────────────────────────────────────────────────────────

export interface ProductCard {
  id: string;
  title: string;
  brand: { id: string; name: string } | null;
  store: { id: string; name: string; distanceM: number | null };
  price: string;
  oldPrice: string | null;
  currency: string;
  image: string | null;
  canTryOn: boolean;
  isLimited: boolean;
  availableSizes: string[];
}

export type ProductSort = 'nearest' | 'popular' | 'newest' | 'priceAsc' | 'priceDesc';

export const SORTS: ProductSort[] = ['popular', 'newest', 'priceAsc', 'priceDesc', 'nearest'];

export interface ProductFilters {
  category?: string;
  gender?: string;
  brand?: string;
  q?: string;
  onlyTryon?: boolean;
  priceMin?: number;
  priceMax?: number;
  limited?: boolean;
  sort?: ProductSort;
  lat?: number;
  lng?: number;
  cursor?: string;
  limit?: number;
}

export function getProducts(
  filters: ProductFilters = {},
  options: ApiOptions = {},
): Promise<Page<ProductCard>> {
  return apiList<ProductCard>(`/products${query({ limit: 24, ...filters })}`, options);
}

/**
 * ⚠️ Maydon nomlari serverdan olingan: `colorName` (`color` EMAS),
 * `priceDelta` — variantga qarab narx o'zgaradi, `available` esa
 * `stock` dan alohida (do'kon o'zi o'chirib qo'yishi mumkin).
 */
export interface ProductVariant {
  id: string;
  colorName: string | null;
  colorHex: string | null;
  priceDelta: string;
  images: string[];
  sizes: Array<{ size: string; available: boolean; stock: number }>;
  asset3d: { status: string; glbUrl: string | null } | null;
}

export interface ProductDetail {
  id: string;
  title: string;
  description: string | null;
  category: { id: string; slug: string; name: string } | null;
  slot: string | null;
  gender: string | null;
  brand: { id: string; name: string; logoUrl: string | null } | null;
  store: {
    id: string;
    name: string;
    logoUrl: string | null;
    distanceM: number | null;
    isOpen: boolean;
    avgResponseMin: number | null;
  };
  price: string;
  oldPrice: string | null;
  currency: string;
  images: string[];
  variants: ProductVariant[];
  canTryOn: boolean;
  isLimited: boolean;
  isFavorite: boolean;
  tags: string[];
  /**
   * ⚠️ FAQAT TUR VA TIZIM (`{ type: 'clothing', system: 'INT' }`).
   * Haqiqiy o'lcham jadvali (ko'krak/bel santimetrlari) API'da YO'Q,
   * shuning uchun «sizga M to'g'ri keladi» degan maslahatni chiqarib
   * bo'lmaydi — u taxmin bo'lardi (15-sayt-dizayn.md §4.3).
   */
  sizeChart: { type: string; system: string } | null;
}

export const getProduct = (id: string, options: ApiOptions = {}): Promise<ProductDetail> =>
  api<ProductDetail>(`/products/${id}`, options);

export interface Category {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  slot: string | null;
  sizeType: string | null;
  children: Category[];
}

export const getCategories = (options: ApiOptions = {}): Promise<Category[]> =>
  api<Category[]>('/categories', options);

export interface Brand {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  isPartner: boolean;
}

export const getBrands = (options: ApiOptions = {}): Promise<Brand[]> =>
  api<Brand[]>('/brands', options);

// ── Do'konlar ────────────────────────────────────────────────────────

export interface StoreCard {
  id: string;
  name: string;
  logoUrl: string | null;
  /** Muqova (16:9) — kartaning rasmi. Logo kvadrat, u bu yerda cho'zilib ketadi. */
  coverUrl: string | null;
  address: string | null;
  distanceM: number | null;
  rating: number;
  isOpen: boolean;
  closesAt: string | null;
  opensAt: string | null;
  productCount: number;
  product3dCount: number;
  currency: string;
  location: { lat: number; lng: number } | null;
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
}

/**
 * ⚠️ `lat`/`lng` MAJBURIY — serversiz taxmin qilib bo'lmaydi.
 * Ularsiz endpoint 422 qaytaradi («Expected number, received nan»).
 *
 * Serverda brauzer joylashuvi yo'q, shuning uchun birinchi chizishda
 * bozor markazi ishlatiladi (`DEFAULT_CENTER`), keyin sahifa
 * foydalanuvchidan ruxsat so'rab aniqlashtiradi.
 */
export function getNearbyStores(
  params: { lat: number; lng: number; radius?: number; limit?: number },
  options: ApiOptions = {},
): Promise<Page<StoreCard>> {
  /*
   * ⚠️ Parametr `radius`, `radiusM` EMAS (`packages/validation/src/catalog.ts`).
   * Noto'g'ri nom jimgina e'tiborsiz qoldiriladi va standart 5 km ishlaydi —
   * ya'ni xato ko'rinmaydi, faqat ro'yxat qisqa chiqadi.
   *
   * Standart 5 km shahar uchun kichkina: 15 km butun Toshkentni qamraydi.
   * Sxemadagi yuqori chegara — 50 km.
   */
  return apiList<StoreCard>(
    `/stores/nearby${query({ limit: 20, radius: 15_000, ...params })}`,
    options,
  );
}

/**
 * Bozor markazlari — joylashuv berilmaganda boshlang'ich nuqta.
 * Toshkent birinchi: seed ma'lumot va birinchi do'konlar o'sha yerda.
 */
export const DEFAULT_CENTER = { lat: 41.2995, lng: 69.2401 } as const;

export interface StoreDetail extends Omit<StoreCard, 'distanceM'> {
  description?: string | null;
  phone?: string | null;
  distanceM?: number | null;
  hours?: Array<{ day: number; open: string | null; close: string | null }> | null;
}

export const getStore = (id: string, options: ApiOptions = {}): Promise<StoreDetail> =>
  api<StoreDetail>(`/stores/${id}`, options);

/**
 * ⚠️ Parametr `storeId`, `store` EMAS (`packages/validation/src/catalog.ts`,
 * `productsQuerySchema`). Noto'g'ri nom jimgina e'tiborsiz qoldiriladi va
 * BUTUN katalog qaytadi — ya'ni «shu do'kondan yana» bo'limida boshqa
 * do'konlarning mahsulotlari chiqib ketardi.
 */
export const getStoreProducts = (
  storeId: string,
  options: ApiOptions = {},
): Promise<Page<ProductCard>> =>
  apiList<ProductCard>(`/products${query({ storeId, limit: 24 })}`, options);

// ── Savat ────────────────────────────────────────────────────────────

/**
 * ⚠️ Maydon nomlari SERVERDAN olingan, taxmin qilinmagan
 * (`GET /v1/cart` javobi bilan solishtirilgan):
 *
 *   `stores`     — `groups` emas
 *   `colorName`  — `color` emas
 *   `unitPrice` / `totalPrice` — `price` emas
 *   valyuta ITEMDA yo'q, u do'kon darajasida
 *
 * Bu tiplar noto'g'ri bo'lsa sahifa 500 beradi va sabab
 * «Cannot read properties of undefined» bo'lib ko'rinadi — ya'ni
 * hech narsa aytmaydi. Shuning uchun har biri tekshirilgan.
 */
export interface CartItem {
  id: string;
  variantId: string;
  productId: string;
  title: string;
  colorName: string | null;
  image: string | null;
  size: string;
  qty: number;
  unitPrice: string;
  totalPrice: string;
  available: boolean;
  stock: number;
}

export interface CartGroup {
  store: { id: string; name: string; currency: string };
  items: CartItem[];
  subtotal: string;
  deliveryFee: string;
  total: string;
}

export interface Cart {
  stores: CartGroup[];
  itemCount: number;
}

export const getCart = (options: ApiOptions = {}): Promise<Cart> => api<Cart>('/cart', options);

export const addToCart = (
  input: { variantId: string; size: string; qty?: number },
  options: ApiOptions = {},
): Promise<Cart> =>
  api<Cart>('/cart/items', {
    ...options,
    method: 'POST',
    body: { variantId: input.variantId, size: input.size, qty: input.qty ?? 1 },
  });

export const setCartItemQty = (
  itemId: string,
  qty: number,
  options: ApiOptions = {},
): Promise<Cart> =>
  api<Cart>(`/cart/items/${itemId}`, { ...options, method: 'PATCH', body: { qty } });

export const removeCartItem = (itemId: string, options: ApiOptions = {}): Promise<Cart> =>
  api<Cart>(`/cart/items/${itemId}`, { ...options, method: 'DELETE' });

export const clearCart = (options: ApiOptions = {}): Promise<void> =>
  api<void>('/cart', { ...options, method: 'DELETE' });

// ── Buyurtma ─────────────────────────────────────────────────────────

/**
 * ⚠️ SERVER SAVATNI O'ZI O'QIMAYDI — `items` ochiq yuboriladi
 * (`packages/validation/src/orders.ts`, `createOrderSchema`).
 *
 * ⚠️ Manzilda `lat`/`lng` MAJBURIY: kuryer manzilni matn bo'yicha topa
 * olmaydi va yetkazish radiusi ham koordinatasiz tekshirilmaydi.
 *
 * ⚠️ Izoh maydoni `note`, `comment` EMAS.
 */
export interface CreateOrderInput {
  storeId: string;
  deliveryType: 'delivery' | 'pickup';
  contactName: string;
  contactPhone: string;
  note?: string;
  address?: { text: string; lat: number; lng: number; landmark?: string };
  items: Array<{ variantId: string; size: string; qty: number }>;
}

export const createOrder = (
  input: CreateOrderInput,
  idempotencyKey: string,
  options: ApiOptions = {},
): Promise<{ id: string; orderNumber: string }> =>
  api<{ id: string; orderNumber: string }>('/orders', {
    ...options,
    method: 'POST',
    body: input,
    idempotencyKey,
  });

/** ⚠️ `preview.count` YO'Q — mahsulotlar soni `itemCount` da, yuqori darajada. */
export interface OrderCard {
  id: string;
  orderNumber: string;
  status: string;
  statusLabel: string;
  createdAt: string;
  expiresAt: string | null;
  deliveryType: 'delivery' | 'pickup';
  total: string;
  currency: string;
  itemCount: number;
  canCancel: boolean;
  store: { id: string; name: string; logoUrl?: string | null };
  preview: { image: string | null; title: string | null };
}

export type OrderTab = 'active' | 'completed' | 'cancelled' | 'all';

export const getOrders = (
  status: OrderTab = 'active',
  options: ApiOptions = {},
): Promise<Page<OrderCard>> => apiList<OrderCard>(`/orders${query({ status })}`, options);

/**
 * ⚠️ Buyurtma elementi SAVAT elementiga TENG EMAS: unda `id` va
 * `variantId` yo'q (buyurtma bergandan keyin ular kerak emas), va
 * `brand` qo'shilgan. Shuning uchun alohida tip.
 */
export interface OrderItem {
  title: string;
  image: string | null;
  brand: string | null;
  colorName: string | null;
  size: string;
  qty: number;
  unitPrice: string;
  totalPrice: string;
}

export interface OrderDetail extends Omit<OrderCard, 'preview' | 'itemCount' | 'store'> {
  items: OrderItem[];
  store: { id: string; name: string; logoUrl: string | null; phone: string | null };
  address: { text: string; lat: number; lng: number } | null;
  contactName: string;
  contactPhone: string;
  /** ⚠️ `comment` EMAS — serverdagi nom `note` */
  note: string | null;
  cancelReason: string | null;
  rejectReason: string | null;
  paymentMethod: string | null;
  paymentStatus: string | null;
  subtotal: string;
  deliveryFee: string;
}

export const getOrder = (id: string, options: ApiOptions = {}): Promise<OrderDetail> =>
  api<OrderDetail>(`/orders/${id}`, options);

export const cancelOrder = (
  id: string,
  reason: string | undefined,
  options: ApiOptions = {},
): Promise<unknown> =>
  api<unknown>(`/orders/${id}/cancel`, { ...options, method: 'POST', body: { reason } });

// ── Auth va profil ───────────────────────────────────────────────────

/**
 * ⚠️ `fullName`, `name` EMAS — serverdagi nom shu
 * (`GET /v1/profile` va `POST /v1/auth/login` javoblari).
 */
export interface AuthUser {
  id: string;
  phone: string;
  fullName: string | null;
  role: string;
  gender: string | null;
  locale: string | null;
  country: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

export interface AuthResult {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
  isNewUser?: boolean;
}

export const login = (
  phone: string,
  password: string,
  options: ApiOptions = {},
): Promise<AuthResult> =>
  api<AuthResult>('/auth/login', { ...options, method: 'POST', body: { phone, password } });

/**
 * ⚠️ Maydon nomi `fullName`, `name` EMAS (`packages/validation/src/auth.ts`
 * dagi `registerSchema`). `name` yuborilsa server 422 qaytaradi va xato
 * «Ma'lumotlar to'liq emas» bo'lib ko'rinadi — sababi ko'rinmaydi.
 */
export const register = (
  input: { phone: string; password: string; fullName: string; locale?: string },
  options: ApiOptions = {},
): Promise<AuthResult> =>
  api<AuthResult>('/auth/register', { ...options, method: 'POST', body: input });

export const refreshSession = (
  refreshToken: string,
  options: ApiOptions = {},
): Promise<{ accessToken: string; refreshToken: string }> =>
  api<{ accessToken: string; refreshToken: string }>('/auth/refresh', {
    ...options,
    method: 'POST',
    body: { refreshToken },
  });

export const logout = (refreshToken: string, options: ApiOptions = {}): Promise<unknown> =>
  api<unknown>('/auth/logout', { ...options, method: 'POST', body: { refreshToken } });

export interface FullProfile extends AuthUser {
  measurements: Record<string, number | null>;
  morphTargets: Record<string, number>;
}

export const getProfile = (options: ApiOptions = {}): Promise<FullProfile> =>
  api<FullProfile>('/profile', options);

export const updateProfile = (
  input: { fullName?: string; gender?: string; locale?: string },
  options: ApiOptions = {},
): Promise<FullProfile> =>
  api<FullProfile>('/profile', { ...options, method: 'PATCH', body: input });

/**
 * ⚠️ `morphTargets` SERVERDA hisoblanadi (03-api-spec §6) — javobda
 * qaytadi, so'rovda yuborilmaydi. Model o'zgarsa saytni yangilash
 * shart emas.
 */
export const updateMeasurements = (
  input: Record<string, number>,
  options: ApiOptions = {},
): Promise<FullProfile> =>
  api<FullProfile>('/profile/measurements', { ...options, method: 'PATCH', body: input });
