import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getStore } from '../../src/api/endpoints';
import { Icon, type IconName } from '../../src/components/Icon';
import { SkeletonList } from '../../src/components/Skeleton';
import { Empty, ErrorView, Screen } from '../../src/components/ui';
import { useI18n } from '../../src/i18n';
import { colors, radius, spacing, text } from '../../src/theme/tokens';
import { goBack } from '../../src/navigation/back';

/**
 * Do'kon kategoriyalari — do'kon bosilganda ochiladi.
 *
 * `getStore` do'konning kategoriyalarini sanoq bilan beradi. Har biriga
 * bosilsa o'sha kategoriya mahsulotlari (`collection`) jins bo'yicha filtrlab
 * ochiladi.
 */

/**
 * Kategoriya NOMIGA mos ikonka — nom yoki slug ичидаги kalit so'zга qarab.
 * Tartib muhim: aniqroq kalitlar (oyoq kiyim, ko'zoynak) umumiy «kiyim»dan
 * oldin tekshiriladi.
 */
const ICON_RULES: Array<{ match: RegExp; icon: IconName }> = [
  { match: /sneaker|shoe|sandal|boot|trainer|krossovka|oyoq|feet|footwear|loafer/, icon: 'slotFeet' },
  { match: /watch|soat|clock/, icon: 'clock' },
  // `cart` nomi ShoppingBag glifini beradi (Icon.tsx da nomlar teskari),
  // shuning uchun sumka uchun `cart` — haqiqiy sumka shakli.
  { match: /bag|backpack|sumka|rюкзак|ryukzak|clutch/, icon: 'cart' },
  { match: /glass|eyewear|sunglass|ko.?zoynak|optic/, icon: 'eye' },
  { match: /dress|ko.?ylak|ko.?ylagi|skirt|yubka/, icon: 'dress' },
  { match: /trouser|pant|jean|short|shim|bottom|chino|cargo/, icon: 'slotBottom' },
  { match: /jacket|coat|hoodie|xudi|kurtka|outer|palto|windbreaker|bomber/, icon: 'slotOuter' },
  { match: /shirt|tee|t-?shirt|top|futbolka|ko.?ylak|polo|sweater|jumper/, icon: 'slotTop' },
];

function iconFor(slug: string, name: string): IconName {
  const hay = `${slug} ${name}`.toLowerCase();
  for (const rule of ICON_RULES) {
    if (rule.match.test(hay)) return rule.icon;
  }
  return 'slotTop';
}

export default function MarketStore(): JSX.Element {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ storeId?: string; gender?: string; name?: string }>();
  const storeId = params.storeId ?? '';
  const gender = params.gender === 'female' ? 'female' : 'male';
  const t = useI18n((state) => state.t);
  const storeName = params.name ?? t.stores.storeFallback;

  const store = useQuery({
    queryKey: ['store', 'detail', storeId],
    queryFn: () => getStore(storeId),
    enabled: Boolean(storeId),
  });

  const categories = store.data?.categories ?? [];

  return (
    <Screen>
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.common.back}
          hitSlop={10}
          onPress={() => goBack('/market/stores')}
          style={styles.roundButton}
        >
          <Icon name="back" size={20} color={colors.text} />
        </Pressable>
        <View style={styles.titleWrap}>
          <Text style={styles.title} numberOfLines={1}>
            {store.data?.name ?? storeName}
          </Text>
          <Text style={styles.subtitle}>{t.stores.pickCategory}</Text>
        </View>
        <View style={styles.roundButton} />
      </View>

      {store.isLoading ? (
        <View style={styles.list}>
          <SkeletonList count={5} />
        </View>
      ) : store.isError ? (
        <ErrorView error={store.error} onRetry={() => void store.refetch()} />
      ) : categories.length === 0 ? (
        <Empty
          icon="orders"
          title={t.stores.noCategoriesTitle}
          hint={t.stores.noCategoriesHint}
        />
      ) : (
        <FlatList
          data={categories}
          keyExtractor={(cat) => cat.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={item.name}
              onPress={() =>
                router.push(
                  `/collection?storeId=${storeId}&category=${item.slug}&gender=${gender}&title=${encodeURIComponent(item.name)}`,
                )
              }
              style={({ pressed }) => [styles.cat, pressed && styles.catPressed]}
            >
              <LinearGradient
                colors={['rgba(124,92,255,0.12)', 'rgba(10,10,15,0)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.catIcon}>
                <Icon name={iconFor(item.slug, item.name)} size={26} color={colors.accent} />
              </View>
              <Text style={styles.catName} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.catCount}>
                {item.count} {t.home.products}
              </Text>
            </Pressable>
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
  subtitle: { ...text.tiny, color: colors.textMuted, marginTop: 1 },

  list: { padding: spacing.md, gap: spacing.md },
  row: { gap: spacing.md },
  cat: {
    flex: 1,
    height: 130,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    padding: spacing.md,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  catPressed: { borderColor: colors.accent },
  catIcon: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    width: 46,
    height: 46,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  catName: { ...text.bodyMed, color: colors.text, textTransform: 'capitalize' },
  catCount: { ...text.tiny, color: colors.textMuted, marginTop: 2 },
});
