import type { TimelineStep } from '@looksave/ui-web';

/**
 * Buyurtma holatining vaqt chizig'i — docs/15-sayt-dizayn.md §4.9.
 *
 * Oqim `apps/api/src/routes/orders.ts` dagi `STATUS_LABELS` dan olingan:
 *
 *   new → seen → confirmed → ready → completed
 *
 * Uzilishlar: `rejected` (do'kon rad etdi), `cancelled` (xaridor bekor
 * qildi), `expired` (do'kon javob bermadi).
 *
 * ⚠️ YORLIQ SERVERDAN KELADI (`statusLabel`), bu yerda emas — u to'rt
 * tilda va uni saytda qayta yozish ikkinchi manba yaratardi. Bu fayl
 * faqat TARTIBNI biladi, matnni emas.
 */

const FLOW = ['new', 'seen', 'confirmed', 'ready', 'completed'] as const;

/** Ketma-ketlikni uzadigan holatlar */
const TERMINAL: Record<string, string> = {
  rejected: "Do'kon rad etdi",
  cancelled: 'Bekor qilindi',
  expired: 'Javob kelmadi',
};

const STEP_LABEL: Record<(typeof FLOW)[number], string> = {
  new: 'Yuborildi',
  seen: "Do'kon ko'rdi",
  confirmed: "Do'kon tasdiqladi",
  ready: 'Tayyor',
  completed: 'Yakunlandi',
};

export function orderTimeline(
  status: string,
  options: { rejectReason?: string | null; cancelReason?: string | null } = {},
): TimelineStep[] {
  const terminalLabel = TERMINAL[status];

  if (terminalLabel !== undefined) {
    /*
     * Uzilgan buyurtma: qayerda to'xtaganini bilmaymiz (server oraliq
     * holatlarni saqlamaydi), shuning uchun faqat «yuborildi» va
     * uzilish ko'rsatiladi. Yolg'on bosqich chizishdan ko'ra kam
     * ma'lumot berish yaxshiroq.
     */
    return [
      { key: 'new', label: STEP_LABEL.new, state: 'done' },
      {
        key: status,
        label: terminalLabel,
        state: 'failed',
        hint: options.rejectReason ?? options.cancelReason ?? undefined,
      },
    ];
  }

  const current = FLOW.indexOf(status as (typeof FLOW)[number]);

  // Noma'lum holat — chizmaymiz, chaqiruvchi `StatusBadge` bilan kifoyalanadi
  if (current === -1) return [];

  return FLOW.map((key, index) => ({
    key,
    label: STEP_LABEL[key],
    state: index < current ? 'done' : index === current ? 'current' : 'upcoming',
  }));
}
