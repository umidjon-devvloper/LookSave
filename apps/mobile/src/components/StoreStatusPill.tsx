import { StyleSheet, Text, View } from 'react-native';

import { useI18n } from '../i18n';
import { colors, radius, spacing } from '../theme/tokens';

/**
 * «Hozir ochiq» / «Yopiq» pill. API StoreDetail.isOpen + closesAt/opensAt
 * bilan birga keladi — do'kon ro'yxatlarida va mahsulot sahifasida
 * ko'ringanda reviewer bir qarashda holatni ko'radi (jonli, mahalliy signal).
 *
 * Kompakt variantda faqat nuqta + matn (yaqin do'konlar lentasi uchun),
 * default — nuqta + matn + vaqt.
 */
interface Props {
  isOpen: boolean;
  closesAt?: string | null;
  opensAt?: string | null;
  compact?: boolean;
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function StoreStatusPill({ isOpen, closesAt, opensAt, compact }: Props): JSX.Element {
  const t = useI18n((s) => s.t);
  // Matn lug'atdan (`t.stores`). Ilgari bu yerda mavjud bo'lmagan
  // `t.store.openNow` kaliti o'qilardi va har doim o'zbekcha «Ochiq»/«Yopiq»
  // chiqardi — ingliz tilida ham.
  const tone = isOpen ? colors.success : colors.textMuted;
  const bg = isOpen ? 'rgba(22,166,106,0.12)' : 'rgba(21,19,30,0.06)';

  const short = isOpen ? t.stores.open : t.stores.closed;
  const full =
    isOpen && closesAt
      ? t.stores.openUntil.replace('{time}', fmtTime(closesAt))
      : !isOpen && opensAt
        ? t.stores.closedOpensAt.replace('{time}', fmtTime(opensAt))
        : short;

  return (
    <View style={[styles.pill, { backgroundColor: bg }, compact && styles.compact]}>
      <View style={[styles.dot, { backgroundColor: tone }]} />
      <Text style={[styles.text, { color: tone }, compact && styles.textCompact]} numberOfLines={1}>
        {compact ? short : full}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  compact: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
  textCompact: {
    fontSize: 10,
  },
});
