import { forwardRef, useId, type InputHTMLAttributes } from 'react';

import { cn } from './cn';

/**
 * Kiritish maydoni — mobil `components/ui.tsx` dagi `Field` ning aynan
 * o'zi (docs/13-sayt.md §6.2, P-09).
 *
 *   balandlik  52px   `h-control`
 *   burchak    12px   `rounded-md`
 *   fon        #14121C `bg-surface`  → fokusda #1C1928 `bg-surface2`
 *   chegara    #241F33 `border`      → fokusda #7C3AED `border-borderAccent`
 *
 * ⚠️ FOKUSDA HALQA EMAS, CHEGARA VA FON O'ZGARADI. shadcn `ring` qo'yadi,
 * ilova esa chegara rangini almashtiradi. Ikkisi yonma-yon turganda farq
 * darrov ko'rinadi — shuning uchun bu yerda ilovaniki.
 *
 * ⚠️ SARLAVHA IXTIYORIY. Ba'zi joyda u `placeholder` bilan bir xil matn
 * bo'lib, ekranda ikki marta takrorlanadi («SEARCH PRODUCTS…» ustida yana
 * «Search products…»). Bunday joyda faqat `placeholder` qoldiriladi.
 *
 * ⚠️ XATO FOKUSDAN USTUN: yozayotganda ham ko'rinib turishi kerak,
 * aks holda odam maydonga qaytganda xato yo'qoladi va u tuzatilgandek
 * tuyuladi.
 */

export interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> {
  label?: string;
  error?: string | null;
  /** Tashqi joylashuv — o'rash elementiga tushadi, maydonning o'ziga emas */
  className?: string;
  inputClassName?: string;
}

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, error, className, inputClassName, id, ...props },
  ref,
): JSX.Element {
  const autoId = useId();
  const inputId = id ?? autoId;
  const errorId = `${inputId}-error`;

  return (
    <div className={cn('group flex flex-col gap-2', className)}>
      {label ? (
        <label
          htmlFor={inputId}
          className={cn(
            'text-label font-semibold uppercase text-dim transition-colors',
            // Ota-elementda fokus bo'lsa sarlavha yorishadi — mobil'da ham shunday
            'group-focus-within:text-brand',
          )}
        >
          {label}
        </label>
      ) : null}

      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn(
          'h-control w-full rounded-md border bg-surface px-4 text-body text-foreground',
          'transition-colors placeholder:text-dim',
          'focus:border-borderAccent focus:bg-surface2 focus:outline-none',
          'disabled:cursor-not-allowed disabled:opacity-45',
          error ? 'border-danger focus:border-danger' : 'border-border',
          inputClassName,
        )}
        {...props}
      />

      {error ? (
        <p id={errorId} className="text-small text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
});
