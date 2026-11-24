import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { rtlStyles, useI18n } from '../../i18n';
import { Icon, type IconName } from '../Icon';
import { StoreLogo } from '../StoreLogo';
import { StoreStatusPill } from '../StoreStatusPill';
import type { Brand, NearbyStore } from '../../api/endpoints';
import { colors, radius, spacing, text } from '../../theme/tokens';

function fmtDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

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
        {icon ? <Icon name={icon} size={18} color={colors.accent} /> : null}
        <Text style={styles.headerTitle}>{title}</Text>
      </View>
      {actionLabel && onAction ? (
        <Pressable style={[styles.action, rtlStyles.row(isRTL)]} onPress={onAction}>
          <Text style={styles.actionText}>{actionLabel}</Text>
          <Icon name={isRTL ? 'back' : 'next'} size={16} color={colors.primary} />
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

/**
 * Do'kon kafellari — logotip + nom + masofa + «Hozir ochiq» pill.
 *
 * 2026-11-21: ilgari faqat logo va nom edi. Endi mahalliy ekotizim
 * signali — reviewer bir qarashda masofani va do'kon holatini ko'radi.
 * `stores` ro'yxati `getNearbyStores` dan masofaga ko'ra tartiblangan
 * holda keladi (API: `ST_Distance` bo'yicha ORDER BY).
 */
export function StoreRow({
  stores,
  onPress,
  onNavigate,
}: {
  stores: NearbyStore[];
  onPress: (store: NearbyStore) => void;
  /**
   * Yo'nalish tugmasi bosilganda — Yandex Navi ochiladi.
   * Berilmasa tugma ko'rinmaydi (eski chaqiruvlar buzilmasin).
   */
  onNavigate?: (store: NearbyStore) => void;
}): JSX.Element {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={styles.brandRow}>
        {stores.map((store) => (
          <Pressable key={store.id} style={styles.storeTile} onPress={() => onPress(store)}>
            <View style={styles.storeLogoWrap}>
              <StoreLogo
                logoUrl={store.logoUrl}
                name={store.name}
                size={76}
                width={112}
                style={styles.brandMark}
                tintColor={colors.text}
              />
              {onNavigate ? (
                <Pressable
                  style={styles.navBtn}
                  onPress={(e) => {
                    e.stopPropagation();
                    onNavigate(store);
                  }}
                  hitSlop={8}
                  accessibilityLabel={`${store.name} ga yo'nalish`}
                >
                  <Icon name="location" size={14} color="#FFFFFF" />
                </Pressable>
              ) : null}
            </View>
            <Text style={styles.storeName} numberOfLines={1}>
              {store.name}
            </Text>
            <Text style={styles.storeMeta} numberOfLines={1}>
              {fmtDistance(store.distanceM)}
            </Text>
            <View style={styles.storePillWrap}>
              <StoreStatusPill isOpen={store.isOpen} compact />
            </View>
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
    // Belgilangan balandlik — ikkala tarafning markazi bir xil joyda bo'lsin
    // uchun eng ishonchli yo'l. Ichki qatorlar `alignItems: center` bilan shu
    // balandlik markaziga tekislanadi.
    height: 28,
    marginBottom: spacing.md,
    paddingTop: spacing.sm,
  },
  // Atelier bo'lim sarlavhasi: Fraunces display. Egasining talabi (2026-11-23):
  // h2 (22pt) juda katta — bo'lim nomi mahsulotdan muhimroq ko'rinardi. Endi
  // 17pt — ekran tartibida mahsulot kartochkasi bosh, sarlavha ikkinchi darajaga
  // tushadi. `includeFontPadding: false` Android'da yuqoridagi qo'shimcha
  // bo'shliqni olib tashlaydi — iOS'da ta'siri yo'q, lekin xavfsiz.
  headerTitle: {
    ...text.h2,
    color: colors.text,
    fontSize: 17,
    lineHeight: 22,
    includeFontPadding: false,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 28 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 28 },
  // "Barchasi" linki — italic serif, template "VIEW ALL →" dan farqli.
  // Sarlavha bilan bir xil lineHeight → bir xil lineBox, `alignItems: center`
  // ikki tarafni aniq vertikal markazga qo'yadi.
  actionText: {
    ...text.eyebrow,
    color: colors.primary,
    fontSize: 15,
    lineHeight: 22,
    includeFontPadding: false,
  },
  brandRow: { flexDirection: 'row', gap: 12 },
  brandTile: { alignItems: 'center', justifyContent: 'center' },
  storeTile: { alignItems: 'center', width: 112, gap: 4 },
  storeLogoWrap: { position: 'relative' },
  navBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#15131E',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  storeName: { ...text.small, color: colors.text, textAlign: 'center', maxWidth: 112 },
  storeMeta: { fontSize: 11, color: colors.textMuted, textAlign: 'center' },
  storePillWrap: { marginTop: 2 },
  // Atelier: kichikroq radius, chegara soch-ingichka (surface2 fonga mos)
  brandMark: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    shadowColor: '#15131E',
    shadowOpacity: 0.07,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
});
