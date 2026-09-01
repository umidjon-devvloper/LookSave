import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { getOrders } from '../src/api/endpoints';
import { Empty, ErrorView, Screen } from '../src/components/ui';
import { Icon } from '../src/components/Icon';
import { SignInRequired } from '../src/components/SignInRequired';
import { SkeletonList } from '../src/components/Skeleton';
import { useI18n } from '../src/i18n';
import { useAuthStore } from '../src/store/authStore';
import { money } from '../src/theme/format';
import { statusTone } from '../src/theme/orderStatus';
import { colors, radius, spacing, text } from '../src/theme/tokens';
import { goBack } from '../src/navigation/back';

const TABS = ['active', 'completed', 'cancelled'] as const;

type Tab = (typeof TABS)[number];

export default function Orders(): JSX.Element {
  const router = useRouter();
  const t = useI18n((state) => state.t);
  const [tab, setTab] = useState<Tab>('active');
  const insets = useSafeAreaInsets();

  /*
   * ⚠️ QOROVUL BARCHA HOOKLARDAN KEYIN QAYTARADI, lekin holat SHU YERDA
   * o'qiladi: erta `return` hooklar tartibini buzadi va React qulaydi.
   */
  const signedIn = useAuthStore((state) => state.status) === 'signedIn';

  const orders = useQuery({
    queryKey: ['orders', 'list', tab],
    queryFn: () => getOrders(tab),
    enabled: signedIn,
  });

  // Kirmagan foydalanuvchiga xato emas, sabab ko'rsatiladi
  if (!signedIn) {
    return (
      <Screen>
        <SignInRequired />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.order.myOrders}
          onPress={() => goBack('/profile')}
          style={styles.roundButton}
        >
          <Icon name="back" size={20} color={colors.accent} />
        </Pressable>
        <Text style={styles.topTitle}>{t.order.myOrders}</Text>
        {/* Sarlavhani markazda ushlaydigan ko'rinmas muvozanat */}
        <View style={styles.roundButtonGhost} />
      </View>

      <View style={styles.tabs}>
        {TABS.map((item) => (
          <Pressable
            key={item}
            accessibilityRole="button"
            accessibilityState={{ selected: tab === item }}
            onPress={() => setTab(item)}
            style={styles.tabWrap}
          >
            {tab === item ? (
              <LinearGradient
                colors={[colors.accent, colors.primary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.tab}
              >
                <Text style={[styles.tabText, { color: colors.text }]}>{t.order[item]}</Text>
              </LinearGradient>
            ) : (
              <View style={[styles.tab, styles.tabIdle]}>
                <Text style={styles.tabText}>{t.order[item]}</Text>
              </View>
            )}
          </Pressable>
        ))}
      </View>

      {orders.isLoading ? <SkeletonList count={4} /> : null}
      {orders.isError ? (
        <ErrorView error={orders.error} onRetry={() => void orders.refetch()} />
      ) : null}

      {orders.data ? (
        <FlatList
          data={orders.data.items}
          keyExtractor={(order) => order.id}
          contentContainerStyle={styles.list}
          refreshing={orders.isFetching}
          onRefresh={() => void orders.refetch()}
          renderItem={({ item }) => {
            const tone = statusTone(item.status);
            return (
              <Pressable style={styles.card} onPress={() => router.push(`/order/${item.id}`)}>
                {/*
                  Mahsulot surati — ilgari karta faqat matn edi va
                  ro'yxatda buyurtmalar bir-biridan ajralmasdi.
                */}
                {item.preview.image ? (
                  <Image
                    source={{ uri: item.preview.image }}
                    style={styles.thumb}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={[styles.thumb, styles.thumbEmpty]}>
                    <Icon name="orders" size={22} color={colors.textDim} />
                  </View>
                )}

                <View style={styles.cardBody}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.number}>{item.orderNumber}</Text>
                    {/*
                      Holat CHIP sifatida, rangi holatga bog'liq: kutish
                      sariq, muvaffaqiyat yashil, rad qizil. Oddiy matn
                      ro'yxatda ko'zga tashlanmasdi.
                    */}
                    <View style={[styles.statusChip, { borderColor: tone }]}>
                      <Text style={[styles.statusText, { color: tone }]}>{item.statusLabel}</Text>
                    </View>
                  </View>

                  <Text style={styles.store} numberOfLines={1}>
                    {item.store.name}
                  </Text>
                  <Text style={styles.preview} numberOfLines={1}>
                    {item.preview.title ?? 'Mahsulot'}
                    {item.itemCount > 1 ? ` va yana ${item.itemCount - 1} ta` : ''}
                  </Text>

                  <View style={styles.cardFoot}>
                    <Text style={styles.total}>{money(item.total, item.currency)}</Text>
                    <Icon name="next" size={18} color={colors.textDim} />
                  </View>
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <Empty
              title={t.order.emptyActive}
              hint={tab === 'active' ? t.order.emptyHint : undefined}
            />
          }
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.md,
  },
  topTitle: { ...text.h3, color: colors.text, flex: 1, textAlign: 'center' },
  roundButton: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderAccent,
    backgroundColor: colors.surface,
  },
  roundButtonGhost: { width: 44, height: 44 },

  tabs: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md },
  tabWrap: { flex: 1 },
  tab: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.pill,
    alignItems: 'center',
  },
  // Faol tab gradient bilan chiziladi, bu esa tanlanmagani
  tabIdle: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  tabText: { ...text.small, color: colors.textMuted, fontWeight: '600' },

  list: { padding: spacing.md, gap: spacing.sm },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm + 2,
  },
  thumb: { width: 74, height: 88, borderRadius: radius.md, backgroundColor: colors.surface2 },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  cardBody: { flex: 1, gap: 2 },
  cardFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },

  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  number: { ...text.bodyMed, color: colors.text, fontWeight: '700', flexShrink: 1 },
  statusChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  statusText: { ...text.tiny, fontWeight: '700' },
  store: { ...text.small, color: colors.textMuted },
  preview: { ...text.tiny, color: colors.textDim },
  total: { ...text.bodyMed, color: colors.accent, fontWeight: '700' },
});
