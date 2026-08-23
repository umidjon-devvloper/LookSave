import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getBrands, getProducts, type ProductCard } from '../../src/api/endpoints';
import { Icon } from '../../src/components/Icon';
import { Hero } from '../../src/components/home/Hero';
import { BrandRow, SectionHeader } from '../../src/components/home/Sections';
import { ErrorView, Screen } from '../../src/components/ui';
import { SkeletonGrid } from '../../src/components/Skeleton';
import { rtlStyles, useI18n } from '../../src/i18n';
import { useLocationStore } from '../../src/store/locationStore';
import { useSplashLanding } from '../../src/store/splashTargetStore';
import { money } from '../../src/theme/format';
import { images } from '../../src/theme/images';
import { colors, radius, spacing, text } from '../../src/theme/tokens';

/**
 * Deckning 01-slaydidagi "TRENDING NOW" kartochkasi: rasm, ustida sevimli
 * tugmasi, pastda nom va narx. Do'kon nomi va masofa kartadan olib tashlandi —
 * deckda ular yo'q, va ikki ustunli gridda matn juda siqilib qolardi.
 */
function TrendingCard({
  product,
  onPress,
  isRTL,
}: {
  product: ProductCard;
  onPress: () => void;
  isRTL: boolean;
}): JSX.Element {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.imageWrap}>
        {product.image ? (
          <Image source={{ uri: product.image }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]} />
        )}

        <View style={[styles.heart, isRTL ? { left: spacing.sm, right: undefined } : null]}>
          <Icon name="favorite" size={16} color={colors.text} />
        </View>

        {product.has3d ? (
          <View style={styles.badge3d}>
            <Text style={styles.badge3dText}>3D</Text>
          </View>
        ) : null}
      </View>

      <Text style={[styles.cardTitle, rtlStyles.text(isRTL)]} numberOfLines={1}>
        {product.title}
      </Text>
      <Text style={[styles.price, rtlStyles.text(isRTL)]}>
        {money(product.price, product.currency)}
      </Text>
    </Pressable>
  );
}

