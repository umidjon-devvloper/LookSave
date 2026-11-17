import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  addFavorite,
  getCart,
  getMarketplaceBanners,
  getProducts,
  removeFavorite,
  type ProductCard,
  type MarketplaceBanner,
} from '../src/api/endpoints';
import { Icon } from '../src/components/Icon';
import { Empty, ErrorView, Screen } from '../src/components/ui';
import { Skeleton } from '../src/components/Skeleton';
import { useI18n } from '../src/i18n';
import { useAuthStore } from '../src/store/authStore';
import { useLocationStore } from '../src/store/locationStore';
import { money } from '../src/theme/format';
import { colors, radius, spacing, text } from '../src/theme/tokens';
import { goBack } from '../src/navigation/back';

/**
 * Kolleksiya — Marketplace'dagi MEN / WOMEN / LIMITED kartalari ochadigan
 * ekran.
 *
 * ⚠️ NEGA KATALOGDAN ALOHIDA. Katalog — QIDIRUV vositasi: qidiruv maydoni,
 * filtr paneli, tartiblash, ikki ustunli batafsil kartalar. Kolleksiya esa
 * KO'RIB CHIQISH uchun: uch ustunli zich grid, kartada faqat rasm va
 * sevimli tugmasi. Ikkalasini bitta ekranga sig'dirishga urinish har
 * ikkalasini ham buzardi — bosish maqsadi butunlay boshqa.
 *
 * Narx va nom kartada YO'Q: ular gridni shovqinga to'ldiradi va zich
 * joylashuvda baribir o'qilmaydi. Mahsulot bosilganda hammasi ko'rinadi.
 */

const SCREEN_WIDTH = Dimensions.get('window').width;
const COLUMNS = 3;
const GAP = spacing.xs + 2;
/** Karta kengligi — chetlar va oraliqlar ayrilgandan keyin qolgani */
const CARD_WIDTH = Math.floor((SCREEN_WIDTH - spacing.md * 2 - GAP * (COLUMNS - 1)) / COLUMNS);

type Kind = 'men' | 'women' | 'limited';

type FeedRow =
  | { kind: 'products'; key: string; products: ProductCard[] }
  | { kind: 'banner'; key: string; banner: MarketplaceBanner };

function buildFeed(products: ProductCard[], banners: MarketplaceBanner[]): FeedRow[] {
  const rows: FeedRow[] = [];
  let bannerIndex = 0;

  for (let index = 0; index < products.length; index += COLUMNS) {
    const rowProducts = products.slice(index, index + COLUMNS);
    rows.push({ kind: 'products', key: `products-${index}`, products: rowProducts });

    const shown = index + rowProducts.length;
    if (shown % 6 === 0 && banners.length > 0) {
      const banner = banners[bannerIndex % banners.length];
      if (banner) {
        rows.push({ kind: 'banner', key: `banner-${shown}-${banner.id}`, banner });
        bannerIndex += 1;
      }
    }
  }

  return rows;
}

