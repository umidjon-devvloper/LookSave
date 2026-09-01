import type { ReactNode } from 'react';

/**
 * Sahifa sarlavhasi — nom, ostidagi izoh va o'ngdagi amal.
 *
 * ⚠️ NEGA IZOH MAJBURIY EMAS, LEKIN DEYARLI HAR SAHIFADA BOR. Panelda
 * sahifa nomi ko'pincha bitta so'z («Hisoblar», «Jamoa») va u nima
 * qilishini tushuntirmaydi. Bir qatorli izoh sotuvchiga sahifaga
 * kirmasdan turib nima kutishini aytadi — yon menyudagi nom bilan
 * sahifa mazmuni orasidagi bo'shliqni shu to'ldiradi.
 */
export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}): JSX.Element {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-dim">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