export default function Home(): JSX.Element {
  const router = useRouter();
  const t = useI18n((state) => state.t);
  const isRTL = useI18n((state) => state.isRTL);
  const { coords, permission, request } = useLocationStore();
  // Bu ekranda tepa sarlavha yo'q (logotip uning o'rnini bosadi), shuning uchun
  // status bar ostiga kirib ketmaslik uchun bo'shliq qo'lda qo'shiladi.
  const insets = useSafeAreaInsets();
  // Splash logotipi aynan shu logotip ustiga uchib qo'nadi
  const splashLanding = useSplashLanding();

  useEffect(() => {
    if (permission === 'unknown') void request();
  }, [permission, request]);

  const brands = useQuery({ queryKey: ['brands'], queryFn: getBrands });

  /* Sahifalash — katalogdagidek. Ilgari faqat birinchi 20 ta kelardi. */
  const products = useInfiniteQuery({
    queryKey: ['products', 'home', coords.lat, coords.lng],
    queryFn: ({ pageParam }) =>
      getProducts({
        sort: 'nearest',
        lat: coords.lat,
        lng: coords.lng,
        ...(pageParam ? { cursor: pageParam } : {}),
      }),
    initialPageParam: '',
    getNextPageParam: (last) => (last.hasMore ? (last.nextCursor ?? undefined) : undefined),
  });

  if (products.isLoading) return <SkeletonGrid count={4} />;
  if (products.isError) {
    return <ErrorView error={products.error} onRetry={() => void products.refetch()} />;
  }

  const items = products.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <Screen>
      <FlatList
        data={items}
        keyExtractor={(product) => product.id}
        numColumns={2}
        columnWrapperStyle={styles.column}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        // Ro'yxat unumdorligi — ekrandan chiqqan kartalar bo'shatiladi
        removeClippedSubviews
        initialNumToRender={6}
        maxToRenderPerBatch={8}
        windowSize={7}
        onEndReachedThreshold={0.6}
        onEndReached={() => {
          // ⚠️ `isFetchingNextPage` usiz bitta scrollda bir necha marta chaqiriladi
          if (products.hasNextPage && !products.isFetchingNextPage) {
            void products.fetchNextPage();
          }
        }}
        ListFooterComponent={products.isFetchingNextPage ? <SkeletonGrid count={2} /> : null}
        ListHeaderComponent={
          <View style={styles.header}>
            <Hero
              headerInset={insets.top + spacing.sm}
              isRTL={isRTL}
              header={
                // Deckdagi logotip qatori — hero fotosining ustida turadi
                <View style={[styles.topBar, rtlStyles.row(isRTL)]}>
                  <View style={[styles.wordmarkWrap, rtlStyles.row(isRTL)]}>
                    <View
                      ref={splashLanding.ref}
                      onLayout={splashLanding.onLayout}
                      collapsable={false}
                    >
                      <Image source={images.logoMark} style={styles.logo} resizeMode="contain" />
                    </View>
                    <Text style={styles.wordmark}>Look Save</Text>
                  </View>
                  <View style={[styles.topActions, rtlStyles.row(isRTL)]}>
                    <Pressable onPress={() => router.push('/catalog')} hitSlop={8}>
                      <Icon name="search" size={22} color={colors.text} />
                    </Pressable>
                    <Pressable onPress={() => router.push('/stores')} hitSlop={8}>
                      <Icon name="stores" size={22} color={colors.text} />
                    </Pressable>
                    <Pressable onPress={() => router.push('/orders')} hitSlop={8}>
                      <Icon name="bell" size={22} color={colors.text} />
                    </Pressable>
                  </View>
                </View>
              }
              title={t.home.heroLine1}
              titleAccent={t.home.heroLine2}
              titleEnd={t.home.heroLine3}
              subtitle={t.home.heroSubtitle}
              ctaLabel={t.home.marketplace}
              ctaHint={t.home.exploreNow}
              onCta={() => router.push('/(tabs)/marketplace')}
              image={images.heroHome}
              badges={[
                {
                  icon: 'authentic',
                  title: t.home.badgeAuthentic,
                  hint: t.home.badgeAuthenticHint,
                },
                { icon: 'delivery', title: t.home.badgeDelivery, hint: t.home.badgeDeliveryHint },
                { icon: 'premium', title: t.home.badgeBrands, hint: t.home.badgeBrandsHint },
              ]}
            />

            {(brands.data ?? []).length > 0 ? (
              <View style={styles.section}>
                <SectionHeader
                  title={t.home.topBrands}
                  actionLabel={t.home.viewAll}
                  onAction={() => router.push('/catalog')}
                />
                <BrandRow
                  brands={brands.data ?? []}
                  onPress={(brand) => router.push(`/catalog?brand=${brand.slug}`)}
                />
              </View>
            ) : null}

            <View style={styles.section}>
              <SectionHeader title={t.home.trendingNow} />
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <TrendingCard
            product={item}
            isRTL={isRTL}
            onPress={() => router.push(`/product/${item.id}`)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>{t.home.emptyTitle}</Text>
            <Text style={styles.emptyHint}>{t.home.emptyHint}</Text>
          </View>
        }
        refreshing={products.isFetching}
        onRefresh={() => void products.refetch()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.md, paddingTop: 0, gap: spacing.md },
  column: { gap: spacing.sm },
  header: { marginBottom: spacing.md },

  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wordmarkWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  // Logotipda mayda detallar bor (galstuk, krossovka) — kichik o'lchamda ular
  // bir-biriga qo'shilib ketadi, shuning uchun balandlik 46px.
  logo: { width: 64, height: 46 },
  wordmark: { ...text.wordmark, color: colors.text },
  topActions: { flexDirection: 'row', gap: spacing.md },

  section: { marginTop: spacing.sm },

  // `maxWidth` — toq sondagi oxirgi karta butun qatorni egallab ketmasligi uchun
  card: { flex: 1, maxWidth: '48.5%', gap: 2 },
  imageWrap: { position: 'relative' },
  image: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  imagePlaceholder: { borderWidth: 1, borderColor: colors.border },
  heart: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10,10,15,0.55)',
  },
  badge3d: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.borderAccent,
  },
  badge3dText: { ...text.tiny, color: colors.accent },
  cardTitle: { ...text.small, color: colors.text, marginTop: spacing.sm },
  price: { ...text.price, color: colors.text, fontSize: 15, lineHeight: 20 },

  empty: { paddingVertical: spacing.xl, gap: spacing.sm },
  emptyTitle: { ...text.h3, color: colors.text, textAlign: 'center' },
  emptyHint: { ...text.small, color: colors.textDim, textAlign: 'center' },
});
