import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getMyProducts, getStoreAnalytics, getStoreProfile } from '../../src/api/endpoints';
import { Icon } from '../../src/components/Icon';
import { SignInRequired } from '../../src/components/SignInRequired';
import { ErrorView, Loading } from '../../src/components/ui';
import { useI18n } from '../../src/i18n';
import { useAuthStore } from '../../src/store/authStore';
import { money } from '../../src/theme/format';
import { colors, radius, spacing, text } from '../../src/theme/tokens';
import { goBack } from '../../src/navigation/back';

const GROWTH_ART = require('../../assets/seller-analytics-growth-v1.png');
const SELLER_BAG = require('../../assets/seller-dashboard-bag-v2.png');

/**
 * Statistika — do'kon faoliyati asosiy ko'rsatkichlari.
 *
 * TZ 1-qism uchun minimal variant: davr tanlash (7/30/90 kun), 4 ta katta
 * raqam (ko'rishlar, kiyib ko'rishlar, buyurtmalar, konversiya),
 * eng ommabop 5 ta mahsulot. Grafik keyinroq alohida iteratsiyada.
 */

const PERIODS: ReadonlyArray<7 | 30 | 90> = [7, 30, 90];

export default function SellerAnalytics(): JSX.Element {
  const authStatus = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);
  const t = useI18n((state) => state.t);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const isSeller = user?.role === 'store_owner';

  const analytics = useQuery({
    queryKey: ['store', 'analytics', days],
    queryFn: () => getStoreAnalytics(days),
    enabled: authStatus === 'signedIn' && isSeller,
  });

  const profile = useQuery({
    queryKey: ['store', 'profile'],
    queryFn: getStoreProfile,
    enabled: authStatus === 'signedIn' && isSeller,
  });

  const products = useQuery({
    queryKey: ['store', 'products', 'all'],
    queryFn: () => getMyProducts('all'),
    enabled: authStatus === 'signedIn' && isSeller,
  });

  if (authStatus !== 'signedIn') return <SignInRequired />;
  if (!isSeller) {
    // Dashboard'ga yo'naltirmaymiz — foydalanuvchi tanlab bosgan; faqat
    // ariza taklifini ko'rsatamiz, bir xil UX bilan Dashboard'dagi kabi.
    return (
      <Pressable
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg }}
        onPress={() => router.push('/become-seller')}
      >
        <Icon name="shop" size={48} color={colors.accent} />
        <Text
          style={{
            ...text.body,
            color: colors.textMuted,
            textAlign: 'center',
            marginTop: spacing.md,
          }}
        >
          {t.sellerDashboard.notSellerTitle}
        </Text>
      </Pressable>
    );
  }
  if (analytics.isLoading) return <Loading />;
  if (analytics.isError) {
    return <ErrorView error={analytics.error} onRetry={() => void analytics.refetch()} />;
  }

  const data = analytics.data!;
  const currency = profile.data?.currency ?? 'UZS';
  const productImages = new Map(products.data?.items.map((item) => [item.id, item.image]) ?? []);

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + spacing.sm, paddingBottom: 126 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.topbar}>
        <Pressable style={styles.roundButton} onPress={() => goBack('/seller')}>
          <Icon name="back" size={25} color={colors.text} />
        </Pressable>
        <Text style={styles.wordmark} numberOfLines={1}>
          LOOK<Text style={styles.wordmarkAccent}>SAVE</Text>
          <Text style={styles.wordmarkSeller}> · SELLER</Text>
        </Text>
        <Pressable style={styles.roundButton}>
          <Icon name="bell" size={24} color={colors.text} />
          <View style={styles.notificationDot} />
        </Pressable>
      </View>

      <View style={styles.hero}>
        <View style={styles.heroCopy}>
          <Text style={styles.title}>{t.sellerAnalytics.title}</Text>
          <Text style={styles.subtitle}>Do‘kon faoliyati bo‘yicha tahlil</Text>
        </View>
        <Image source={GROWTH_ART} style={styles.growthArt} resizeMode="contain" />
      </View>

      {/* Davr tanlash */}
      <View style={styles.pills}>
        {PERIODS.map((p) => (
          <Pressable
            key={p}
            style={[styles.pill, days === p && styles.pillOn]}
            onPress={() => setDays(p)}
          >
            <Text style={[styles.pillText, days === p && styles.pillTextOn]}>
              {t.sellerAnalytics.days.replace('{n}', String(p))}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Tushum katta */}
      <LinearGradient
        colors={['#B83AF2', '#6B19DD', '#321278']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.revenueCard}
      >
        <View style={styles.revenueCopy}>
          <View style={styles.revenueHeading}>
            <Icon name="orders" size={18} color="#E9D8FF" />
            <Text style={styles.revenueLabel}>{t.sellerAnalytics.revenue}</Text>
          </View>
          <Text style={styles.revenueValue}>{money(data.totals.revenue, currency)}</Text>
          <Text style={styles.revenueHint}>
            {t.sellerAnalytics.completedOrders.replace('{n}', String(data.totals.completed))}
          </Text>
        </View>
        <Image source={SELLER_BAG} style={styles.revenueBag} resizeMode="contain" />
        <View style={styles.revenueWave} />
      </LinearGradient>

      {/* 4 ta raqam */}
      <View style={styles.grid}>
        <StatTile
          icon="eye"
          label={t.sellerAnalytics.views}
          value={data.totals.views}
          badge="↑ +100%"
          positive
        />
        <StatTile
          icon="logo"
          label={t.sellerAnalytics.tryons}
          value={data.totals.tryons}
          badge="0%"
        />
        <StatTile
          icon="bag"
          label={t.sellerAnalytics.orders}
          value={data.totals.orders}
          badge="0%"
        />
        <StatTile
          icon="premium"
          label={t.sellerAnalytics.conversion}
          value={data.totals.conversion === null ? '—' : `${data.totals.conversion}%`}
          hint={t.sellerAnalytics.conversionHint}
        />
      </View>

      {/* Eng ommabop mahsulotlar */}
      <View style={styles.sectionHead}>
        <View style={styles.sectionTitleRow}>
          <Icon name="limited" size={24} color={colors.accent} />
          <Text style={styles.section}>{t.sellerAnalytics.topProducts} mahsulotlar</Text>
        </View>
        <Text style={styles.viewAll}>Barchasi ›</Text>
      </View>
      {data.topProducts.length === 0 ? (
        <Text style={styles.emptyText}>{t.sellerAnalytics.topEmpty}</Text>
      ) : (
        data.topProducts.slice(0, 5).map((p, index) => (
          <View key={p.id} style={styles.row}>
            <View style={styles.rank}>
              <Text style={styles.rankText}>{index + 1}</Text>
            </View>
            {productImages.get(p.id) ? (
              <Image
                source={{ uri: productImages.get(p.id)! }}
                style={styles.productImage}
                resizeMode="contain"
              />
            ) : (
              <View style={[styles.productImage, styles.productPlaceholder]}>
                <Icon name="slotTop" size={24} color={colors.primary} />
              </View>
            )}
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {p.title}
              </Text>
              <Text style={styles.rowMeta}>
                {t.sellerAnalytics.rowMeta
                  .replace('{tryons}', String(p.tryons))
                  .replace('{orders}', String(p.orders))
                  .replace('{conv}', p.conversion === null ? '—' : `${p.conversion}%`)}
              </Text>
            </View>
            <Icon name="next" size={16} color={colors.textMuted} />
          </View>
        ))
      )}
    </ScrollView>
  );
}

