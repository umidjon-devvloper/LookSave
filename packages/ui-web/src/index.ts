/**
 * `@looksave/ui-web` — veb komponent kiti.
 *
 * Har bir komponent mobil ilovadagi o'z juftiga tenglashtirilgan
 * (`apps/mobile/src/components/ui.tsx`). Manba va sabablar har faylning
 * boshida yozilgan; qiymatlarni o'zgartirishdan oldin `docs/06-dizayn.md`
 * va `docs/13-sayt.md` §6 ga qarang.
 *
 * ⚠️ PAKET `apps/web` ICHIDA EMAS. Store-panel ham sekin-asta shunga
 * o'tadi va uchinchi ilova ochilganda takroriy chizish boshlanmaydi.
 *
 * ⚠️ Tailwind sinflari shu paket ichida yozilgani uchun uni ULAGAN har bir
 * ilova `tailwind.config.js` dagi `content` ga qo'shishi SHART:
 *
 *     content: ['./index.html', './src/**\/*.{ts,tsx}',
 *               '../../packages/ui-web/src/**\/*.{ts,tsx}'],
 *
 * Aks holda sinflar yaratilmaydi va komponentlar bezaksiz chiqadi.
 */

export { BrandLogo, hasBrandLogo } from './BrandLogos';
export { Button, type ButtonProps } from './Button';
export { Card, type CardProps } from './Card';
export { CartArt } from './CartArt';
export { QuantityStepper } from './QuantityStepper';
export { Chip, type ChipProps } from './Chip';
export { Field, type FieldProps } from './Field';
export { Icon, type IconName } from './Icon';
export { ImageFrame, type ImageFrameProps } from './ImageFrame';
export {
  ChestIcon,
  FitIcon,
  HeightIcon,
  HipsIcon,
  ShoeIcon,
  TapeIcon,
  WaistIcon,
  WeightIcon,
  type MeasureIconProps,
} from './MeasureIcons';
export { ProductCard, type ProductCardProps } from './ProductCard';
export { SectionHeader } from './SectionHeader';
export { SocialLogo, type SocialName } from './SocialLogos';
export { StatusBadge, statusTone } from './StatusBadge';
export { Timeline, type TimelineState, type TimelineStep } from './Timeline';
export { Empty, ErrorView, Loading } from './states';
export {
  Skeleton,
  SkeletonCard,
  SkeletonGrid,
  SkeletonList,
  SkeletonRow,
  SkeletonText,
} from './Skeleton';
export { Cap, Dress, Hanger, Jacket, Pants, Sneaker, type GlyphProps } from './GarmentIcons';
export { cn } from './cn';
