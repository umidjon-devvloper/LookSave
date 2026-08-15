import { api } from './client';

export interface Overview {
  stores: { active: number; pending: number };
  users: { total: number; newThisWeek: number };
  ordersThisWeek: number;
  moderation: { productsPending: number; assetsQueued: number; assetsProcessing: number };
  attention: { globalBlocks: number; restrictedUsers: number; silentStores: number };
}

export type StoreStatus = 'pending' | 'active' | 'suspended' | 'rejected' | 'all';

export interface AdminStore {
  id: string;
  name: string;
  status: string;
  city: string;
  country: string;
  address: string;
  phone: string;
  logoUrl: string | null;
  coverUrl: string | null;
  location: { lat: number; lng: number };
  createdAt: string;
  owner: { name: string | null; phone: string };
  rejectReason: string | null;
  productCount: number;
  orderCount: number;
  avgResponseMin: number | null;
  confirmRate: number | null;
}

export interface ModerationProduct {
  id: string;
  title: string;
  description: string | null;
  status: string;
  price: string;
  currency: string;
  images: string[];
  gender: string;
  createdAt: string;
  store: { id: string; name: string };
  categorySlug: string;
  brandName: string | null;
  variantCount: number;
  totalStock: number;
}

export interface QaResult {
  fpsHighEnd: number;
  fpsMidRange: number;
  fpsLowEnd: number;
  loadMs: number;
  ramMb: number;
  checklistPassed: boolean;
}

export interface AssetJob {
  id: string;
  variantId: string;
  status: string;
  glbUrl: string | null;
  thumbnailUrl: string | null;
  polyCount: number | null;
  fileSizeBytes: number | null;
  requestedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
  qaResult: QaResult | null;
  product: { id: string; title: string; slot: string };
  colorName: Record<string, string> | null;
  storeName: string;
  sourceImages: string[];
}

export interface GlobalBlock {
  id: string;
  phone: string;
  reason: string;
  createdAt: string;
  storeReasons: Array<{ store: string; reason: string }>;
}

export interface AdminUser {
  id: string;
  phone: string;
  fullName: string | null;
  role: string;
  country: string | null;
  createdAt: string;
  trust: {
    total: number;
    completed: number;
    cancelled: number;
    noshow: number;
    isRestricted: boolean;
    restrictedUntil: string | null;
    note: string | null;
  };
}

export const getOverview = (): Promise<Overview> => api<Overview>('/admin/overview');

export const getStores = (status: StoreStatus): Promise<AdminStore[]> =>
  api<AdminStore[]>(`/admin/stores?status=${status}&limit=50`);

export const approveStore = (id: string): Promise<unknown> =>
  api(`/admin/stores/${id}/approve`, { method: 'POST', body: {} });

export const rejectStore = (id: string, reason: string): Promise<unknown> =>
  api(`/admin/stores/${id}/reject`, { method: 'POST', body: { reason } });

export const suspendStore = (id: string, reason: string): Promise<unknown> =>
  api(`/admin/stores/${id}/suspend`, { method: 'POST', body: { reason } });

export const getModerationProducts = (
  status: 'pending' | 'rejected' | 'active',
): Promise<ModerationProduct[]> =>
  api<ModerationProduct[]>(`/admin/products/moderation?status=${status}&limit=50`);

export const approveProduct = (id: string): Promise<unknown> =>
  api(`/admin/products/${id}/approve`, { method: 'POST', body: {} });

export const rejectProduct = (id: string, reason: string): Promise<unknown> =>
  api(`/admin/products/${id}/reject`, { method: 'POST', body: { reason } });

export const getAssetQueue = (
  status: 'queued' | 'processing' | 'ready' | 'failed' | 'all',
): Promise<AssetJob[]> => api<AssetJob[]>(`/admin/3d-queue?status=${status}&limit=50`);

export interface AssetPublishBody {
  status: 'queued' | 'processing' | 'ready' | 'failed';
  glbUrl?: string;
  lodUrls?: Record<string, string>;
  thumbnailUrl?: string;
  fileSizeBytes?: number;
  polyCount?: number;
  textureSize?: 512 | 1024 | 2048;
  hideBodyParts: string[];
  hasMorphs: boolean;
  qaResult?: QaResult;
  errorMessage?: string;
}

export const updateAsset = (id: string, body: AssetPublishBody): Promise<unknown> =>
  api(`/admin/3d-queue/${id}`, { method: 'PATCH', body });

export const getGlobalBlocks = (): Promise<GlobalBlock[]> => api<GlobalBlock[]>('/admin/blocklist');

export const removeBlock = (id: string): Promise<void> =>
  api<void>(`/admin/blocklist/${id}`, { method: 'DELETE' });

export const getUsers = (restricted: boolean, q?: string): Promise<AdminUser[]> => {
  const params = new URLSearchParams({ restricted: String(restricted), limit: '50' });
  if (q && q.length >= 2) params.set('q', q);
  return api<AdminUser[]>(`/admin/users?${params.toString()}`);
};

export const unrestrictUser = (id: string): Promise<void> =>
  api<void>(`/admin/users/${id}/unrestrict`, { method: 'POST', body: {} });

export type AdminOrderStatus =
  | 'new'
  | 'seen'
  | 'confirmed'
  | 'ready'
  | 'completed'
  | 'rejected'
  | 'cancelled'
  | 'expired'
  | 'all';

export interface AdminOrder {
  id: string;
  orderNumber: string;
  status: string;
  createdAt: string;
  deliveryType: string;
  total: string;
  currency: string;
  itemCount: number;
  customer: { id: string; name: string; phone: string };
  store: { id: string; name: string };
  reason: string | null;
}

export interface OrderEvent {
  fromStatus: string | null;
  toStatus: string;
  actorType: string;
  channel: string | null;
  comment: string | null;
  createdAt: string;
}

export const getOrders = (status: AdminOrderStatus, q?: string): Promise<AdminOrder[]> => {
  const params = new URLSearchParams({ status, limit: '50' });
  if (q && q.length >= 3) params.set('q', q);
  return api<AdminOrder[]>(`/admin/orders?${params.toString()}`);
};

export const getOrderEvents = (id: string): Promise<OrderEvent[]> =>
  api<OrderEvent[]>(`/admin/orders/${id}/events`);

// ── Brendlar ──

export interface Brand {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  description: string | null;
  isPartner: boolean;
  sortOrder: number;
  /** Bog'langan mahsulotlar soni — o'chirish mumkinligini shundan bilamiz */
  productCount: number;
}

export interface BrandInput {
  name: string;
  slug?: string;
  logoUrl?: string | null;
  description?: string | null;
  isPartner: boolean;
  sortOrder: number;
}

export const getBrands = (): Promise<Brand[]> => api<Brand[]>('/admin/brands');

export const createBrand = (input: BrandInput): Promise<Brand> =>
  api<Brand>('/admin/brands', { method: 'POST', body: input });

export const updateBrand = (id: string, input: Partial<BrandInput>): Promise<Brand> =>
  api<Brand>(`/admin/brands/${id}`, { method: 'PATCH', body: input });

export const deleteBrand = (id: string): Promise<void> =>
  api<void>(`/admin/brands/${id}`, { method: 'DELETE' });
