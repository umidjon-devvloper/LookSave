import type { LucideIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
export function Spinner({ label = 'Yuklanmoqda' }: { label?: string }): JSX.Element {
  return (
    <div className="flex items-center justify-center gap-3 py-12 text-sm text-dim">
      <span
        aria-hidden
        className="h-4 w-4 animate-spin rounded-full border-2 border-borderStrong border-t-primary"
      />
      {label}
    </div>
  );
}

/**
 * Bo'sh holat.
 *
 * ⚠️ ILLYUSTRATSIYA `icon` BERILGANDAGINA CHIZILADI. Bo'sh ro'yxat —
 * panelda eng ko'p uchraydigan holat (yangi do'konda hamma sahifa
 * bo'sh), va faqat matn qolgan ekran «yuklanmadimi?» degan shubha
 * qoldiradi. Ikonka atrofidagi nurlanish bo'shliqni ATAYLAB shunday
 * ekanini ko'rsatadi.
 *
 * ⚠️ `icon` IXTIYORIY, chunki bu komponentni beshta sahifa chaqiradi.
 * Majburiy qilinsa, hammasi bir vaqtda o'zgarishi kerak bo'lardi;
 * ixtiyoriy bo'lgani uchun sahifalar birma-bir ko'chiriladi va
 * ko'chirilmagani eski ko'rinishda ishlab turaveradi.
 */
export function EmptyState({
  title,
  hint,
  icon: Icon,
}: {
  title: string;
  hint?: string;
  icon?: LucideIcon;
}): JSX.Element {
  return (
    <div className="card flex flex-col items-center gap-2 px-6 py-14 text-center">
      {Icon ? (
        <span aria-hidden className="relative mb-3 flex h-28 w-28 items-center justify-center">
          {/* Nurlanish — maketdagi binafsha halqa */}
          <span className="absolute inset-3 rounded-full bg-primary/15 blur-2xl" />
          <span className="absolute inset-4 rounded-full border border-primary/20 bg-gradient-to-br from-primary/20 to-transparent" />
          <Icon className="relative h-10 w-10 text-primary/80" strokeWidth={1.5} />

          {/* Uchqunlar — o'lchami va shaffofligi turlicha, aks holda naqsh bo'lib qoladi */}
          <span className="absolute left-1 top-6 h-1 w-1 rounded-full bg-brand/70" />
          <span className="absolute right-2 top-3 h-1.5 w-1.5 rounded-full bg-primary/50" />
          <span className="absolute bottom-4 right-1 h-1 w-1 rounded-full bg-chart-3/60" />
          <span className="absolute bottom-6 left-4 h-1 w-1 rounded-full bg-brand/40" />
        </span>
      ) : null}

      <p className="text-base font-semibold text-foreground">{title}</p>
      {hint ? <p className="max-w-sm text-sm text-dim">{hint}</p> : null}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}): JSX.Element {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-12 text-center">
      <p className="text-sm text-danger">{message}</p>
      {onRetry ? (
        <Button variant="outline" type="button" onClick={onRetry}>
          Qayta urinish
        </Button>
      ) : null}
    </div>
  );
}
