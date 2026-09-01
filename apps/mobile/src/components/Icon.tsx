import {
  BadgeCheck,
  Camera,
  Clock,
  Bell,
  ChevronLeft,
  ChevronRight,
  Globe,
  Heart,
  House,
  Layers,
  MessageSquareText,
  LayoutGrid,
  LayoutList,
  LocateFixed,
  Store,
  LogOut,
  MapPin,
  Navigation,
  Package,
  RefreshCcw,
  RotateCw,
  Search,
  Settings,
  Share2,
  Shirt,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  SlidersHorizontal,
  Sparkle,
  Sparkles,
  Trash2,
  Truck,
  User,
  X,
  Zap,
  ZoomIn,
  type LucideIcon,
} from 'lucide-react-native';

import { colors } from '../theme/tokens';
import { Cap, Dress, Jacket, Pants, Sneaker } from './GarmentIcons';

/**
 * Ilovaning yagona ikonka manbai — 06-dizayn.md §11.
 *
 * NEGA MARKAZLASHTIRILGAN: ekranlar ikonkani to'g'ridan-to'g'ri import qilsa,
 * to'plamni almashtirish uchun o'nlab faylni tahrirlash kerak bo'lardi.
 * Bu yerda faqat quyidagi jadval o'zgaradi.
 *
 * `strokeWidth: 1.75` — Lucide standarti 2 dan nozikroq, deckdagi yupqa
 * chiziqli tuyg'uga yaqin (06-dizayn.md §11).
 */
const STROKE = 1.75;

const LUCIDE = {
  // ── Navigatsiya ──
  home: House,
  stores: MapPin,
  tryon: Sparkles,
  cart: ShoppingBag,
  bag: ShoppingCart,
  profile: User,
  /** Logotipdagi to'rt uchli yulduz (deck 01-slayd) */
  logo: Sparkle,
  bell: Bell,

  // ── Amallar ──
  search: Search,
  close: X,
  back: ChevronLeft,
  next: ChevronRight,
  favorite: Heart,
  favoriteOn: Heart, // to'ldirilgani `fill` orqali beriladi
  filter: SlidersHorizontal,
  share: Share2,
  camera: Camera,

  // ── Try-On boshqaruvi (deck 02, 05-slayd) ──
  rotate: RotateCw,
  zoom: ZoomIn,
  reset: RefreshCcw,

  // ── Profil / buyurtma ──
  orders: Package,
  looks: Layers,
  /** Katalogdagi ko'rinish almashtirgichi — grid va bitta ustun */
  /** Do'kon kartasi — `stores` (MapPin) joy belgisi, bu esa do'konning o'zi */
  shop: Store,
  /** Do'kon bilan bog'lanish */
  chat: MessageSquareText,
  grid: LayoutGrid,
  list: LayoutList,
  settings: Settings,
  language: Globe,
  logout: LogOut,
  trash: Trash2,
  location: Navigation,
  /** «Joylashuvimni ishlatish» — nishon, `location` esa yo'nalish o'qi */
  locate: LocateFixed,
  /** Ish vaqti: «Ochiq · 21:00 gacha» */
  clock: Clock,
  limited: Zap,

  // ── Ishonch belgilari (deck 01-slayd) ──
  authentic: ShieldCheck,
  delivery: Truck,
  premium: BadgeCheck,
} satisfies Record<string, LucideIcon>;

/**
 * Kiyim turlari — `GarmentIcons.tsx` da qo'lda chizilgan, chunki Lucide'da
 * shim, kurtka va kepka glifi yo'q. Faqat futbolka Lucide'niki (`Shirt`).
 */
const GARMENTS = {
  slotTop: Shirt,
  slotBottom: Pants,
  slotFeet: Sneaker,
  slotOuter: Jacket,
  slotHead: Cap,
  /** Marketplace: ayollar kolleksiyasi */
  dress: Dress,
} as const;

export type IconName = keyof typeof LUCIDE | keyof typeof GARMENTS;

export function Icon({
  name,
  size = 20,
  color = colors.textMuted,
}: {
  name: IconName;
  size?: number;
  color?: string;
}): JSX.Element {
  if (name in GARMENTS) {
    const Garment = GARMENTS[name as keyof typeof GARMENTS];
    return <Garment size={size} color={color} strokeWidth={STROKE} />;
  }

  const Glyph = LUCIDE[name as keyof typeof LUCIDE];
  return (
    <Glyph
      size={size}
      color={color}
      strokeWidth={STROKE}
      fill={name === 'favoriteOn' ? color : 'transparent'}
    />
  );
}
