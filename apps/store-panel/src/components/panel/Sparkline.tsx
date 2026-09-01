/**
 * Mayda chiziqli grafik — plitka ichidagi tendensiya.
 *
 * ⚠️ RECHARTS EMAS. `Analytics.tsx` dagi ustunli grafik ham shu sababdan
 * qo'lda chizilgan: bitta chiziq uchun ~100 KB kutubxona qo'shish o'zini
 * oqlamaydi (07-web-panels §4.6 dagi qaror).
 *
 * ⚠️ `vector-effect="non-scaling-stroke"` — MAJBURIY. `preserveAspectRatio`
 * o'chirilgani uchun SVG eni bo'yicha cho'ziladi; usiz chiziq qalinligi
 * ham cho'zilib, gorizontal joylarda ingichka, tik joylarda qalin
 * ko'rinardi.
 */
export function Sparkline({
  values,
  className = '',
}: {
  values: number[];
  className?: string;
}): JSX.Element | null {
  // Ikkita nuqtadan kam bo'lsa chiziq yo'q — bitta nuqta tendensiya emas.
  if (values.length < 2) return null;

  const max = Math.max(1, ...values);
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 100;
      const y = 30 - (value / max) * 26;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');

  return (
    <svg
      aria-hidden
      viewBox="0 0 100 32"
      preserveAspectRatio="none"
      className={`h-8 w-full ${className}`}
    >
      {/* Chiziq ostidagi yumshoq to'ldirish — balandlikni o'qishni osonlashtiradi */}
      <polygon points={`0,32 ${points} 100,32`} className="fill-primary/10" />
      <polyline
        points={points}
        fill="none"
        vectorEffect="non-scaling-stroke"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-primary"
      />
    </svg>
  );
}
