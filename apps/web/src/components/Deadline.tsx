import { useEffect, useState } from 'react';

import { cn } from '@/lib/utils';

/**
 * «Javob kutilmoqda — 21 soat qoldi».
 *
 * ⚠️ FAQAT BRAUZERDA CHIZILADI. Qolgan vaqt hozirgi vaqtga bog'liq;
 * server bir soniya, brauzer boshqa soniyani ko'radi va React
 * gidratatsiyada mos kelmaslikdan shikoyat qiladi. Bundan ham yomoni —
 * server javobi keshlansa, muddat qotib qolardi.
 *
 * Shuning uchun serverda hech narsa chizilmaydi (`null`), brauzerda esa
 * `useEffect` dan keyin paydo bo'ladi. Bu blok ikkinchi darajali
 * ma'lumot: bo'lmasa ham sahifa to'liq.
 */
export function Deadline({
  iso,
  className,
}: {
  iso: string | null;
  className?: string;
}): JSX.Element | null {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    if (!iso) return;

    const tick = (): void => {
      const left = new Date(iso).getTime() - Date.now();

      if (!Number.isFinite(left)) {
        setText(null);
        return;
      }

      if (left <= 0) {
        setText('javob muddati tugadi');
        return;
      }

      const hours = Math.floor(left / 3_600_000);
      const minutes = Math.floor((left % 3_600_000) / 60_000);

      setText(hours > 0 ? `javobga ${hours} soat qoldi` : `javobga ${minutes} daqiqa qoldi`);
    };

    tick();
    // Daqiqada bir marta yetarli — sekundlar bu yerda ma'no tashimaydi
    const timer = setInterval(tick, 60_000);
    return () => clearInterval(timer);
  }, [iso]);

  if (text === null) return null;

  return <p className={cn('text-tiny text-warning', className)}>{text}</p>;
}
