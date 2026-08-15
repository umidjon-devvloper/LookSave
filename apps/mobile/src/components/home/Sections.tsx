import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { rtlStyles, useI18n } from '../../i18n';
import { Icon } from '../Icon';
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
          <Pressable key={brand.id} style={styles.brandTile} onPress={() => onPress(brand)}>
            {brand.logoUrl ? (
              <Image
                source={{ uri: brand.logoUrl }}
                style={styles.brandLogo}
                resizeMode="contain"
              />
            ) : (
              // Logotip yo'q bo'lsa — brend nomi. Deckda logotiplar oq, shuning
              // uchun nom ham oq va siqilgan harflar bilan beriladi.
              <Text style={styles.brandName} numberOfLines={2}>
                {brand.name}
              </Text>
            )}
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
  brandTile: {
    width: 86,
    height: 64,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.sm,
  },
  brandLogo: { width: '100%', height: '100%' },
  brandName: {
    ...text.tiny,
    color: colors.text,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
});
