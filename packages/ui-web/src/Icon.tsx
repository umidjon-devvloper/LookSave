import {
  BadgeCheck,
  Camera,
  Clock,
  Bell,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  LogIn,
  Tag,
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
} from 'lucide-react';

import { Cap, Dress, Hanger, Jacket, Pants, Sneaker } from './GarmentIcons';
import { cn } from './cn';

/**
 * Saytning yagona ikonka manbai — `apps/mobile/src/components/Icon.tsx`
 * ning veb dubli. Nomlar ikkalasida AYNAN bir xil, ya'ni ilovadagi ekranni
 * saytga ko'chirganda `<Icon name="cart" />` o'zgarmaydi.
 *
 * NEGA MARKAZLASHTIRILGAN: ekranlar ikonkani to'g'ridan-to'g'ri import
 * qilsa, to'plamni almashtirish uchun o'nlab faylni tahrirlash kerak
 * bo'lardi. Bu yerda faqat quyidagi jadval o'zgaradi.
 *
 * `strokeWidth: 1.75` — Lucide standarti 2 dan nozikroq, deckdagi yupqa
 * chiziqli tuyg'uga yaqin (06-dizayn.md §11).
 *
 * ⚠️ RANG `currentColor` DAN KELADI, `color` proplaridan emas. Mobil
 * variantda rang prop bilan beriladi (RN'da meros yo'q), web'da esa
 * `text-primary` kabi sinf ota-elementga qo'yilsa yetarli — shu sababli
 * bu yerda `color` propi ataylab yo'q.
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
  /* Diagonal o'q — «boshqa sahifaga o'tadi» ma'nosi (ChevronRight «keyingisi» degani) */
  openOut: ArrowUpRight,
  /* Logotipi yo'q brend uchun neytral belgi — taqlid emas, yorliq */
  tag: Tag,
  /* Kirish o'qi — `next` «keyingisi» degani, bu esa «ichkariga» */
  signIn: LogIn,
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
  /** Do'kon kartasi — `stores` (MapPin) joy belgisi, bu esa do'konning o'zi */
  shop: Store,
  /** Do'kon bilan bog'lanish */
  chat: MessageSquareText,
  /** Katalogdagi ko'rinish almashtirgichi — to'r va bitta ustun */
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

/** Kiyim turlari — `GarmentIcons.tsx` da qo'lda chizilgan. */
const GARMENTS = {
  /* Ilgak — «kiyib ko'rish» ma'nosi `Sparkles` dan aniqroq */
  hanger: Hanger,
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
  className,
}: {
  name: IconName;
  size?: number;
  className?: string;
}): JSX.Element {
  if (name in GARMENTS) {
    const Garment = GARMENTS[name as keyof typeof GARMENTS];
    return <Garment size={size} strokeWidth={STROKE} className={cn('shrink-0', className)} />;
  }

  const Glyph = LUCIDE[name as keyof typeof LUCIDE];
  return (
    <Glyph
      size={size}
      strokeWidth={STROKE}
      className={cn('shrink-0', className)}
      fill={name === 'favoriteOn' ? 'currentColor' : 'transparent'}
      aria-hidden="true"
    />
  );
}
