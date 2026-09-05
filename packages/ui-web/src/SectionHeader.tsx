import type { ReactNode } from 'react';

import { Icon } from './Icon';
import { cn } from './cn';

/**
 * Bo'lim sarlavhasi — deckdagi «TOP BRANDS» / «TRENDING NOW» uslubi
 * (06-dizayn.md §3: 11px, letter-spacing 1.6px, katta harf).
 *
 * Mobil manba: `src/components/home/Sections.tsx`.
 *
 * ⚠️ KATTA HARF `text-transform` BILAN QO'YILMAYDI. O'zbek va rus tilida
 * u chiroyli chiqmaydi (`Ko'ylak` → `KO'YLAK`), arabchada esa katta harf
 * tushunchasi umuman yo'q. Shuning uchun matnni chaqiruvchi o'zi katta
 * harfda beradi — inglizcha yorliqlarda (06-dizayn.md §3).
 */
export function SectionHeader({
  title,
  action,
  className,
}: {
  title: string;
  /** «hammasi ›» havolasi — matn va bosilganda bajariladigan ish */
  action?: { label: string; href?: string; onClick?: () => void };
  className?: string;
}): JSX.Element {
  const inner: ReactNode = action ? (
    <>
      {action.label}
      <Icon name="next" size={14} />
    </>
  ) : null;

  return (
    <div className={cn('flex items-center gap-4', className)}>
      <h2 className="shrink-0 text-label font-semibold tracking-label text-foreground">{title}</h2>

      {/*
        ⚠️ YUPQA CHIZIQ — bezak emas, tekislagich.
        11px lik yorliq katta ekranda keng to'r ustida yolg'iz osilib
        qolardi va bo'lim boshlangani sezilmasdi. Chiziq yorliqni
        kontent kengligiga bog'laydi va ko'z uni sarlavha sifatida
        o'qiydi. Deckdagi 11px uslub esa saqlanadi (06-dizayn.md §3).
      */}
      <span aria-hidden="true" className="h-px flex-1 bg-border" />

      {action ? (
        action.href ? (
          <a
            href={action.href}
            className="inline-flex shrink-0 items-center gap-0.5 text-tiny font-medium text-brand transition-opacity hover:opacity-80"
          >
            {inner}
          </a>
        ) : (
          <button
            type="button"
            onClick={action.onClick}
            className="inline-flex shrink-0 items-center gap-0.5 text-tiny font-medium text-brand transition-opacity hover:opacity-80"
          >
            {inner}
          </button>
        )
      ) : null}
    </div>
  );
}
