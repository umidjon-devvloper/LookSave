import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { getCategories, getProducts, type ProductSort } from '../src/api/endpoints';
import { Empty, ErrorView, Field, Screen } from '../src/components/ui';
import { SkeletonGrid } from '../src/components/Skeleton';
import { useI18n } from '../src/i18n';
import { useLocationStore } from '../src/store/locationStore';
import { distance, money } from '../src/theme/format';
import { colors, radius, spacing, text } from '../src/theme/tokens';

/** Yorliqlar tarjimadan olinadi — avval o'zbekcha qatorlar kodga yozib qo'yilgan edi. */
const SORTS: ProductSort[] = ['nearest', 'popular', 'newest', 'priceAsc', 'priceDesc'];

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}): JSX.Element {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && { color: colors.text }]}>{label}</Text>
    </Pressable>
  );
}

export default function Catalog(): JSX.Element {
  const router = useRouter();
  const params = useLocalSearchParams<{ category?: string; q?: string }>();
  const t = useI18n((state) => state.t);
  const { coords } = useLocationStore();

  const [query, setQuery] = useState(params.q ?? '');
  const [debounced, setDebounced] = useState(query);
  const [category, setCategory] = useState<string | undefined>(params.category);
  const [sort, setSort] = useState<ProductSort>('nearest');
  const [only3d, setOnly3d] = useState(false);

  /** Har harfda so'rov yubormaslik uchun — 400 ms kutamiz. */
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), 400);
    return () => clearTimeout(timer);
  }, [query]);

  const categories = useQuery({ queryKey: ['categories'], queryFn: getCategories });

  /*
   * ⚠️ SAHIFALASH. Ilgari bu oddiy `useQuery` edi va faqat BIRINCHI 20 ta
   * mahsulotni olardi. Server kursor qaytarardi, lekin uni hech kim
   * ishlatmasdi — ya'ni katalogdagi qolgan mahsulotlarga umuman yetib
   * bo'lmasdi va buni sezish qiyin edi: ro'yxat to'la ko'rinardi, oxiriga
   * yetganda esa shunchaki to'xtardi.
   */
  const products = useInfiniteQuery({
    queryKey: ['products', 'catalog', debounced, category, sort, only3d, coords.lat, coords.lng],
    queryFn: ({ pageParam }) =>
      getProducts({
        ...(debounced.trim().length >= 2 ? { q: debounced.trim() } : {}),
        ...(category ? { category } : {}),
        ...(only3d ? { only3d: true } : {}),
        ...(pageParam ? { cursor: pageParam } : {}),
        sort,
        lat: coords.lat,
        lng: coords.lng,
      }),
    initialPageParam: '',
    // `hasMore` yolg'on bo'lsa `undefined` qaytadi va TanStack so'ramaydi
    getNextPageParam: (last) => (last.hasMore ? (last.nextCursor ?? undefined) : undefined),
  });

  // Barcha sahifalarni bitta ro'yxatga yig'amiz
  const items = products.data?.pages.flatMap((page) => page.items) ?? [];

  // Kategoriya daraxti tekislanadi — chiplarda ierarxiya ko'rinmaydi
  const flatCategories = (categories.data ?? []).flatMap((parent) => [parent, ...parent.children]);

  return (
    <Screen>
      <View style={styles.header}>
        <Field
          value={query}
          onChangeText={setQuery}
          placeholder={t.home.search}
          autoCorrect={false}
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.chips}>
            <Chip
              label={t.home.categories}
              active={category === undefined}
              onPress={() => setCategory(undefined)}
            />
            {flatCategories.map((item) => (
              <Chip
                key={item.id}
                label={item.name}
                active={category === item.slug}
                onPress={() => setCategory(item.slug)}
              />
            ))}
          </View>
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.chips}>
            {SORTS.map((option) => (
              <Chip
                key={option}
                label={t.catalog[option]}
                active={sort === option}
                onPress={() => setSort(option)}
              />
            ))}
            <Chip
              label={t.product.tryOn}
              active={only3d}
              onPress={() => setOnly3d((value) => !value)}
            />
          </View>
        </ScrollView>
      </View>

      {products.isLoading ? <SkeletonGrid count={4} /> : null}
      {products.isError ? (
        <ErrorView error={products.error} onRetry={() => void products.refetch()} />
      ) : null}

      {products.data ? (
        <FlatList
          data={items}
          keyExtractor={(product) => product.id}
          numColumns={2}
          columnWrapperStyle={{ gap: spacing.sm }}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          /*
           * 0.6 — ro'yxat oxiriga yetishdan oldin so'raladi, shunda
           * foydalanuvchi kutmaydi. Juda kichik qiymat kech chaqiradi,
           * juda katta esa keraksiz sahifalarni oldindan yuklaydi.
           */
          /*
           * Ro'yxat unumdorligi: ekrandan chiqqan kartalar xotiradan
           * bo'shatiladi va boshlanishida faqat ko'rinadigan qismi
           * chiziladi. Uzun katalogda bu sezilarli farq beradi.
           */
          removeClippedSubviews
          initialNumToRender={6}
          maxToRenderPerBatch={8}
          windowSize={7}
          onEndReachedThreshold={0.6}
          onEndReached={() => {
            // ⚠️ `isFetchingNextPage` SHART: usiz bitta scrollda bir necha
            // marta chaqiriladi va bir xil sahifa qayta-qayta so'raladi
            if (products.hasNextPage && !products.isFetchingNextPage) {
              void products.fetchNextPage();
            }
          }}
          ListFooterComponent={products.isFetchingNextPage ? <SkeletonGrid count={2} /> : null}
          ListEmptyComponent={
            <Empty
              title={t.home.emptyTitle}
              hint={debounced.trim().length >= 2 ? t.catalog.emptyQuery : t.catalog.emptyCategory}
            />
          }
          renderItem={({ item }) => (
            <Pressable style={styles.card} onPress={() => router.push(`/product/${item.id}`)}>
              {item.image ? (
                <Image source={{ uri: item.image }} style={styles.image} resizeMode="cover" />
              ) : (
                <View style={[styles.image, styles.placeholder]} />
              )}
              {item.has3d ? <Text style={styles.badge}>3D</Text> : null}
              <Text style={styles.title} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.store} numberOfLines={1}>
                {item.store.name}
                {item.store.distanceM !== null ? ` · ${distance(item.store.distanceM)}` : ''}
              </Text>
              <Text style={styles.price}>{money(item.price, item.currency)}</Text>
            </Pressable>
          )}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { padding: spacing.md, paddingBottom: 0, gap: spacing.sm },
  chips: { flexDirection: 'row', gap: spacing.sm, paddingBottom: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.surface2 },
  chipText: { ...text.small, color: colors.textMuted },
  list: { padding: spacing.md, gap: spacing.sm },
  card: { flex: 1, maxWidth: '48.5%', gap: 2, marginBottom: spacing.md },
  image: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  placeholder: { borderWidth: 1, borderColor: colors.border },
  badge: {
    ...text.tiny,
    color: colors.accent,
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  title: { ...text.bodyMed, color: colors.text, marginTop: spacing.sm },
  store: { ...text.tiny, color: colors.textDim },
  price: { ...text.bodyMed, color: colors.text },
});
