import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getStoreAnalytics, getStoreProfile, type StoreAnalytics } from '../../src/api/endpoints';
import { Icon } from '../../src/components/Icon';
import { SignInRequired } from '../../src/components/SignInRequired';
import { ErrorView, Loading } from '../../src/components/ui';
import { useI18n } from '../../src/i18n';
import { useAuthStore } from '../../src/store/authStore';
import { money } from '../../src/theme/format';
import { colors, radius, spacing, text } from '../../src/theme/tokens';

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

  if (authStatus !== 'signedIn') return <SignInRequired />;
  if (!isSeller) {
    // Dashboard'ga yo'naltirmaymiz — foydalanuvchi tanlab bosgan; faqat
    // ariza taklifini ko'rsatamiz, bir xil UX bilan Dashboard'dagi kabi.
    return (
      <Pressable
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg }}
        onPress={() => router.push('/seller/apply')}
      >
        <Icon name="shop" size={48} color={colors.accent} />
        <Text style={{ ...text.body, color: colors.textMuted, textAlign: 'center', marginTop: spacing.md }}>
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

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + spacing.md, paddingBottom: spacing.xl * 2 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>{t.sellerAnalytics.title}</Text>

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
      <View style={styles.revenueCard}>
        <Text style={styles.revenueLabel}>{t.sellerAnalytics.revenue}</Text>
        <Text style={styles.revenueValue}>{money(data.totals.revenue, currency)}</Text>
        <Text style={styles.revenueHint}>
          {t.sellerAnalytics.completedOrders.replace('{n}', String(data.totals.completed))}
        </Text>
      </View>

      {/* 4 ta raqam */}
      <View style={styles.grid}>
        <StatTile label={t.sellerAnalytics.views} value={data.totals.views} />
        <StatTile label={t.sellerAnalytics.tryons} value={data.totals.tryons} />
        <StatTile label={t.sellerAnalytics.orders} value={data.totals.orders} />
        <StatTile
          label={t.sellerAnalytics.conversion}
          value={data.totals.conversion === null ? '—' : `${data.totals.conversion}%`}
          hint={t.sellerAnalytics.conversionHint}
        />
      </View>

      {/* Eng ommabop mahsulotlar */}
      <Text style={styles.section}>{t.sellerAnalytics.topProducts}</Text>
      {data.topProducts.length === 0 ? (
        <Text style={styles.emptyText}>{t.sellerAnalytics.topEmpty}</Text>
      ) : (
        data.topProducts.slice(0, 5).map((p, index) => (
          <View key={p.id} style={styles.row}>
            <View style={styles.rank}>
              <Text style={styles.rankText}>{index + 1}</Text>
            </View>
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
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}): JSX.Element {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileValue}>{value}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
      {hint ? <Text style={styles.tileHint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.md },

  title: { ...text.h2, color: colors.text, marginBottom: spacing.md },

  pills: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  pillText: { ...text.small, color: colors.textMuted, fontWeight: '600' },
  pillTextOn: { color: colors.text },

  revenueCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  revenueLabel: {
    ...text.tiny,
    color: colors.textMuted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  revenueValue: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.text,
    marginTop: 6,
    marginBottom: 4,
  },
  revenueHint: { ...text.small, color: colors.textDim },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  tile: {
    flexBasis: '48%',
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  tileValue: { fontSize: 22, fontWeight: '800', color: colors.text },
  tileLabel: { ...text.tiny, color: colors.textMuted, marginTop: 2 },
  tileHint: { ...text.tiny, color: colors.textDim, marginTop: 4, fontStyle: 'italic' },

  section: {
    ...text.tiny,
    color: colors.textDim,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontWeight: '700',
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.xs,
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
  rowBody: { flex: 1, minWidth: 0 },
  rowTitle: { ...text.bodyMed, color: colors.text },
  rowMeta: { ...text.tiny, color: colors.textMuted, marginTop: 2 },

  emptyText: { ...text.small, color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.lg },
});