function StatTile({
  icon,
  label,
  value,
  hint,
  badge,
  positive,
}: {
  icon: 'eye' | 'logo' | 'bag' | 'premium';
  label: string;
  value: string | number;
  hint?: string;
  badge?: string;
  positive?: boolean;
}): JSX.Element {
  return (
    <View style={styles.tile}>
      <View style={styles.tileIcon}>
        <Icon name={icon} size={23} color={colors.accent} />
      </View>
      <View style={styles.tileBody}>
        <Text style={styles.tileValue}>{value}</Text>
        <Text style={styles.tileLabel}>{label}</Text>
        {hint ? <Text style={styles.tileHint}>{hint}</Text> : null}
      </View>
      {badge ? (
        <Text style={[styles.tileBadge, positive && styles.tileBadgePositive]}>{badge}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#FAF8FF' },
  content: { paddingHorizontal: spacing.md },
  topbar: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  roundButton: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderWidth: 1,
    borderColor: '#E8DFF7',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6D28D9',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  wordmark: {
    ...text.bodyMed,
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.4,
    flexShrink: 1,
  },
  wordmarkAccent: { color: colors.accent },
  wordmarkSeller: { color: colors.textMuted, fontWeight: '600' },
  notificationDot: {
    position: 'absolute',
    right: 3,
    top: 2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  hero: { height: 158, justifyContent: 'center', overflow: 'visible' },
  heroCopy: { zIndex: 2, maxWidth: '65%' },
  title: { ...text.h1, color: colors.text, fontSize: 34, lineHeight: 40 },
  subtitle: { ...text.body, color: colors.textMuted, marginTop: 5, fontSize: 16 },
  growthArt: { position: 'absolute', width: 175, height: 175, right: -10, top: -4 },

  pills: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  pill: {
    minWidth: 86,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6D28D9',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
  },
  pillOn: { backgroundColor: colors.primaryDim },
  pillText: { ...text.bodyMed, color: colors.textMuted, fontWeight: '600' },
  pillTextOn: { color: colors.textOnPrimary },

  revenueCard: {
    height: 190,
    borderRadius: radius.xxl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    overflow: 'hidden',
    shadowColor: colors.primary,
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  revenueCopy: { zIndex: 3 },
  revenueHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  revenueLabel: {
    ...text.h3,
    color: colors.textOnPrimary,
  },
  revenueValue: {
    fontSize: 38,
    fontWeight: '800',
    color: colors.textOnPrimary,
    marginTop: 12,
    marginBottom: 8,
  },
  revenueHint: { ...text.small, color: '#F0E6FF' },
  revenueBag: { position: 'absolute', width: 154, height: 154, right: 6, top: 16, zIndex: 2 },
  revenueWave: {
    position: 'absolute',
    width: 330,
    height: 120,
    borderRadius: radius.pill,
    right: -86,
    bottom: -72,
    backgroundColor: 'rgba(183,106,255,0.45)',
    transform: [{ rotate: '-14deg' }],
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: spacing.xl,
  },
  tile: {
    flexBasis: '48%',
    flexGrow: 1,
    minHeight: 112,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: '#ECE3FA',
    borderRadius: radius.xl,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    shadowColor: '#6D28D9',
    shadowOpacity: 0.11,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  tileIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: '#F1E7FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileBody: { flex: 1, minWidth: 0 },
  tileValue: { fontSize: 24, lineHeight: 28, fontWeight: '800', color: colors.text },
  tileLabel: { ...text.small, color: colors.textMuted },
  tileHint: { ...text.tiny, color: colors.textDim, marginTop: 4, fontStyle: 'italic' },
  tileBadge: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    ...text.tiny,
    color: colors.textMuted,
    backgroundColor: '#F0ECF8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  tileBadgePositive: { color: colors.success, backgroundColor: '#DDF8EC' },

  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  section: {
    ...text.h3,
    color: colors.text,
    fontSize: 18,
  },
  viewAll: { ...text.small, color: colors.textMuted, fontWeight: '600' },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: '#EEE7F8',
    borderRadius: radius.xl,
    padding: 12,
    marginBottom: spacing.sm,
    minHeight: 76,
    shadowColor: '#6D28D9',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  rank: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: { ...text.bodyMed, color: colors.accent, fontWeight: '800' },
  productImage: {
    width: 58,
    height: 58,
    borderRadius: radius.md,
    backgroundColor: colors.surface2,
  },
  productPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1, minWidth: 0 },
  rowTitle: { ...text.bodyMed, color: colors.text, fontWeight: '700' },
  rowMeta: { ...text.tiny, color: colors.textMuted, marginTop: 2 },

  emptyText: {
    ...text.small,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
});
