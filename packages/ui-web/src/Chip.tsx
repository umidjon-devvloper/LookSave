import { forwardRef, type ButtonHTMLAttributes } from 'react';

import { cn } from './cn';

/**
 * Chip — o'lcham, rang va filtr tanlash uchun (06-dizayn.md §7).
 *
 * Burchak `pill`: chip kichik va yumaloq bo'lgani uchun tugmadan darrov
 * ajralib turadi. Aynan shu sababli TUGMA pill emas — ikkalasi bir xil
 * shaklda bo'lsa ierarxiya yo'qoladi.
 *
 * Tanlangan holat fon bilan beriladi (`primarySoft`), rang bilan emas:
 * faqat matn rangi o'zgarsa, bir qatorda 8 ta chip turganda qaysi biri
 * tanlanganini topish qiyin.
 */
export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
}

export const Chip = forwardRef<HTMLButtonElement, ChipProps>(function Chip(
  { selected = false, className, type, ...props },
  ref,
): JSX.Element {
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      aria-pressed={selected}
      className={cn(
        'inline-flex select-none items-center gap-1.5 rounded-full border px-3.5 py-1.5',
        'text-small transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'disabled:pointer-events-none disabled:opacity-45',
        selected
          ? 'border-borderAccent bg-primarySoft text-brand'
          : 'border-border bg-surface2 text-muted-foreground hover:bg-surface3 hover:text-foreground',
        className,
      )}
      {...props}
    />
  );
});
