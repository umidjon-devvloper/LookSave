import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getStoreDashboard, getStoreProfile } from '../../src/api/endpoints';
import { Icon, type IconName } from '../../src/components/Icon';
import { SignInRequired } from '../../src/components/SignInRequired';
import { StoreLogo } from '../../src/components/StoreLogo';
import { ErrorView, Loading } from '../../src/components/ui';
import { useI18n } from '../../src/i18n';
import { useAuthStore } from '../../src/store/authStore';
import { money } from '../../src/theme/format';
import { SELLER_TAB_BAR_SPACE } from '../../src/theme/sellerTabBar';
import { colors, radius, spacing, text } from '../../src/theme/tokens';

const REVENUE_BAG = require('../../assets/seller-dashboard-bag-v2.png');

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
        <Pressable
          style={({ pressed }) => [styles.applyBtnWrap, pressed && { opacity: 0.85 }]}
          onPress={() => router.push('/become-seller')}
        >
          <LinearGradient
            colors={['#B936F4', '#8B2CF5', '#6D28D9']}
            locations={[0, 0.55, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.applyBtn}
          >
            <Icon name="stores" size={18} color="#FFFFFF" />
            <Text style={styles.applyBtnText}>{t.sellerDashboard.applyNow}</Text>
            <Icon name="next" size={18} color="#FFFFFF" />
          </LinearGradient>
        </Pressable>
      </View>
    );
  }

  if (dashboard.isLoading || profile.isLoading) {
    // Loading paytida sahifa layout'i bilan mos fon — "bo'sh oq oraliq" chiqmaydi
    return (
      <View style={styles.flex}>
        <LinearGradient
          colors={['#F7F1FF', '#FFFFFF', '#F6F2FF']}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <Loading />
      </View>
    );
  }
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
    <View style={styles.flex}>
      <LinearGradient
        colors={['#F7F1FF', '#FFFFFF', '#F6F2FF']}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {/* Status bar ustidan to'liq fon — scroll ortga chiqmasin */}
      <View style={[styles.topSafe, { height: insets.top }]} />

      {/* Qotirilgan sarlavha */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.replace('/(tabs)/profile')}
          hitSlop={10}
          style={styles.backBtn}
          accessibilityRole="button"
        >
          <Icon name="back" size={20} color={colors.text} />
        </Pressable>
        <StoreLogo logoUrl={store?.logoUrl ?? null} name={store?.name ?? ''} size={48} />
        <View style={styles.headerText}>
          <Text style={styles.hello}>{t.sellerDashboard.hello}</Text>
          <Text style={styles.storeName} numberOfLines={1}>
            {store?.name ?? ''}
          </Text>
        </View>
        <Pressable style={styles.notificationBtn} onPress={() => router.push('/seller/orders')}>
          <Icon name="bell" size={22} color={colors.text} />
          {data.newOrders > 0 ? <View style={styles.notificationDot} /> : null}
        </Pressable>
      </View>

      <ScrollView
        style={styles.flex}
        /*
          Oxirgi amal tab bardan yuqoriga chiqa olsin. Ilgari 64 edi, bar esa
          100 joy oladi — «Do'kon sozlamalari» yarmi bilan bar ostida qolardi.
        */
        contentContainerStyle={[
          styles.content,
          { paddingBottom: SELLER_TAB_BAR_SPACE + spacing.lg },
        ]}
        showsVerticalScrollIndicator={false}
      >
      {/* Oylik tushum — asosiy karta */}
      <View style={styles.revenueCard}>
        <LinearGradient
          colors={['#7C3AED', '#4C2A9E', '#2E1A6B']}
          locations={[0, 0.6, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.revenueTextWrap}>
          <Text style={styles.revenueLabel}>{t.sellerDashboard.revenueThisMonth}</Text>
          <Text style={styles.revenueValue}>
            {money(data.revenueMonth, data.currency)}
          </Text>
          <View style={styles.revenueChip}>
            <Icon name="orders" size={12} color={colors.textOnPrimary} />
            <Text style={styles.revenueChipText}>
              {t.sellerDashboard.ordersThisMonth.replace('{n}', String(data.completedMonth))}
            </Text>
          </View>
        </View>
        <Image source={REVENUE_BAG} style={styles.revenueBag} resizeMode="contain" />
      </View>

      {/* 4 ta ko'rsatkich */}
      <View style={styles.tiles}>
        {TILES.map((tile) => (
          <Pressable
            key={tile.key}
            onPress={() =>
              router.push(tile.key === 'productCount' ? '/seller/products' : '/seller/orders')
            }
            style={[styles.tile, { borderColor: `${tile.tint}55`, backgroundColor: `${tile.tint}0C` }]}
          >
            <View style={styles.tileTop}>
              <View style={[styles.tileIco, { backgroundColor: `${tile.tint}22` }]}>
                <Icon name={tile.icon} size={18} color={tile.tint} />
              </View>
              <Text style={styles.tileValue}>{metrics[tile.key]}</Text>
            </View>
            <View style={styles.tileBottom}>
              <Text style={styles.tileLabel}>{t.sellerDashboard[tile.key]}</Text>
              <View style={[styles.tileArrow, { backgroundColor: `${tile.tint}18` }]}>
                <Icon name="next" size={16} color={tile.tint} />
              </View>
            </View>
          </Pressable>
        ))}
      </View>

      {/* Tez ishga tushadigan amallar */}
      <View style={styles.sectionRow}>
        <View style={styles.sectionTitleWrap}>
          <Icon name="limited" size={22} color={colors.primary} />
          <Text style={styles.section}>{t.sellerDashboard.quickActions}</Text>
        </View>
        {/* «Barchasi» olib tashlandi: u bosilmasdi — havolaga o'xshagan o'lik yozuv edi */}
      </View>
      <QuickAction
        icon="camera"
        title={t.sellerDashboard.addProduct}
        desc={t.sellerDashboard.addProductDesc}
        onPress={() => router.push('/seller/product-new')}
        primary
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
    </View>
  );
}

