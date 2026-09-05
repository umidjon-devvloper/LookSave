import { cn } from './cn';

/**
 * Yuklanish skeletonlari — mobil `components/Skeleton.tsx` ning veb
 * ko'chirmasi.
 *
 * ⚠️ NEGA AYLANUVCHI INDIKATOR EMAS: bo'sh maydon o'rtasidagi spinner
 * nima kutayotganini aytmaydi va kutish uzoqroq tuyuladi. Skeleton esa
 * joylashuvni oldindan chizadi — kontent kelganda sahifa sakramaydi.
 * Bu sezilgan tezlikni oshiradi, garchi haqiqiy tezlik o'zgarmasa ham
 * (va CLS ni nolga tushiradi — 13-sayt.md §12).
 *
 * ⚠️ PULS `animate-pulse-soft`, Tailwind'ning `animate-pulse` I EMAS.
 * Standart puls 0 dan 1 gacha yonadi va ro'yxat «lipillayotgandek»
 * ko'rinadi; ilovadagi qiymat 0.45 → 0.85. Animatsiya presetda bitta
 * nom bilan turgani uchun sahifadagi barcha skeletonlar bir maromda
 * yonadi.
 */
export function Skeleton({ className }: { className?: string }): JSX.Element {
  return (
    <div
      // Ekran o'quvchisi skeletonni o'qimasligi kerak — u mazmun emas
      aria-hidden="true"
      className={cn('animate-pulse-soft rounded-sm bg-surface2', className)}
    />
  );
}

/**
 * Matn bloki.
 *
 * Oxirgi qator qisqaroq: haqiqiy matn ham shunday tugaydi va bu kichik
 * tafsilot blokni «yuklanmoqda» emas, «matn» qilib ko'rsatadi.
 */
export function SkeletonText({ lines = 2 }: { lines?: number }): JSX.Element {
  return (
    <div className="flex flex-col gap-1">
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} className={cn('h-3', index === lines - 1 ? 'w-[62%]' : 'w-full')} />
      ))}
    </div>
  );
}

/** Mahsulot kartasi — katalog va bosh sahifadagi to'r uchun. */
export function SkeletonCard(): JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      {/* 3:4 — haqiqiy mahsulot rasmi bilan bir xil nisbat, aks holda
          ma'lumot kelganda to'r sakraydi */}
      <Skeleton className="aspect-[3/4] w-full rounded-md" />
      <div className="flex flex-col gap-1">
        <Skeleton className="h-3 w-[85%]" />
        <Skeleton className="h-[11px] w-[55%]" />
        <Skeleton className="mt-1 h-3.5 w-[42%]" />
      </div>
    </div>
  );
}

/** Ro'yxat qatori — buyurtma, do'kon, savat uchun. */
export function SkeletonRow(): JSX.Element {
  return (
    <div className="flex items-center gap-2">
      <Skeleton className="size-14 shrink-0 rounded-md" />
      <div className="flex flex-1 flex-col gap-1">
        <Skeleton className="h-3 w-[70%]" />
        <Skeleton className="h-[11px] w-[45%]" />
      </div>
    </div>
  );
}

/**
 * To'r ko'rinishidagi kutish holati.
 *
 * `count` — nechta karta. Ekranga sig'adigan miqdordan ko'p bermang:
 * ko'rinmaydigan skeleton foyda bermaydi, faqat animatsiyani og'irlashtiradi.
 */
export function SkeletonGrid({ count = 4 }: { count?: number }): JSX.Element {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }, (_, index) => (
        <SkeletonCard key={index} />
      ))}
    </div>
  );
}

/** Ro'yxat ko'rinishidagi kutish holati. */
export function SkeletonList({ count = 5 }: { count?: number }): JSX.Element {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: count }, (_, index) => (
        <SkeletonRow key={index} />
      ))}
    </div>
  );
}
