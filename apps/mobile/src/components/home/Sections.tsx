import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { rtlStyles, useI18n } from '../../i18n';
import { Icon, type IconName } from '../Icon';
import { StoreLogo } from '../StoreLogo';
import type { Brand, NearbyStore } from '../../api/endpoints';
import { colors, radius, spacing, text } from '../../theme/tokens';

/**
 * Bo'lim sarlavhasi — Atelier editorial uslubi.
 *
 * Ilgari "TOP BRANDS" ALL CAPS, kichik, tracked-out letter spacing edi
 * (deckning eski tili). Endi Fraunces display serif — moda jurnali
 * bo'lim boshiga o'xshaydi. "View all" esa italic ligature ohangida.
 */
export function SectionHeader({
  title,
  actionLabel,
  onAction,
  icon,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: IconName;
}): JSX.Element {
  const isRTL = useI18n((state) => state.isRTL);

  return (
    <View style={[styles.header, rtlStyles.row(isRTL)]}>
      <View style={styles.titleRow}>
        {icon ? <Icon name={icon} size={24} color={colors.accent} /> : null}
        <Text style={styles.headerTitle}>{title}</Text>
      </View>
      {actionLabel && onAction ? (
        <Pressable style={[styles.action, rtlStyles.row(isRTL)]} onPress={onAction}>
          <Text style={styles.actionText}>{actionLabel}</Text>
          <Icon name={isRTL ? 'back' : 'next'} size={14} color={colors.primary} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** Brend kafellari — logotiplar oqimi. */
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
            <StoreLogo
              logoUrl={brand.logoUrl}
              name={brand.name}
              size={76}
              width={112}
              style={styles.brandMark}
              tintColor={colors.text}
            />
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

/** Do'kon kafellari — logotip + nom. */
export function StoreRow({
  stores,
  onPress,
}: {
  stores: NearbyStore[];
  onPress: (store: NearbyStore) => void;
}): JSX.Element {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={styles.brandRow}>
        {stores.map((store) => (
          <Pressable key={store.id} style={styles.storeTile} onPress={() => onPress(store)}>
            <StoreLogo
              logoUrl={store.logoUrl}
              name={store.name}
              size={76}
              width={112}
              style={styles.brandMark}
              tintColor={colors.text}
            />
            <Text style={styles.storeName} numberOfLines={1}>
              {store.name}
            </Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    paddingTop: spacing.sm,
  },
  // Atelier bo'lim sarlavhasi: Fraunces display, h2 o'lchami. Moda jurnali bo'lim boshi.
  headerTitle: { ...text.h2, color: colors.text, fontSize: 22 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  action: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  // "Barchasi" linki — italic serif, template "VIEW ALL →" dan farqli.
  actionText: { ...text.eyebrow, color: colors.primary },
  brandRow: { flexDirection: 'row', gap: 12 },
  brandTile: { alignItems: 'center', justifyContent: 'center' },
  storeTile: { alignItems: 'center', width: 112, gap: 6 },
  storeName: { ...text.small, color: colors.text, textAlign: 'center', maxWidth: 112 },
  // Atelier: kichikroq radius, chegara soch-ingichka (surface2 fonga mos)
  brandMark: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    shadowColor: '#5B21B6',
    shadowOpacity: 0.07,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
});
