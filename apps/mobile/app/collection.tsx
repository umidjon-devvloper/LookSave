import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Dimensions, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  addFavorite,
  getCart,
  getProducts,
  removeFavorite,
  type ProductCard,
} from '../src/api/endpoints';
import { Icon } from '../src/components/Icon';
import { Empty, ErrorView, Screen } from '../src/components/ui';
import { SkeletonGrid } from '../src/components/Skeleton';
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
  const params = useLocalSearchParams<{ kind?: string }>();
  const t = useI18n((state) => state.t);
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { coords } = useLocationStore();
  const signedIn = useAuthStore((state) => state.status) === 'signedIn';

  const kind: Kind = params.kind === 'women' || params.kind === 'limited' ? params.kind : 'men';

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
    queryKey: ['products', 'collection', kind, coords.lat, coords.lng],
    queryFn: ({ pageParam }) =>
      getProducts({
        ...(kind === 'limited'
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

  const items = products.data?.pages.flatMap((page) => page.items) ?? [];

  const title =
    kind === 'men'
      ? t.marketplace.men
      : kind === 'women'
        ? t.marketplace.women
        : t.marketplace.limited;

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

      {products.isLoading ? <SkeletonGrid count={6} /> : null}
      {products.isError ? (
        <ErrorView error={products.error} onRetry={() => void products.refetch()} />
      ) : null}

      {products.data ? (
        <FlatList
          data={items}
          keyExtractor={(product) => product.id}
          numColumns={COLUMNS}
          columnWrapperStyle={styles.column}
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
          ListFooterComponent={products.isFetchingNextPage ? <SkeletonGrid count={3} /> : null}
          ListEmptyComponent={<Empty title={t.home.emptyTitle} hint={t.catalog.emptyCategory} />}
          renderItem={({ item }) => (
            <CollectionCard
              product={item}
              favorite={favorites[item.id] ?? false}
              onPress={() => router.push(`/product/${item.id}`)}
              onToggleFavorite={() =>
                toggleFavorite.mutate({ id: item.id, next: !(favorites[item.id] ?? false) })
              }
            />
          )}
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
  topTitle: { ...text.h3, color: colors.text, textTransform: 'uppercase' },
  topSubtitle: { ...text.tiny, color: colors.textDim, letterSpacing: 2 },
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

  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl, gap: GAP },
  column: { gap: GAP },

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
  imageWrapGlow: {
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.55,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  image: { width: '100%', aspectRatio: 3 / 4, backgroundColor: colors.surface },
  placeholder: { backgroundColor: colors.surface2 },

  heart: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10,10,15,0.6)',
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
    backgroundColor: 'rgba(10,10,15,0.6)',
  },

  priceTag: {
    position: 'absolute',
    left: 4,
    right: 4,
    bottom: 4,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 3,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(10,10,15,0.72)',
  },
  priceText: { ...text.tiny, color: colors.text, fontWeight: '700' },
});
