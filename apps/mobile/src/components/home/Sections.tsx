import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { rtlStyles, useI18n } from '../../i18n';
import { Icon } from '../Icon';
import { StoreLogo } from '../StoreLogo';
import type { Brand } from '../../api/endpoints';
import { colors, radius, spacing, text } from '../../theme/tokens';

/**
 * Bo'lim sarlavhasi — deckdagi "TOP BRANDS" / "TRENDING NOW" uslubi
 * (06-dizayn.md §3: 11px, letter-spacing 1.6, katta harf).
 */
export function SectionHeader({
  title,
  actionLabel,
  onAction,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}): JSX.Element {
  const isRTL = useI18n((state) => state.isRTL);

  return (
    <View style={[styles.header, rtlStyles.row(isRTL)]}>
      <Text style={styles.headerTitle}>{title}</Text>
      {actionLabel && onAction ? (
        <Pressable style={[styles.action, rtlStyles.row(isRTL)]} onPress={onAction}>
          <Text style={styles.actionText}>{actionLabel}</Text>
          <Icon name={isRTL ? 'back' : 'next'} size={14} color={colors.accent} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** Brend kafellari — deckning 01 va 08-slaydidagi qator. */
export function BrandRow({
  brands,
  onPress,
}: {
  brands: Brand[];
  onPress: (brand: Brand) => void;
}): JSX.Element {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={styles.brandRow}>
        {brands.map((brand) => (
          /*
            ⚠️ TASHQI KUTI OLIB TASHLANDI. Ilgari `brandTile` ning o'z chegarasi
            bor edi va `StoreLogo` ning ichida ham chegara bor — natija "ikki
            quti ichida bir harf" bo'lib ko'rinardi. Endi faqat `StoreLogo`
            o'zi — toza va kattaroq, deckdagi logotip tasavvuriga yaqinroq.
          */
          <Pressable key={brand.id} style={styles.brandTile} onPress={() => onPress(brand)}>
            <StoreLogo
              logoUrl={brand.logoUrl}
              name={brand.name}
              size={76}
              width={112}
              style={styles.brandMark}
            />
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  headerTitle: { ...text.label, color: colors.text },
  action: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  actionText: { ...text.tiny, color: colors.accent },
  brandRow: { flexDirection: 'row', gap: spacing.sm },
  // Nomlar olib tashlandi — logo o'zi tanish. Faqat quti qoladi,
  // ixcham va zich qator sifatida.
  brandTile: { alignItems: 'center', justifyContent: 'center' },
  brandMark: { borderRadius: radius.lg, borderWidth: 0 },
});
