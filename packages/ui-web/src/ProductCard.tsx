import type { ReactNode } from 'react';

import { Icon } from './Icon';
import { ImageFrame } from './ImageFrame';
import { cn } from './cn';

/**
 * Mahsulot kartasi — ilovadagi anatomiyaning aynan o'zi
 * (`apps/mobile/app/(tabs)/index.tsx`, docs/15-sayt-dizayn.md §2):
 *
 *   rasm 3:4, burchak 16
 *   «3D» belgisi   — chapda tepada, `primarySoft` fon + `borderAccent` chegara
 *   yurakcha       — o'ngda tepada, `rgba(10,10,15,0.55)` doira
 *   nom            — `text-small`, bir qator
 *   narx           — qalin, eski narx yonida chizilgan
 *
 * ⚠️ HAVOLANI CHAQIRUVCHI BERADI (`link` propi). Kit `react-router` ga
 * bog'lanmaydi — aks holda uni store-panel ulaganda router talab qilinardi.
 */

export interface ProductCardProps {
  title: string;
  price: string;
  oldPrice?: string | null;
  image?: string | null;
  storeName?: string | null;
  /** API dagi nom — 3D yoki AI bilan kiyib ko'rish mumkinmi */
  canTryOn?: boolean;
  isLimited?: boolean;
  /** `<a>` yoki `<Link>` — karta shu bilan o'raladi */
  link: (children: ReactNode) => ReactNode;
  onToggleFavorite?: () => void;
  isFavorite?: boolean;
  onAddToCart?: (e: React.MouseEvent) => void;
  showAddToCart?: boolean;
  className?: string;
}

export function ProductCard({
  title,
  price,
  oldPrice,
  image,
  storeName,
  canTryOn = false,
  isLimited = false,
  link,
  onToggleFavorite,
  isFavorite = false,
  onAddToCart,
  showAddToCart = true,
  className,
}: ProductCardProps): JSX.Element {
  return (
    <article
      className={cn(
        'group relative flex flex-col justify-between rounded-2xl border border-border/80 bg-surface/70 p-3 sm:p-3.5 backdrop-blur-sm transition-all duration-300 hover:border-primary/50 hover:shadow-[0_0_28px_hsl(var(--primary)/0.18)]',
        className,
      )}
    >
      <div className="relative">
        {link(
          <div className="block focus-visible:outline-none">
            <div className="relative overflow-hidden rounded-xl">
              <ImageFrame
                src={image}
                alt={title}
                ratio="3/4"
                zoomOnHover
                calmWhite
                rounded="none"
              />
            </div>
          </div>,
        )}

        {/* ── Tepada belgilar: 3D va Limited ── */}
        <div className="pointer-events-none absolute start-2 top-2 z-10 flex gap-1.5">
          {canTryOn ? (
            <span className="rounded-lg border border-primary/60 bg-panel/85 px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-brand shadow-sm backdrop-blur-md">
              3D
            </span>
          ) : null}

          {isLimited ? (
            <span className="rounded-lg border border-limited/50 bg-limited/15 px-2.5 py-0.5 text-[11px] font-bold text-limited backdrop-blur-md">
              LIMITED
            </span>
          ) : null}
        </div>

        {/* ── Sevimlilarga qo'shish (yurakcha) ── */}
        {onToggleFavorite ? (
          <button
            type="button"
            aria-label="Sevimlilar"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleFavorite();
            }}
            className="absolute end-2 top-2 z-10 flex size-8 items-center justify-center rounded-full bg-background/50 text-foreground/80 backdrop-blur-md transition-transform duration-150 hover:scale-110 hover:text-brand active:scale-95"
          >
            <Icon
              name={isFavorite ? 'favoriteOn' : 'favorite'}
              size={18}
              className={isFavorite ? 'text-brand fill-brand' : 'text-foreground/90'}
            />
          </button>
        ) : (
          <span className="pointer-events-none absolute end-2.5 top-2.5 z-10 text-foreground/70 transition-transform duration-150 group-hover:text-foreground">
            <Icon name="favorite" size={18} />
          </span>
        )}
      </div>

      {/* ── Matnli qism ── */}
      <div className="mt-3 flex flex-1 flex-col justify-between">
        {link(
          <div className="block focus-visible:outline-none">
            <h3 className="truncate text-body font-semibold text-foreground transition-colors group-hover:text-brand">
              {title}
            </h3>

            {storeName ? (
              <p className="mt-0.5 truncate text-tiny text-dim font-normal">{storeName}</p>
            ) : null}

            <p className="mt-2 flex items-baseline gap-2">
              <span className="text-price font-bold tabular-nums text-brand">{price}</span>
              {oldPrice ? (
                <span className="text-small tabular-nums text-dim line-through">{oldPrice}</span>
              ) : null}
            </p>
          </div>,
        )}

        {/* ── Savatga qo'shish tugmasi ── */}
        {showAddToCart ? (
          <button
            type="button"
            onClick={(e) => {
              if (onAddToCart) {
                e.preventDefault();
                e.stopPropagation();
                onAddToCart(e);
              }
            }}
            className="mt-3.5 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary via-[#9333ea] to-brand px-4 text-small font-semibold text-white shadow-[0_4px_16px_hsl(var(--primary)/0.35)] transition-all duration-150 hover:brightness-110 active:scale-97"
          >
            <Icon name="cart" size={16} />
            Savatga qo'shish
          </button>
        ) : null}
      </div>
    </article>
  );
}
