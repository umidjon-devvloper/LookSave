import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getStoreDashboard, getStoreProfile } from '../../src/api/endpoints';
import { Icon, type IconName } from '../../src/components/Icon';
import { SignInRequired } from '../../src/components/SignInRequired';
import { StoreLogo } from '../../src/components/StoreLogo';
import { ErrorView, Loading } from '../../src/components/ui';
import { useI18n } from '../../src/i18n';
import { useAuthStore } from '../../src/store/authStore';
import { money } from '../../src/theme/format';
import { colors, radius, spacing, text } from '../../src/theme/tokens';

/**
 * Sotuvchi paneli — bosh ekran (Dashboard).
 *
 * Ilgari bu ekran buyurtmalar ro'yxatini ko'rsatardi, u endi "Buyurtmalar"
 * tabida yashaydi. Hozirgi vazifa — sotuvchiga do'kon holatini bir qarashda
 * ko'rsatish: tushum, kutilayotgan buyurtmalar, mahsulot soni va tez
 * ishga tushadigan tugmalar (yangi mahsulot, sozlamalar).
 */

interface MetricTile {
  key: 'newOrders' | 'inProgress' | 'completedMonth' | 'productCount';
  icon: IconName;
  tint: string;
}

const TILES: ReadonlyArray<MetricTile> = [
  { key: 'newOrders', icon: 'bell', tint: '#fbbf24' },
  { key: 'inProgress', icon: 'clock', tint: '#22d3ee' },
  { key: 'completedMonth', icon: 'check', tint: '#4ade80' },
  { key: 'productCount', icon: 'shop', tint: '#a855f7' },
];

export default function SellerDashboard(): JSX.Element {
  const authStatus = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);
  const t = useI18n((state) => state.t);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Faqat store_owner uchun — xaridor rolidagilarga ariza taklifi.
  const isSeller = user?.role === 'store_owner';

  const dashboard = useQuery({
    queryKey: ['store', 'dashboard'],
    queryFn: getStoreDashboard,
    enabled: authStatus === 'signedIn' && isSeller,
  });

  const profile = useQuery({
    queryKey: ['store', 'profile'],
    queryFn: getStoreProfile,
    enabled: authStatus === 'signedIn' && isSeller,
  });

  if (authStatus !== 'signedIn') return <SignInRequired />;

  if (!isSeller) {
    return (
      <View style={[styles.applyWrap, { paddingTop: insets.top + spacing.xl * 2 }]}>
        <View style={styles.applyIco}>
          <Icon name="shop" size={48} color={colors.accent} />
        </View>
        <Text style={styles.applyTitle}>{t.sellerDashboard.notSellerTitle}</Text>
        <Text style={styles.applyDesc}>{t.sellerDashboard.notSellerDesc}</Text>
        <Pressable style={styles.applyBtn} onPress={() => router.push('/seller/apply')}>
          <Text style={styles.applyBtnText}>{t.sellerDashboard.applyNow}</Text>
        </Pressable>
      </View>
    );
  }

  if (dashboard.isLoading || profile.isLoading) return <Loading />;
  if (dashboard.isError) {
    return <ErrorView error={dashboard.error} onRetry={() => void dashboard.refetch()} />;
  }

  const data = dashboard.data!;
  const store = profile.data;
  const metrics: Record<MetricTile['key'], string | number> = {
    newOrders: data.newOrders,
    inProgress: data.inProgress,
    completedMonth: data.completedMonth,
    productCount: data.productCount,
  };

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + spacing.md, paddingBottom: spacing.xl * 2 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Salom + do'kon */}
      <View style={styles.header}>
        <StoreLogo logoUrl={store?.logoUrl ?? null} name={store?.name ?? ''} size={56} />
        <View style={styles.headerText}>
          <Text style={styles.hello}>{t.sellerDashboard.hello}</Text>
          <Text style={styles.storeName} numberOfLines={1}>
            {store?.name ?? ''}
          </Text>
        </View>
        <View style={[styles.statusDot, { backgroundColor: store?.isOpen ? colors.success : colors.textMuted }]} />
      </View>

      {/* Oylik tushum — asosiy karta */}
      <View style={styles.revenueCard}>
        <LinearGradient
          colors={[colors.primary, colors.primaryDim]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.revenueTextWrap}>
          <Text style={styles.revenueLabel}>{t.sellerDashboard.revenueThisMonth}</Text>
          <Text style={styles.revenueValue}>
            {money(data.revenueMonth, data.currency)}
          </Text>
          <Text style={styles.revenueHint}>
            {t.sellerDashboard.ordersThisMonth.replace('{n}', String(data.completedMonth))}
          </Text>
        </View>
        <View style={styles.revenueIco}>
          <Icon name="premium" size={32} color={colors.text} />
        </View>
      </View>

      {/* 4 ta ko'rsatkich */}
      <View style={styles.tiles}>
        {TILES.map((tile) => (
          <View key={tile.key} style={styles.tile}>
            <View style={[styles.tileIco, { backgroundColor: `${tile.tint}22` }]}>
              <Icon name={tile.icon} size={18} color={tile.tint} />
            </View>
            <Text style={styles.tileValue}>{metrics[tile.key]}</Text>
            <Text style={styles.tileLabel}>{t.sellerDashboard[tile.key]}</Text>
          </View>
        ))}
      </View>

      {/* Tez ishga tushadigan amallar */}
      <Text style={styles.section}>{t.sellerDashboard.quickActions}</Text>
      <QuickAction
        icon="camera"
        title={t.sellerDashboard.addProduct}
        desc={t.sellerDashboard.addProductDesc}
        onPress={() => router.push('/seller/product-new')}
      />
      <QuickAction
        icon="orders"
        title={t.sellerDashboard.viewOrders}
        desc={
          data.newOrders > 0
            ? t.sellerDashboard.viewOrdersDesc.replace('{n}', String(data.newOrders))
            : t.sellerDashboard.viewOrdersEmpty
        }
        onPress={() => router.push('/seller/orders')}
        badge={data.newOrders > 0 ? data.newOrders : undefined}
      />
      <QuickAction
        icon="settings"
        title={t.sellerDashboard.editStore}
        desc={t.sellerDashboard.editStoreDesc}
        onPress={() => router.push('/seller/settings')}
      />
    </ScrollView>
  );
}

