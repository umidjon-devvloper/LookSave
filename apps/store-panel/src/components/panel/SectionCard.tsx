import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * Sarlavhali blok — ikonka, nom, izoh va o'ngdagi amal, ostida mazmun.
 *
 * ⚠️ NEGA `padded` BAYROG'I BOR. Blok ichida ikki xil narsa turadi:
 * forma (ichki bo'shliq kerak) va jadval (kerak emas — jadval o'z
 * kataklarida bo'shliq beradi). Bitta blokda ikkalasini ham qoplash
 * uchun ichki bo'shliqni o'chirish yo'li kerak, aks holda jadval
 * chetlari blok chegarasidan uzilib qolardi.
 */
export function SectionCard({
  title,
  description,
  icon: Icon,
  action,
  padded = true,
  children,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: ReactNode;
  padded?: boolean;
  children: ReactNode;
}): JSX.Element {
  return (
    <section className="card overflow-hidden">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-start gap-2.5">
          {Icon ? (
            <Icon aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-dim" strokeWidth={1.75} />
          ) : null}
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">{title}</h2>
            {description ? <p className="mt-0.5 text-xs text-dim">{description}</p> : null}
          </div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>

      <div className={padded ? 'p-4' : ''}>{children}</div>
    </section>
  );
}