function QuickAction({
  icon,
  title,
  desc,
  onPress,
  badge,
  primary,
}: {
  icon: IconName;
  title: string;
  desc: string;
  onPress: () => void;
  badge?: number;
  primary?: boolean;
}): JSX.Element {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.action,
        primary && styles.actionPrimary,
        pressed && styles.actionPressed,
      ]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <View style={[styles.actionIco, primary && styles.actionIcoPrimary]}>
        <Icon name={icon} size={20} color={primary ? colors.textOnPrimary : colors.accent} />
      </View>
      <View style={styles.actionBody}>
        <Text style={[styles.actionTitle, primary && styles.actionTitlePrimary]}>{title}</Text>
        <Text
          style={[styles.actionDesc, primary && styles.actionDescPrimary]}
          numberOfLines={1}
        >
          {desc}
        </Text>
      </View>
      {badge !== undefined ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : (
        <Icon name="next" size={18} color={primary ? colors.textOnPrimary : colors.textMuted} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#F8F4FF' },
  content: { paddingHorizontal: spacing.md, paddingTop: spacing.md },

  topSafe: { backgroundColor: 'transparent' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: 'transparent',
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1, minWidth: 0 },
  hello: { ...text.small, color: colors.primary },
  storeName: { ...text.h2, color: colors.text, marginTop: -2 },
  notificationBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  notificationDot: {
    position: 'absolute',
    right: 8,
    top: 7,
    width: 8,
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.danger,
    borderWidth: 1.5,
    borderColor: colors.surface,
  },

  revenueCard: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    minHeight: 180,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 8,
  },
  revenueTextWrap: { flex: 1, zIndex: 2 },
  revenueLabel: {
    ...text.body,
    color: 'rgba(255,255,255,0.88)',
  },
  revenueValue: {
    fontSize: 40,
    fontWeight: '800',
    color: colors.textOnPrimary,
    marginTop: 8,
    marginBottom: 10,
    letterSpacing: -0.5,
  },
  revenueChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  revenueChipText: { ...text.small, color: colors.textOnPrimary, fontWeight: '600' },
  revenueBag: {
    position: 'absolute',
    width: 172,
    height: 172,
    right: -6,
    bottom: -6,
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
    minHeight: 116,
    padding: spacing.md,
    gap: spacing.sm,
  },
  // Yuqori qator — ikonka chapda, qiymat o'ngda, bir chiziqda.
  tileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tileIco: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileValue: { fontSize: 26, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  tileBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tileLabel: { ...text.small, color: colors.text, flex: 1 },
  tileArrow: {
    width: 28,
    height: 28,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },

  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  sectionTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  section: { ...text.h2, color: colors.text },

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
  // Birlamchi harakat (yangi mahsulot) — binafsha fon, ko'proq urg'u.
  actionPrimary: {
    backgroundColor: colors.primary,
    borderColor: 'rgba(139,92,246,0.45)',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 5,
  },
  actionPressed: { opacity: 0.7 },
  actionIco: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIcoPrimary: { backgroundColor: 'rgba(255,255,255,0.2)' },
  actionBody: { flex: 1, minWidth: 0 },
  actionTitle: { ...text.bodyMed, color: colors.text },
  actionTitlePrimary: { color: colors.textOnPrimary, fontFamily: text.h3.fontFamily },
  actionDesc: { ...text.tiny, color: colors.textMuted, marginTop: 2 },
  actionDescPrimary: { color: 'rgba(255,255,255,0.78)' },

  badge: {
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.danger,
  },
  badgeText: { ...text.tiny, color: colors.textOnPrimary, fontWeight: '800' },

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
  applyBtnWrap: {
    borderRadius: radius.pill,
    shadowColor: '#A855F7',
    shadowOpacity: 0.5,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  applyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  applyBtnText: { ...text.bodyMed, color: '#FFFFFF', fontWeight: '700' },
});
