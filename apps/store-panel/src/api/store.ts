import { api } from './client';

export interface DashboardData {
  newOrders: number;
  inProgress: number;
  completedMonth: number;
  revenueMonth: string;
  currency: string;
  avgResponseMin: number | null;
  confirmRate: number | null;
  productCount: number;
  tryonReadyCount: number;
  topProducts: Array<{ id: string; title: string; orders: number; tryons: number }>;
}

export interface StoreOrder {
  id: string;
  orderNumber: string;
  status: string;
  createdAt: string;
  expiresAt: string;
  minutesLeft: number | null;
  customer: { name: string; phone: string };
  deliveryType: 'delivery' | 'pickup';
  address: { text?: string; lat?: number; lng?: number; landmark?: string } | null;
  note: string | null;
  items: Array<{ title: string; size: string; qty: number; unitPrice: string }>;
  subtotal: string;
  deliveryFee: string;
  total: string;
  currency: string;
  paymentMethod: string;
  paymentStatus: string;
  customerTrust: { completedOrders: number; cancelledOrders: number };
}

export interface BlocklistEntry {
  id: string;
  phone: string;
  reason: string;
  createdBy: string;
  createdAt: string;
  isGlobal: boolean;
}

export interface TelegramLink {
  isLinked: boolean;
  linkCode: string | null;
  botUrl: string;
  linkedAt: string | null;
}

export type OrderTab = 'new' | 'active' | 'completed' | 'cancelled';

export const getDashboard = (): Promise<DashboardData> => api<DashboardData>('/store/dashboard');

export const getOrders = (status: OrderTab): Promise<StoreOrder[]> =>
  api<StoreOrder[]>(`/store/orders?status=${status}&limit=50`);

export const getBlocklist = (): Promise<BlocklistEntry[]> =>
  api<BlocklistEntry[]>('/store/blocklist');

export const addToBlocklist = (phone: string, reason: string): Promise<BlocklistEntry[]> =>
  api<BlocklistEntry[]>('/store/blocklist', { method: 'POST', body: { phone, reason } });

export const removeFromBlocklist = (id: string): Promise<void> =>
  api<void>(`/store/blocklist/${id}`, { method: 'DELETE' });

export const getTelegramLink = (): Promise<TelegramLink> =>
  api<TelegramLink>('/store/telegram/link');

export type RejectReason =
  'out_of_stock' | 'size_unavailable' | 'price_changed' | 'fake_order' | 'other';

export const markSeen = (id: string): Promise<unknown> =>
  api(`/store/orders/${id}/seen`, { method: 'POST', body: {} });

export const confirmOrder = (id: string): Promise<unknown> =>
  api(`/store/orders/${id}/confirm`, { method: 'POST', body: {} });

export const rejectOrder = (
  id: string,
  input: { reason: RejectReason; comment?: string; blockPhone: boolean },
): Promise<unknown> => api(`/store/orders/${id}/reject`, { method: 'POST', body: input });

export const markReady = (id: string): Promise<unknown> =>
  api(`/store/orders/${id}/ready`, { method: 'POST', body: {} });

export const completeOrder = (
  id: string,
  paymentMethod: 'cash' | 'card_offline' | 'transfer',
): Promise<unknown> =>
  api(`/store/orders/${id}/complete`, { method: 'POST', body: { paymentMethod } });

export const reportNoShow = (id: string, blockPhone: boolean): Promise<unknown> =>
  api(`/store/orders/${id}/report-noshow`, { method: 'POST', body: { blockPhone } });

export interface Analytics {
  period: number;
  totals: {
    views: number;
    tryons: number;
    orders: number;
    completed: number;
    revenue: string;
    conversion: number | null;
  };
  daily: Array<{ day: string; orders: number; completed: number }>;
  topProducts: Array<{
    id: string;
    title: string;
    views: number;
    tryons: number;
    orders: number;
    conversion: number | null;
  }>;
}

export interface Invoice {
  id: string;
  periodStart: string;
  periodEnd: string;
  ordersCount: number;
  grossAmount: string;
  commission: string;
  currency: string;
  status: string;
  isFree: boolean;
}

export const getAnalytics = (days: 7 | 30 | 90): Promise<Analytics> =>
  api<Analytics>(`/store/analytics?days=${days}`);

export const getInvoices = (): Promise<Invoice[]> => api<Invoice[]>('/store/invoices');

export type MemberRole = 'owner' | 'manager' | 'staff';

export interface Member {
  id: string;
  userId: string;
  role: MemberRole;
  fullName: string | null;
  phone: string;
  addedAt: string;
  lastActiveAt: string | null;
  isStoreOwner: boolean;
}

export const getMembers = (): Promise<Member[]> => api<Member[]>('/store/members');

export const addMember = (phone: string, role: MemberRole): Promise<Member[]> =>
  api<Member[]>('/store/members', { method: 'POST', body: { phone, role } });

export const updateMemberRole = (id: string, role: MemberRole): Promise<Member[]> =>
  api<Member[]>(`/store/members/${id}`, { method: 'PATCH', body: { role } });

export const removeMember = (id: string): Promise<void> =>
  api<void>(`/store/members/${id}`, { method: 'DELETE' });

export interface WorkingHour {
  day: number;
  open: string;
  close: string;
  closed: boolean;
}

export interface StoreProfile {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  address: string;
  landmark: string | null;
  city: string;
  country: string;
  phone: string;
  location: { lat: number; lng: number };
  workingHours: WorkingHour[];
  isOpen: boolean;
  closesAt: string | null;
  opensAt: string | null;
  delivery: { enabled: boolean; radiusM: number; fee: string; freeFrom: string | null };
  pickupEnabled: boolean;
  currency: string;
  status: string;
  rejectReason: string | null;
  rating: number;
  reviewCount: number;
}

export interface UpdateStoreBody {
  name?: string;
  logoUrl?: string | null;
  coverUrl?: string | null;
  description?: string | null;
  phone?: string;
  address?: string;
  landmark?: string | null;
  location?: { lat: number; lng: number };
  workingHours?: WorkingHour[];
  deliveryEnabled?: boolean;
  pickupEnabled?: boolean;
  deliveryRadiusM?: number;
  deliveryFee?: string;
  freeDeliveryFrom?: string | null;
}

export const getStoreProfile = (): Promise<StoreProfile> => api<StoreProfile>('/store/profile');

export const updateStoreProfile = (body: UpdateStoreBody): Promise<StoreProfile> =>
  api<StoreProfile>('/store/profile', { method: 'PATCH', body });

// ── Do'kon arizasi ──

export interface StoreApplication {
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

export type ApplicationStatus =
  | { exists: false }
  | {
      exists: true;
      id: string;
      name: string;
      slug: string;
      status: 'pending' | 'active' | 'suspended' | 'rejected';
      rejectReason: string | null;
      createdAt: string;
    };

export const getMyApplication = (): Promise<ApplicationStatus> =>
  api<ApplicationStatus>('/stores/my-application');

export const applyForStore = (
  input: StoreApplication,
): Promise<{ id: string; name: string; slug: string; status: string; createdAt: string }> =>
  api('/stores/apply', { method: 'POST', body: input });
