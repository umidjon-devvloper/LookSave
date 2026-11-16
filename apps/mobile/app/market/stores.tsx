import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getNearbyStores, type NearbyStore } from '../../src/api/endpoints';
import { Icon } from '../../src/components/Icon';
import { SkeletonList } from '../../src/components/Skeleton';
import { StoreLogo } from '../../src/components/StoreLogo';
import { Empty, ErrorView, Screen } from '../../src/components/ui';
import { useLocationStore } from '../../src/store/locationStore';
import { colors, radius, spacing, text } from '../../src/theme/tokens';
import { goBack } from '../../src/navigation/back';

/**
 * Do'konlar — Market → Erkaklar/Ayollar bosilganda ochiladi.
 *
 * ⚠️ AVVAL DO'KON, KEYIN MAHSULOT. Ilgari bu bosishlar to'g'ridan-to'g'ri
 * aralash mahsulot gridiga olib borardi. Endi ichma-ich: do'kon → do'kon
 * kategoriyalari → o'sha kategoriya mahsulotlari. Jins keyingi ekranlarga
 * uzatiladi va mahsulot darajasida filtrlanadi.
 */

function StoreCard({ store, onPress }: { store: NearbyStore; onPress: () => void }): JSX.Element {
  const km = store.distanceM >= 0 ? (store.distanceM / 1000).toFixed(1) : null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={store.name}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <LinearGradient
        colors={['rgba(124,92,255,0.10)', 'rgba(10,10,15,0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <StoreLogo logoUrl={store.logoUrl} name={store.name} size={52} />

      <View style={styles.cardText}>
        <Text style={styles.storeName} numberOfLines={1}>
          {store.name}
        </Text>
        <Text style={styles.storeMeta} numberOfLines={1}>
          {store.productCount} ta mahsulot
          {km ? ` · ${km} km` : ''}
          {store.isOpen ? '' : ' · yopiq'}
        </Text>
      </View>

      <View style={styles.chevron}>
        <Icon name="next" size={18} color={colors.text} />
      </View>
    </Pressable>
  );
}

export default function MarketStores(): JSX.Element {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { coords } = useLocationStore();
  const params = useLocalSearchParams<{ gender?: string }>();
  /*
   * ⚠️ JINS IXTIYORIY. Market'dagi «Erkaklar»/«Ayollar» kartalari jinsni
   * uzatadi; bosh sahifadagi «Hammasi» (STORES → View all) esa uzatmaydi —
   * o'shanda BARCHA do'kon ko'rinishi kerak. Ilgari standart `'male'` edi,
   * shuning uchun «Hammasi» bosilganda ham «Erkaklar do'konlari» chiqardi.
   */
  const gender =
    params.gender === 'female' ? 'female' : params.gender === 'male' ? 'male' : null;
  // Do'kon jinsi serverdagi `audience` bilan ('men'/'women'); `both` do'kon
  // ikkala bo'limda ham chiqadi. Jins berilmasa — filtr yo'q, hammasi chiqadi.
  const audience = gender === 'female' ? 'women' : gender === 'male' ? 'men' : undefined;
  const title =
    gender === 'female'
      ? 'Ayollar do`konlari'
      : gender === 'male'
        ? 'Erkaklar do`konlari'
        : 'Barcha do`konlar';

  const stores = useQuery({
    queryKey: ['market', 'stores', audience ?? 'all', coords.lat, coords.lng],
    queryFn: () =>
      getNearbyStores(coords.lat, coords.lng, {
        radius: 50_000,
        ...(audience ? { audience } : {}),
      }),
  });

  return (
    <Screen>
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Orqaga"
          hitSlop={10}
          onPress={() => goBack('/marketplace')}
          style={styles.roundButton}
        >
          <Icon name="back" size={20} color={colors.text} />
        </Pressable>
        <View style={styles.titleWrap}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.subtitle}>DO`KONNI TANLANG</Text>
        </View>
        <View style={styles.roundButton} />
      </View>

      {stores.isLoading ? (
        <View style={styles.list}>
          <SkeletonList count={5} />
        </View>
      ) : stores.isError ? (
        <ErrorView error={stores.error} onRetry={() => void stores.refetch()} />
      ) : (stores.data ?? []).length === 0 ? (
        <Empty
          icon="stores"
          title="Do`kon topilmadi"
          hint="Yaqin atrofda hozircha do`kon yo`q."
        />
      ) : (
        <FlatList
          data={stores.data ?? []}
          keyExtractor={(store) => store.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <StoreCard
              store={item}
              onPress={() =>
                router.push(
                  `/market/store?storeId=${item.id}${
                    gender ? `&gender=${gender}` : ''
                  }&name=${encodeURIComponent(item.name)}`,
                )
              }
            />
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  roundButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  titleWrap: { flex: 1, alignItems: 'center' },
  title: { ...text.h3, color: colors.text },
  subtitle: { ...text.tiny, color: colors.accent, letterSpacing: 2, marginTop: 1 },

  list: { padding: spacing.md, gap: spacing.md },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    height: 84,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  cardPressed: { borderColor: colors.accent },
  cardText: { flex: 1 },
  storeName: { ...text.bodyMed, color: colors.text },
  storeMeta: { ...text.small, color: colors.textMuted, marginTop: 2 },
  chevron: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
