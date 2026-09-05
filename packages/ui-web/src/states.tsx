import { Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';

import { Icon, type IconName } from './Icon';
import { cn } from './cn';

/**
 * Uchta majburiy holat: `loading`, `empty`, `error`
 * (05-mobile.md §5, mobil `components/ui.tsx`).
 *
 * Saytda bular umuman yo'q edi — bo'sh natija «Hech narsa topilmadi»
 * degan quruq qator bilan ko'rsatilardi (P-08). Bo'sh oq maydon esa
 * «yuklanmadimi?» degan taassurot qoldiradi.
 */

const SHELL = 'flex flex-col items-center justify-center gap-2 px-8 py-16 text-center';

/** 64px doira — uchala holatda bir xil o'lcham, faqat rangi boshqa */
const RING = 'mb-1 flex size-16 items-center justify-center rounded-full border';

export function Loading({ label }: { label?: string }): JSX.Element {
  return (
    <div className={SHELL} role="status" aria-live="polite">
      <Loader2 className="size-6 animate-spin text-primary" aria-hidden="true" />
      {label ? <p className="text-small text-dim">{label}</p> : null}
    </div>
  );
}

/**
 * Bo'sh holat.
 *
 * ⚠️ IKONKA BEJIZ EMAS. Faqat matndan iborat bo'sh ekran «xato bo'ldimi?»
 * degan taassurot qoldiradi. Doira ichidagi belgi esa bu holat ATAYIN
 * ekanini bildiradi — ya'ni hammasi joyida, shunchaki hali hech narsa yo'q.
 */
export function Empty({
  title,
  hint,
  icon = 'search',
  action,
  className,
}: {
  title: string;
  hint?: string;
  icon?: IconName;
  action?: ReactNode;
  className?: string;
}): JSX.Element {
  return (
    <div className={cn(SHELL, className)}>
      <div className={cn(RING, 'border-border bg-primarySoft text-primary')}>
        <Icon name={icon} size={26} />
      </div>

      <h3 className="text-h3 font-semibold text-foreground">{title}</h3>
      {hint ? <p className="max-w-[42ch] text-small text-dim">{hint}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

/**
 * Xato holati.
 *
 * ⚠️ TARMOQ XATOSI ALOHIDA AJRATILADI. Hamma nosozlik «Xatolik yuz berdi»
 * deb ko'rsatilsa va yonida «Qayta urinish» tursa, internet yo'q paytda
 * tugma HECH QACHON ishlamaydi — foydalanuvchi uni bosaveradi va sayt
 * buzuq deb o'ylaydi. `variant="network"` da sabab aniq aytiladi.
 *
 * ⚠️ SARLAVHA OQ, QIZIL EMAS. Qizil matn butun ekranni tashvishli qiladi;
 * sababni ikonka bildiradi, matn esa o'qilishi kerak.
 */
export function ErrorView({
  message,
  variant = 'generic',
  action,
  className,
}: {
  message: string;
  variant?: 'generic' | 'network';
  /** «Qayta urinish» tugmasi — matni chaqiruvchidan keladi (tarjima uchun) */
  action?: ReactNode;
  className?: string;
}): JSX.Element {
  return (
    <div className={cn(SHELL, className)} role="alert">
      <div className={cn(RING, 'border-danger/30 bg-danger/[0.12] text-danger')}>
        <Icon name={variant === 'network' ? 'settings' : 'close'} size={26} />
      </div>

      <p className="max-w-[42ch] text-body text-foreground">{message}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