function QuickAction({
  icon,
  title,
  desc,
  onPress,
  badge,
}: {
  icon: IconName;
  title: string;
  desc: string;
  onPress: () => void;
  badge?: number;
}): JSX.Element {
  return (
    <Pressable
      style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <View style={styles.actionIco}>
        <Icon name={icon} size={20} color={colors.accent} />
      </View>
      <View style={styles.actionBody}>
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.actionDesc} numberOfLines={1}>
          {desc}
        </Text>
      </View>
      {badge !== undefined ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : (
        <Icon name="next" size={18} color={colors.textMuted} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.md },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  headerText: { flex: 1, minWidth: 0 },
  hello: { ...text.tiny, color: colors.textMuted, letterSpacing: 1 },
  storeName: { ...text.h3, color: colors.text, marginTop: 2 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },

  revenueCard: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    minHeight: 120,
  },
  revenueTextWrap: { flex: 1 },
  revenueLabel: {
    ...text.tiny,
    color: 'rgba(255,255,255,0.75)',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  revenueValue: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    marginTop: 6,
    marginBottom: 4,
  },
  revenueHint: { ...text.small, color: 'rgba(255,255,255,0.85)' },
  revenueIco: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  tiles: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  tile: {
    flexBasis: '48%',
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 4,
  },
  tileIco: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  tileValue: { fontSize: 22, fontWeight: '800', color: colors.text },
  tileLabel: { ...text.tiny, color: colors.textMuted },

  section: {
    ...text.tiny,
    color: colors.textDim,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontWeight: '700',
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },

  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  actionPressed: { opacity: 0.7 },
  actionIco: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBody: { flex: 1, minWidth: 0 },
  actionTitle: { ...text.bodyMed, color: colors.text },
  actionDesc: { ...text.tiny, color: colors.textMuted, marginTop: 2 },

  badge: {
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.danger,
  },
  badgeText: { ...text.tiny, color: colors.text, fontWeight: '800' },

  applyWrap: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.bg,
  },
  applyIco: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  applyTitle: {
    ...text.h2,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  applyDesc: {
    ...text.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.xl,
    maxWidth: 320,
  },
  applyBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  applyBtnText: { ...text.bodyMed, color: colors.text, fontWeight: '700' },
});