/** Kolleksiya gridining o'z skeleti: uch ustun, matnsiz, karta bilan bir o'lcham. */
function CollectionSkeleton({ rows = 3 }: { rows?: number }): JSX.Element {
  return (
    <View style={styles.skeletonGrid}>
      {Array.from({ length: rows }, (_, row) => (
        <View key={row} style={styles.column}>
          {Array.from({ length: COLUMNS }, (_, column) => (
            <View key={column} style={styles.skeletonCard}>
              <Skeleton aspectRatio={3 / 4} radius={radius.md} />
              <Skeleton width={24} height={24} radius={radius.pill} style={styles.skeletonHeart} />
              <Skeleton height={20} radius={radius.sm} style={styles.skeletonPrice} />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function BannerCard({ banner, onPress }: { banner: MarketplaceBanner; onPress: () => void }): JSX.Element {
  const t = useI18n((state) => state.t);

  return (
    <Pressable
      disabled={!banner.targetUrl}
      onPress={onPress}
      style={({ pressed }) => [styles.banner, pressed && styles.bannerPressed]}
    >
      <Image source={{ uri: banner.imageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      {/* Atelier: pastki qismi krem — bannerTitle ink matn o'qiladi */}
      <LinearGradient
        colors={['rgba(247,242,234,0.1)', 'rgba(247,242,234,0.94)']}
        locations={[0.25, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.bannerCopy}>
        <Text style={styles.bannerLabel}>{t.home.adLabel}</Text>
        <Text style={styles.bannerTitle} numberOfLines={2}>{banner.title}</Text>
        {banner.subtitle ? <Text style={styles.bannerSubtitle} numberOfLines={2}>{banner.subtitle}</Text> : null}
      </View>
      {banner.targetUrl ? (
        <View style={styles.bannerArrow}>
          <Icon name="next" size={18} color={colors.primary} />
        </View>
      ) : null}
    </Pressable>
  );
}

function CollectionCard({
  product,
  favorite,
  onPress,
  onToggleFavorite,
}: {
  product: ProductCard;
  favorite: boolean;
  onPress: () => void;
  onToggleFavorite: () => void;
}): JSX.Element {
  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View
        style={[
          styles.imageWrap,
          /*
           * Neon ramka — kiyib ko'rish mumkin bo'lgan mahsulotda.
           * Zich gridda yozuv o'qilmasdi, ramka esa uzoqdan ko'rinadi
           * va aynan shu mahsulotlar ilovaning asosiy qiymatini
           * ko'rsatadi.
           */
          product.canTryOn && styles.imageWrapGlow,
        ]}
      >
        {product.image ? (
          <Image source={{ uri: product.image }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={[styles.image, styles.placeholder]} />
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: favorite }}
          hitSlop={8}
          onPress={onToggleFavorite}
          style={styles.heart}
        >
          <Icon
            name={favorite ? 'favoriteOn' : 'favorite'}
            size={13}
            color={favorite ? colors.accent : colors.text}
          />
        </Pressable>

        {product.isLimited ? (
          <View style={styles.limitedTag}>
            <Icon name="limited" size={10} color={colors.limited} />
          </View>
        ) : null}

        {/*
          Narx RASM USTIDA. Karta ostida bo'lganda u gridda qo'shimcha
          qator ochib, zichlikni buzardi va kartalar orasidagi bo'shliq
          notekis ko'rinardi. Yarim shaffof fon — narx yorug' rasmda ham
          o'qilishi uchun.
        */}
        <View style={styles.priceTag}>
          <Text style={styles.priceText} numberOfLines={1}>
            {money(product.price, product.currency)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function Collection(): JSX.Element {
  const router = useRouter();
  const params = useLocalSearchParams<{
    kind?: string;
    storeId?: string;
    category?: string;
    gender?: string;
    title?: string;
  }>();
  const t = useI18n((state) => state.t);
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { coords } = useLocationStore();
  const signedIn = useAuthStore((state) => state.status) === 'signedIn';

  const kind: Kind = params.kind === 'women' || params.kind === 'limited' ? params.kind : 'men';
  // Do'kon + kategoriya orqali kelinganda shular bo'yicha filtrlaymiz
  const storeId = params.storeId;
  const category = params.category;
  const gender = params.gender === 'female' ? 'female' : params.gender === 'male' ? 'male' : null;

  /* Sevimli holati darhol o'zgaradi — tarmoq javobini kutish sekin ko'rinardi */
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});

  const toggleFavorite = useMutation({
    mutationFn: ({ id, next }: { id: string; next: boolean }) =>
      next ? addFavorite(id) : removeFavorite(id),
    onMutate: ({ id, next }) => {
      setFavorites((current) => ({ ...current, [id]: next }));
      return { id, previous: !next };
    },
    onError: (_err, _vars, context) => {
      if (context) setFavorites((current) => ({ ...current, [context.id]: context.previous }));
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['favorites'] });
    },
  });

  const cart = useQuery({ queryKey: ['cart'], queryFn: getCart, enabled: signedIn });
  const cartCount = cart.data?.stores.reduce((sum, group) => sum + group.items.length, 0) ?? 0;

  const products = useInfiniteQuery({
    queryKey: ['products', 'collection', kind, storeId ?? '', category ?? '', coords.lat, coords.lng],
    queryFn: ({ pageParam }) =>
      getProducts({
        // Do'kon+kategoriya rejimi: aynan shu do'kon va kategoriya, jins bo'yicha
        ...(storeId
          ? {
              storeId,
              ...(category ? { category } : {}),
              ...(gender ? { gender } : {}),
            }
          : kind === 'limited'
            ? { limited: true }
            : { gender: kind === 'men' ? 'male' : 'female' }),
        sort: 'newest',
        lat: coords.lat,
        lng: coords.lng,
        ...(pageParam ? { cursor: pageParam } : {}),
      }),
    initialPageParam: '',
    getNextPageParam: (last) => (last.hasMore ? (last.nextCursor ?? undefined) : undefined),
  });

  const banners = useQuery({
    queryKey: ['marketplace-banners', kind],
    queryFn: () => getMarketplaceBanners(kind),
    staleTime: 60_000,
  });

  const items = products.data?.pages.flatMap((page) => page.items) ?? [];
  const feed = buildFeed(items, banners.data ?? []);

  const openBanner = (banner: MarketplaceBanner): void => {
    if (!banner.targetUrl) return;
    if (banner.targetUrl.startsWith('/')) {
      router.push(banner.targetUrl as Href);
      return;
    }
    void Linking.openURL(banner.targetUrl);
  };

  const title =
    params.title ??
    (kind === 'men'
      ? t.marketplace.men
      : kind === 'women'
        ? t.marketplace.women
        : t.marketplace.limited);

  return (
    <Screen>
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={title}
          onPress={() => goBack('/marketplace')}
          style={styles.roundButton}
        >
          <Icon name="back" size={20} color={colors.text} />
        </Pressable>

        <View style={styles.topTitleWrap}>
          <Text style={styles.topTitle} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.topSubtitle}>{t.marketplace.collection}</Text>
        </View>

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

      {products.isLoading ? <CollectionSkeleton /> : null}
      {products.isError ? (
        <ErrorView error={products.error} onRetry={() => void products.refetch()} />
      ) : null}

      {products.data ? (
        <FlatList
          data={feed}
          keyExtractor={(row) => row.key}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          /* Zich gridda ekrandan chiqqan kartalar bo'shatiladi */
          removeClippedSubviews
          initialNumToRender={12}
          maxToRenderPerBatch={15}
          windowSize={7}
          onEndReachedThreshold={0.6}
          onEndReached={() => {
            // ⚠️ `isFetchingNextPage` usiz bitta scrollda bir necha marta chaqiriladi
            if (products.hasNextPage && !products.isFetchingNextPage) {
              void products.fetchNextPage();
            }
          }}
          ListFooterComponent={products.isFetchingNextPage ? <CollectionSkeleton rows={1} /> : null}
          ListEmptyComponent={<Empty title={t.home.emptyTitle} hint={t.catalog.emptyCategory} />}
          renderItem={({ item }) =>
            item.kind === 'banner' ? (
              <BannerCard banner={item.banner} onPress={() => openBanner(item.banner)} />
            ) : (
              <View style={styles.column}>
                {item.products.map((product) => (
                  <CollectionCard
                    key={product.id}
                    product={product}
                    favorite={favorites[product.id] ?? false}
                    onPress={() => router.push(`/product/${product.id}`)}
                    onToggleFavorite={() => {
                      // Kirmagan odamda yurakcha jimgina qaytardi — kirish ekrani ochiladi
                      if (!signedIn) {
                        router.push('/(auth)/sign-in');
                        return;
                      }
                      toggleFavorite.mutate({
                        id: product.id,
                        next: !(favorites[product.id] ?? false),
                      });
                    }}
                  />
                ))}
              </View>
            )
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
  topTitleWrap: { flex: 1, alignItems: 'center' },
  // Atelier: Fraunces display, natural case
  topTitle: { ...text.h2, color: colors.text },
  topSubtitle: { ...text.eyebrow, color: colors.textMuted },
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
  cartBadgeText: { ...text.tiny, color: colors.textOnPrimary, fontWeight: '700' },

  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl, gap: GAP },
  column: { flexDirection: 'row', gap: GAP },

  skeletonGrid: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl, gap: GAP },
  skeletonCard: { position: 'relative', width: CARD_WIDTH },
  skeletonHeart: { position: 'absolute', top: 5, right: 5 },
  skeletonPrice: { position: 'absolute', left: 4, bottom: 4, width: CARD_WIDTH - 8 },

  card: { width: CARD_WIDTH },
  imageWrap: {
    position: 'relative',
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  /*
   * Neon urg'u — iOS'da rangli soya nurlanish beradi (06-dizayn.md §5).
   * Android'da soya rangsiz, shuning uchun chegara rangi ham o'zgaradi:
   * shundagina urg'u ikkala platformada ham ko'rinadi.
   */
  // Atelier: urg'u faqat qalin anor chegara — glow yo'q
  imageWrapGlow: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  image: { width: '100%', aspectRatio: 3 / 4, backgroundColor: colors.surface },
  placeholder: { backgroundColor: colors.surface2 },

  // Atelier: rasm ustidagi oq overlay
  heart: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.94)',
  },
  limitedTag: {
    position: 'absolute',
    top: 5,
    left: 5,
    width: 20,
    height: 20,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderWidth: 1,
    borderColor: colors.limited,
  },

  priceTag: {
    position: 'absolute',
    left: 4,
    right: 4,
    bottom: 4,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 3,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  // Narx — serif display, ink
  priceText: { ...text.price, fontSize: 12, lineHeight: 15, color: colors.text },

  banner: {
    height: 132,
    marginVertical: spacing.sm,
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: 'flex-end',
  },
  bannerPressed: { opacity: 0.88 },
  bannerCopy: { padding: spacing.md, paddingRight: 58 },
  // "Reklama" — eyebrow italic Fraunces
  bannerLabel: { ...text.eyebrow, color: colors.primary },
  // Sarlavha Fraunces display
  bannerTitle: { ...text.h2, color: colors.text, marginTop: 2 },
  bannerSubtitle: { ...text.small, color: colors.textMuted, marginTop: 2 },
  bannerArrow: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.md,
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderWidth: 1,
    borderColor: colors.border,
  },
});
