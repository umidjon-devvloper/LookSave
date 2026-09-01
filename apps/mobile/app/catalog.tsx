import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getCart, getCategories, getProducts, type ProductSort } from '../src/api/endpoints';
import {
  countFilters,
  EMPTY_FILTERS,
  FilterSheet,
  type CatalogFilters,
} from '../src/components/catalog/FilterSheet';
import { Icon, type IconName } from '../src/components/Icon';
import { Empty, ErrorView, Field, Screen } from '../src/components/ui';
import { SkeletonGrid } from '../src/components/Skeleton';
import { useI18n } from '../src/i18n';
import { useAuthStore } from '../src/store/authStore';
import { useLocationStore } from '../src/store/locationStore';
import { distance, money } from '../src/theme/format';
import { colors, radius, spacing, text } from '../src/theme/tokens';
import { goBack } from '../src/navigation/back';

/** Yorliqlar tarjimadan olinadi — avval o'zbekcha qatorlar kodga yozib qo'yilgan edi. */
const SORTS: ProductSort[] = ['nearest', 'popular', 'newest', 'priceAsc', 'priceDesc'];

/**
 * Tartiblash chiplarining ikonkalari — maketdagi qator.
 * Yorliq tarjimadan, ikonka shu yerdan: ikkalasi bir joyda bo'lsa
 * tarjimon fayliga ikonka nomlari ham tushib ketardi.
 */
const SORT_ICONS: Record<ProductSort, IconName> = {
  nearest: 'location',
  popular: 'favoriteOn',
  newest: 'premium',
  priceAsc: 'limited',
  priceDesc: 'limited',
};

function Chip({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon?: IconName;
  active: boolean;
  onPress: () => void;
}): JSX.Element {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      {icon ? <Icon name={icon} size={15} color={active ? colors.accent : colors.textDim} /> : null}
      <Text style={[styles.chipText, active && { color: colors.text }]}>{label}</Text>
    </Pressable>
  );
}

