import { forwardRef, type HTMLAttributes } from 'react';

import { cn } from './cn';

/**
 * Karta — 06-dizayn.md §7: qorong'i to'ldirish `#14121C`, 1px chegara
 * `#241F33`, burchak 16px.
 *
 * ⚠️ `rounded-card` (16px), `rounded-lg` (14px) EMAS. shadcn'ning
 * `--radius` i 14px va u tugma bilan kartani bir xil qiladi; ilovada esa
 * karta yumshoqroq (`radius.lg` = 16), tugma esa tigizroq (`radius.md`
 * = 12). Bu farq sezilmaydi, lekin yig'ilib «boshqa mahsulot» hissini
 * beradi.
 *
 * `interactive` — bosiladigan karta uchun. Telefonda hover yo'q, brauzerda
 * esa bo'lishi shart: sichqoncha ostida qimirlamagan karta bosiladigandek
 * ko'rinmaydi (13-sayt.md §6.5).
 */
export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { interactive = false, className, ...props },
  ref,
): JSX.Element {
  return (
    <div
      ref={ref}
      className={cn(
        'rounded-card border border-border bg-surface',
        interactive &&
          'cursor-pointer transition-[transform,border-color] duration-150 ease-spring hover:-translate-y-0.5 hover:border-borderStrong',
        className,
      )}
      {...props}
    />
  );
});
