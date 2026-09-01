import { colors } from './tokens';

/**
 * Buyurtma holati → rang.
 *
 * ⚠️ NEGA UMUMIY FAYLDA. Bu xarita `order/[id].tsx` ichida yozilgan edi va
 * ro'yxat ekrani undan foydalana olmasdi. Ikki joyda takrorlansa ular
 * vaqt o'tib ajralib ketardi: bitta ekranda «tasdiqlangan» yashil,
 * ikkinchisida kulrang bo'lib qolishi mumkin edi.
 *
 * Kutish holatlari SARIQ (harakat kerak), muvaffaqiyat YASHIL,
 * rad etilgan va muddati o'tgan QIZIL, tugagan/bekor qilingan esa
 * neytral — ular endi e'tibor talab qilmaydi.
 */
export const STATUS_TONE: Record<string, string> = {
  new: colors.warning,
  seen: colors.warning,
  confirmed: colors.success,
  ready: colors.success,
  completed: colors.textMuted,
  rejected: colors.danger,
  cancelled: colors.textMuted,
  expired: colors.danger,
};

export const statusTone = (status: string): string => STATUS_TONE[status] ?? colors.textMuted;
