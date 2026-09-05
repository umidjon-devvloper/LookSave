import { cn } from './cn';

/**
 * Buyurtma holati chipi — mobil `theme/orderStatus.ts` va `app/orders.tsx`
 * dagi ko'rinishning aynan o'zi: pill, 1px rangli chegara, ichida qalin
 * kichik matn (P-07).
 *
 * Holat CHIP sifatida beriladi, oddiy matn sifatida emas: ro'yxatda o'nta
 * buyurtma turganda rangsiz matn ko'zga tashlanmaydi.
 *
 * Kutish holatlari SARIQ (harakat kerak), muvaffaqiyat YASHIL, rad etilgan
 * va muddati o'tgan QIZIL, tugagan/bekor qilingan esa neytral — ular endi
 * e'tibor talab qilmaydi.
 *
 * ⚠️ MATN TARJIMASI SERVERDAN KELADI (`statusLabel`), bu yerda emas.
 * Holat nomlari to'rt tilda va ularni saytda qayta yozish ikkinchi manba
 * yaratadi.
 *
 * ⚠️ `completed`/`cancelled` UCHUN `status-done` EMAS, `muted-foreground`.
 * Sabab: ilovada shu ikki holat `colors.textMuted` (#9B96AE) bilan
 * chiziladi, `tokens.ts` dagi `statusDone` (#635D78) esa hech qayerda
 * ishlatilmaydi. Tenglik ekranda ko'rinadigan narsaga qarab o'lchanadi.
 * Ikki qiymatni yarashtirish — alohida ish, ilova tomonida.
 */
const TONE: Record<string, string> = {
  new: 'border-status-waiting text-status-waiting',
  seen: 'border-status-waiting text-status-waiting',
  confirmed: 'border-status-confirmed text-status-confirmed',
  ready: 'border-status-confirmed text-status-confirmed',
  completed: 'border-muted-foreground text-muted-foreground',
  cancelled: 'border-muted-foreground text-muted-foreground',
  rejected: 'border-status-rejected text-status-rejected',
  expired: 'border-status-rejected text-status-rejected',
};

const NEUTRAL = 'border-muted-foreground text-muted-foreground';

export function statusTone(status: string): string {
  return TONE[status] ?? NEUTRAL;
}

export function StatusBadge({
  status,
  label,
  className,
}: {
  /** Server holati: `new`, `confirmed`, `rejected`… */
  status: string;
  /** Ko'rinadigan matn — serverdan tarjima qilingan holda keladi */
  label: string;
  className?: string;
}): JSX.Element {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-[3px] text-tiny font-bold',
        statusTone(status),
        className,
      )}
    >
      {label}
    </span>
  );
}
