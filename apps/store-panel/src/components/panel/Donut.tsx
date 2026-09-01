/**
 * Halqali ko'rsatkich — foizni bir qarashda ko'rsatadi.
 *
 * ⚠️ `null` — NOL EMAS. Konversiya hisoblanmaganda (hali kiyib ko'rish
 * yo'q) halqa BO'SH qoladi va markazda «—» turadi. Nol deb ko'rsatilsa
 * sotuvchi «hech kim sotib olmayapti» deb o'ylardi, holbuki o'lchov
 * umuman boshlanmagan.
 *
 * ⚠️ AYLANA `-90°` GA BURILGAN: SVG da 0° soat 3 ida. Usiz to'ldirish
 * o'ngdan boshlanardi, odam esa yuqoridan kutadi.
 */
const RADIUS = 26;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function Donut({
  percent,
  tone = 'stroke-primary',
}: {
  percent: number | null;
  /** Tailwind `stroke-*` sinfi — chegaraviy qiymatda rangni o'zgartirish uchun. */
  tone?: string;
}): JSX.Element {
  const clamped = percent === null ? 0 : Math.max(0, Math.min(100, percent));
  const filled = (clamped / 100) * CIRCUMFERENCE;

  return (
    <div className="relative h-20 w-20 shrink-0">
      <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90">
        <circle
          cx="32"
          cy="32"
          r={RADIUS}
          fill="none"
          strokeWidth={6}
          className="stroke-surface3"
        />
        {percent === null ? null : (
          <circle
            cx="32"
            cy="32"
            r={RADIUS}
            fill="none"
            strokeWidth={6}
            strokeLinecap="round"
            strokeDasharray={`${filled} ${CIRCUMFERENCE}`}
            className={`${tone} transition-[stroke-dasharray] duration-500`}
          />
        )}
      </svg>

      <span className="absolute inset-0 flex items-center justify-center text-sm font-bold tabular-nums text-foreground">
        {percent === null ? '—' : `${percent}%`}
      </span>
    </div>
  );
}