export default function Catalog(): JSX.Element {
  const router = useRouter();
  /*
   * ⚠️ HAMMA PARAMETR O'QILISHI SHART. Ilgari bu yerda faqat `category`
   * va `q` bor edi, holbuki ekranga uch xil havola keladi:
   *
   *   Marketplace → /catalog?gender=male | female | limited=true
   *   Home        → /catalog?brand=<slug>
   *
   * Qolganlari jimgina tashlab yuborilardi: «MEN COLLECTION» bosilsa ham
   * katalog BUTUN assortimentni ko'rsatardi va nuqson xatosiz o'tardi —
   * ekran ochilardi, shunchaki filtrsiz.
   */
  const params = useLocalSearchParams<{
    category?: string;
    q?: string;
    gender?: string;
    limited?: string;
    brand?: string;
  }>();
  const t = useI18n((state) => state.t);
  const { coords } = useLocationStore();
  const insets = useSafeAreaInsets();
  const signedIn = useAuthStore((state) => state.status) === 'signedIn';

  const [query, setQuery] = useState(params.q ?? '');
  const [debounced, setDebounced] = useState(query);
  const [category, setCategory] = useState<string | undefined>(params.category);
  const [sort, setSort] = useState<ProductSort>('nearest');
  const [filters, setFilters] = useState<CatalogFilters>({
    ...EMPTY_FILTERS,
    ...(params.gender === 'male' || params.gender === 'female' ? { gender: params.gender } : {}),
    ...(params.limited === 'true' ? { limited: true } : {}),
  });
  /* Brend faqat havoladan keladi — panelda tanlanmaydi, shuning uchun alohida */
  const brand = params.brand;
  const [sheetOpen, setSheetOpen] = useState(false);
  const activeFilters = countFilters(filters);
  /** Grid — ikki ustun, list — bitta. Maketdagi o'ng yuqoridagi juft tugma. */
  const [columns, setColumns] = useState<1 | 2>(2);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), 400);
    return () => clearTimeout(timer);
  }, [query]);

  const categories = useQuery({ queryKey: ['categories'], queryFn: getCategories });

  /* Savatdagi soni — sarlavhadagi belgi uchun. Kirmagan foydalanuvchida so'ralmaydi. */
  const cart = useQuery({ queryKey: ['cart'], queryFn: getCart, enabled: signedIn });
  const cartCount = cart.data?.stores.reduce((sum, group) => sum + group.items.length, 0) ?? 0;

  const products = useInfiniteQuery({
    queryKey: [
      'products',
      'catalog',
      debounced,
      category,
      brand,
      sort,
      filters,
      coords.lat,
      coords.lng,
    ],
    queryFn: ({ pageParam }) =>
      getProducts({
        ...(debounced.trim().length >= 2 ? { q: debounced.trim() } : {}),
        ...(category ? { category } : {}),
        ...(brand ? { brand } : {}),
        ...(filters.gender ? { gender: filters.gender } : {}),
        ...(filters.priceMin !== undefined ? { priceMin: filters.priceMin } : {}),
        ...(filters.priceMax !== undefined ? { priceMax: filters.priceMax } : {}),
        ...(filters.onlyTryon ? { onlyTryon: true } : {}),
        ...(filters.limited ? { limited: true } : {}),
        sort,
        lat: coords.lat,
        lng: coords.lng,
        ...(pageParam ? { cursor: pageParam } : {}),
      }),
    initialPageParam: '',
    getNextPageParam: (last) => (last.hasMore ? (last.nextCursor ?? undefined) : undefined),
  });

  const items = products.data?.pages.flatMap((page) => page.items) ?? [];

  /* Kategoriyalar daraxti tekis ro'yxatga yoyiladi — chiplar bitta qatorda */
  const flatCategories = (categories.data ?? []).flatMap((parent) => [parent, ...parent.children]);

  return (
    <Screen>
      {/*
        Maxsus sarlavha — orqaga, nom va savat. Native stack header o'rniga,
        chunki maketda savat belgisi (sondagi doira) va boshqa oraliqlar bor.
        `_layout.tsx` da bu ekran uchun `headerShown: false`.
      */}
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.catalog.title}
          onPress={() => goBack('/marketplace')}
          style={styles.roundButton}
        >
          <Icon name="back" size={20} color={colors.text} />
        </Pressable>

        {/*
          Sarlavha qayerdan kelinganini aytadi: «MEN COLLECTION» bosilgan
          bo'lsa «Erkak», aks holda umumiy «Katalog». Usiz foydalanuvchi
          ro'yxat filtrlanganini bilmasdi.
        */}
        <Text style={styles.topTitle} numberOfLines={1}>
          {filters.gender === 'male'
            ? t.catalog.genderMale
            : filters.gender === 'female'
              ? t.catalog.genderFemale
              : filters.limited
                ? t.catalog.onlyLimited
                : t.catalog.title}
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.tabs.cart}
          onPress={() => router.push('/(tabs)/cart')}
          style={styles.roundButton}
        >
          <Icon name="cart" size={20} color={colors.text} />
          {cartCount > 0 ? (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{cartCount > 9 ? '9+' : cartCount}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      <FlatList
        data={items}
        key={columns}
        keyExtractor={(product) => product.id}
        numColumns={columns}
        {...(columns === 2 ? { columnWrapperStyle: { gap: spacing.sm } } : {})}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        /*
         * Ro'yxat unumdorligi: ekrandan chiqqan kartalar xotiradan
         * bo'shatiladi va boshlanishida faqat ko'rinadigan qismi
         * chiziladi. Uzun katalogda bu sezilarli farq beradi.
         */
        removeClippedSubviews
        initialNumToRender={6}
        maxToRenderPerBatch={8}
        windowSize={7}
        /*
         * 0.6 — ro'yxat oxiriga yetishdan oldin so'raladi, shunda
         * foydalanuvchi kutmaydi.
         */
        onEndReachedThreshold={0.6}
        onEndReached={() => {
          // ⚠️ `isFetchingNextPage` SHART: usiz bitta scrollda bir necha
          // marta chaqiriladi va bir xil sahifa qayta-qayta so'raladi
          if (products.hasNextPage && !products.isFetchingNextPage) {
            void products.fetchNextPage();
          }
        }}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.searchRow}>
              <View style={styles.searchField}>
                <Field
                  value={query}
                  onChangeText={setQuery}
                  placeholder={t.home.search}
                  autoCorrect={false}
                />
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t.catalog.filters}
                onPress={() => setSheetOpen(true)}
                style={[styles.filterButton, activeFilters > 0 && styles.filterButtonActive]}
              >
                <Icon
                  name="filter"
                  size={20}
                  color={activeFilters > 0 ? colors.accent : colors.text}
                />
                {activeFilters > 0 ? (
                  <View style={styles.filterBadge}>
                    <Text style={styles.filterBadgeText}>{activeFilters}</Text>
                  </View>
                ) : null}
              </Pressable>
            </View>

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
                    icon={SORT_ICONS[option]}
                    active={sort === option}
                    onPress={() => setSort(option)}
                  />
                ))}
                <Chip
                  label={t.product.tryOn}
                  icon="tryon"
                  active={filters.onlyTryon}
                  onPress={() => setFilters((f) => ({ ...f, onlyTryon: !f.onlyTryon }))}
                />
              </View>
            </ScrollView>

            {/* Joriy tartib va ko'rinish — maketdagi qator */}
            <View style={styles.sortRow}>
              <Text style={styles.sortLabel}>
                {t.catalog.sortBy}: <Text style={styles.sortValue}>{t.catalog[sort]}</Text>
              </Text>

              <View style={styles.viewToggle}>
                {([2, 1] as const).map((count) => (
                  <Pressable
                    key={count}
                    accessibilityRole="button"
                    onPress={() => setColumns(count)}
                    style={[styles.viewButton, columns === count && styles.viewButtonActive]}
                  >
                    <Icon
                      name={count === 2 ? 'grid' : 'list'}
                      size={17}
                      color={columns === count ? colors.accent : colors.textDim}
                    />
                  </Pressable>
                ))}
              </View>
            </View>

            {products.isLoading ? <SkeletonGrid count={4} /> : null}
            {products.isError ? (
              <ErrorView error={products.error} onRetry={() => void products.refetch()} />
            ) : null}
          </View>
        }
        ListFooterComponent={products.isFetchingNextPage ? <SkeletonGrid count={2} /> : null}
        ListEmptyComponent={
          products.isLoading || products.isError ? null : (
            <Empty
              title={t.home.emptyTitle}
              hint={debounced.trim().length >= 2 ? t.catalog.emptyQuery : t.catalog.emptyCategory}
            />
          )
        }
        renderItem={({ item }) => (
          <Pressable
            style={[styles.card, columns === 1 && styles.cardWide]}
            onPress={() => router.push(`/product/${item.id}`)}
          >
            <View style={styles.imageWrap}>
              {item.image ? (
                <Image source={{ uri: item.image }} style={styles.image} resizeMode="cover" />
              ) : (
                <View style={[styles.image, styles.placeholder]} />
              )}

              {/* «AI» — shu mahsulotni o'zingda ko'rish mumkin */}
              {item.canTryOn ? (
                <View style={styles.badgeTryon}>
                  <Text style={styles.badgeTryonText}>AI</Text>
                </View>
              ) : null}

              <View style={styles.heart}>
                <Icon name="favorite" size={15} color={colors.text} />
              </View>

              {/*
                Do'kon va masofa RASM USTIDA — maketdagidek. Ilgari ular
                kartaning pastida edi va narx bilan bir ustunga siqilardi.
              */}
              <View style={styles.storeTag}>
                <Icon name="location" size={11} color={colors.text} />
                <Text style={styles.storeTagText} numberOfLines={1}>
                  {item.store.name}
                  {item.store.distanceM !== null ? ` · ${distance(item.store.distanceM)}` : ''}
                </Text>
              </View>
            </View>

            <Text style={styles.title} numberOfLines={1}>
              {item.title}
            </Text>

            <View style={styles.priceRow}>
              <Text style={styles.price} numberOfLines={1}>
                {money(item.price, item.currency)}
              </Text>
              <View style={styles.cartButton}>
                <Icon name="cart" size={16} color={colors.text} />
              </View>
            </View>
          </Pressable>
        )}
      />

      <FilterSheet
        visible={sheetOpen}
        value={filters}
        onClose={() => setSheetOpen(false)}
        onApply={setFilters}
      />
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
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  cartBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  cartBadgeText: { ...text.tiny, color: colors.text, fontWeight: '700' },

  header: { gap: spacing.sm, paddingBottom: spacing.sm },
  /*
   * ⚠️ `flex-start`, `center` EMAS. `Field` ostida `marginBottom: 16`
   * bor (xato matni uchun joy), ya'ni uning balandligi 68 px. Markazga
   * tekislansa filtr tugmasi maydondan 8 px pastga tushib qolardi.
   */
  searchRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  searchField: { flex: 1 },
  filterButton: {
    width: 52,
    height: 52,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  filterButtonActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  filterBadgeText: { ...text.tiny, color: colors.text, fontWeight: '700' },

  chips: { flexDirection: 'row', gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.surface2 },
  chipText: { ...text.small, color: colors.textMuted },

  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  sortLabel: {
    ...text.small,
    color: colors.textMuted,
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  sortValue: { color: colors.accent, fontWeight: '600' },
  viewToggle: {
    flexDirection: 'row',
    gap: 2,
    padding: 3,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  viewButton: {
    width: 40,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewButtonActive: { backgroundColor: colors.surface2 },

  list: { padding: spacing.md, gap: spacing.sm },
  card: { flex: 1, maxWidth: '48.5%', gap: 2, marginBottom: spacing.md },
  // Bitta ustunda `maxWidth` cheklovi olib tashlanadi
  cardWide: { maxWidth: '100%' },
  imageWrap: { position: 'relative' },
  image: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  placeholder: { borderWidth: 1, borderColor: colors.border },
  badgeTryon: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(10,10,15,0.7)',
  },
  badgeTryonText: { ...text.tiny, color: colors.text },
  heart: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10,10,15,0.55)',
  },
  storeTag: {
    position: 'absolute',
    left: spacing.sm,
    bottom: spacing.sm,
    right: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(10,10,15,0.62)',
  },
  storeTagText: { ...text.tiny, color: colors.text, flexShrink: 1 },

  title: { ...text.bodyMed, color: colors.text, marginTop: spacing.sm },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: 2,
  },
  price: { ...text.price, color: colors.accent, fontSize: 15, lineHeight: 20, flexShrink: 1 },
  cartButton: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
});
