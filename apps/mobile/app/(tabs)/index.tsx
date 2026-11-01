import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getBrands, getLooks, getProducts, type ProductCard } from '../../src/api/endpoints';
import { Icon } from '../../src/components/Icon';
import { Hero } from '../../src/components/home/Hero';
import { ScrollFade } from '../../src/components/ScrollFade';
import { BrandRow, SectionHeader } from '../../src/components/home/Sections';
import { Empty, ErrorView, Screen } from '../../src/components/ui';
import { rtlStyles, useI18n } from '../../src/i18n';
import { useAiFlowStore } from '../../src/store/aiFlowStore';
import { useAuthStore } from '../../src/store/authStore';
import { useLocationStore } from '../../src/store/locationStore';
import { useSplashLanding } from '../../src/store/splashTargetStore';
import { CARD_PADDING, CARD_TEXT_INSET } from '../../src/components/Skeleton';
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
  onLookPress,
  inLook,
  isRTL,
}: {
  product: ProductCard;
  onPress: () => void;
  onLookPress: () => void;
  inLook: boolean;
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

        {/*
          ⚠️ «3D» EMAS, «AI». Ilgari bu belgi 3D modeli bor mahsulotni
          ko'rsatardi. Kiyib ko'rish endi suratdan AI orqali bo'ladi va
          shart butunlay boshqa — modeli borlar emas, sloti mos
          keladiganlar. Eski belgi yolg'on va'da berardi.
        */}
        {product.canTryOn ? (
          <View
            style={[
              styles.badgeTryon,
              // RTL'da yurak chapga o'tadi — AI belgisini o'ngga ko'chiramiz,
              // aks holda ikkalasi ham chap burchakda ustma-ust tushadi
              isRTL ? { right: spacing.sm, left: undefined } : null,
            ]}
          >
            <Text style={styles.badgeTryonText}>AI</Text>
          </View>
        ) : null}

        {/*
          «Lookga qo'sh» tugmasi — rasm pastki chekkasida yotgan pil.
          Yurak yuqoridagi burchakda, bu esa pastki qarshi burchakda:
          foydalanuvchi ikkisini chalkashtirmaydi. Mahsulot sahifasi
          ichida kiyintirish tajribasi bor, shu yerga olib boradi.
        */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={inLook ? 'Lookda bor' : "Lookga qo'shish"}
          onPress={(e) => {
            e.stopPropagation();
            onLookPress();
          }}
          hitSlop={6}
          style={[
            styles.lookBtn,
            inLook && styles.lookBtnOn,
            isRTL ? { right: spacing.sm, left: undefined } : null,
          ]}
        >
          <Icon
            name={inLook ? 'check' : 'looks'}
            size={13}
            color={inLook ? colors.text : colors.accent}
          />
          <Text style={styles.lookBtnText}>{inLook ? 'Lookda' : 'Look'}</Text>
        </Pressable>
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

/**
 * Yangilash uchun necha px tortish kerak. 90 — iOS RefreshControl'ning
 * odatiy chegarasiga yaqin: tasodifiy tegishda ishlamaydi, ataylab
 * tortganda esa qo'l cho'zilishini sezadi.
 */
const REFRESH_PULL = 90;

/*
 * ⚠️ TIP QAYTA TIKLANADI. `Animated.FlatList` — RN ning tayyor animated
 * varianti (`createAnimatedComponent` ni qo'lda chaqirish shart emas va
 * u render ichida chaqirilsa ro'yxatni butunlay qayta o'rnatardi). Lekin
 * uning tipi generikni yo'qotadi, shuning uchun `props` lar `any` bo'lib
 * qolardi — `data`, `renderItem`, `keyExtractor` tekshirilmay ketardi.
 * Shu sababli tip `FlatList` ga qaytariladi: xatti-harakat animated,
 * tekshiruv esa oddiy ro'yxatnikidek qat'iy.
 */
const AnimatedFlatList = Animated.FlatList as unknown as typeof FlatList;

export default function Home(): JSX.Element {
  const router = useRouter();
  const t = useI18n((state) => state.t);
  const isRTL = useI18n((state) => state.isRTL);
  const { coords, permission, request } = useLocationStore();
  // Lookga qo'shish — aiFlowStore outfit layer bilan ishlaydi
  const outfit = useAiFlowStore((state) => state.outfit);
  const wear = useAiFlowStore((state) => state.wear);
  // Bu ekranda tepa sarlavha yo'q (logotip uning o'rnini bosadi), shuning uchun
  // status bar ostiga kirib ketmaslik uchun bo'shliq qo'lda qo'shiladi.
  const insets = useSafeAreaInsets();
  // Splash logotipi aynan shu logotip ustiga uchib qo'nadi
  const splashLanding = useSplashLanding();

  /*
   * Scroll holati — ikki effektni boshqaradi: hero fonining rezinkadek
   * cho'zilishi (`Hero`) va tepadagi fade fon (pastda).
   *
   * ⚠️ `useNativeDriver: true` — interpolatsiya UI oqimida hisoblanadi,
   * ya'ni JS band bo'lsa ham (rasm yuklash, sahifalash) effekt sekinlashmaydi.
   * Shuning uchun `onScroll` da hech qanday JS ishi qilinmaydi.
   */
  const scrollY = useRef(new Animated.Value(0)).current;

  /** Fixed header egallaydigan balandlik — hero kontenti shundan keyin boshlanadi */
  const headerHeight = insets.top + 62;

  useEffect(() => {
    if (permission === 'unknown') void request();
  }, [permission, request]);

  const brands = useQuery({ queryKey: ['brands'], queryFn: getBrands });

  // Saqlangan looklar — AI ikonkadagi badge va bosilganda yo'nalish shu
  // ro'yxatga. Faqat kirgan foydalanuvchi uchun — bo'lmasa 401 xatosi.
  const authStatusForLooks = useAuthStore((state) => state.status);
  const savedLooks = useQuery({
    queryKey: ['looks'],
    queryFn: getLooks,
    enabled: authStatusForLooks === 'signedIn',
  });

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

  if (products.isError) {
    return (
      <Screen>
        <ErrorView error={products.error} onRetry={() => void products.refetch()} />
      </Screen>
    );
  }

  const items = products.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <Screen>
      <AnimatedFlatList
        data={items}
        keyExtractor={(product) => product.id}
        numColumns={2}
        /*
         * Fon rasmi cho'zilishi uchun overscroll SHART — iOS'da bu
         * `bounces` (default true). `scrollEventThrottle: 16` esa 60 FPS:
         * native driver bilan bo'lsa ham iOS hodisa chastotasini shu
         * qiymatdan oladi; kattaroq son cho'zilishni sakratadi.
         */
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: true,
        })}
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
        ListFooterComponent={
          products.isFetchingNextPage ? (
            <View style={styles.footerLoading}>
              <ActivityIndicator color={colors.accent} size="small" />
            </View>
          ) : null
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <Hero
              headerInset={headerHeight}
              isRTL={isRTL}
              scrollY={scrollY}
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
            onLookPress={() => {
              if (!item.canTryOn) {
                // Kiyib ko'rib bo'lmaydigan buyum (masalan aksessuar) —
                // mahsulot sahifasida foydalanuvchi batafsil ko'radi
                router.push(`/product/${item.id}`);
                return;
              }
              /*
               * Slot `null` bo'lishi mumkin — eski API javobida bu maydon
               * yo'q edi, deploy'dan oldin backward-compat uchun `top`
               * standart qiymat. Yangi javobda to'g'ri slot keladi.
               */
              wear(item.slot ?? 'top', item.id);
            }}
            inLook={outfit.some((layer) => layer.variantId === item.id)}
          />
        )}
        ListEmptyComponent={
          products.isLoading ? null : (
            <Empty icon="bag" title={t.home.emptyTitle} hint={t.home.emptyHint} />
          )
        }
        /*
         * ⚠️ RefreshControl ATAYIN ISHLATILMAYDI. iOS'da u ro'yxat
         * kontentini pastga SURADI va o'z bo'shlig'ini ochadi — natijada
         * hero fonining tepasida oq-qora chiziq paydo bo'lib, rezinka
         * effektini buzardi. O'rniga: tortish chegarasi qo'lda o'lchanadi
         * va indikator fon USTIDA suzadi (pastda, `absolute`).
         */
        onScrollEndDrag={(event) => {
          const pulled = -event.nativeEvent.contentOffset.y;
          if (pulled > REFRESH_PULL && !products.isRefetching) void products.refetch();
        }}
      />

      {/* Tepa fon — logotip qatori ORQASIDA (`ScrollFade` izohiga qarang) */}
      <ScrollFade scrollY={scrollY} height={headerHeight} />

      {/*
        FIXED header — deckdagi logotip qatori. Ilgari ro'yxat ichida edi va
        scroll bilan yuqoriga chiqib ketardi; endi doim ko'rinadi.
      */}
      <View style={[styles.headerBar, { paddingTop: insets.top + spacing.sm }]}>
        <View style={[styles.topBar, rtlStyles.row(isRTL)]}>
          <View style={[styles.wordmarkWrap, rtlStyles.row(isRTL)]}>
            <View ref={splashLanding.ref} onLayout={splashLanding.onLayout} collapsable={false}>
              <Image source={images.logoMark} style={styles.logo} resizeMode="contain" />
            </View>
            <Text style={styles.wordmark}>Look Save</Text>
          </View>
          <View style={[styles.topActions, rtlStyles.row(isRTL)]}>
            {/*
              AI tugmasi — qidiruvdan oldin, chunki marketplace ichidagi eng
              farqlanadigan tajriba shu. Accent (binafsha) rang bilan ko'zga
              tashlanadi, qolgan ikonkalar neytral oq rangda qoladi.
            */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                outfit.length > 0
                  ? `AI — ${outfit.length} ta buyum yig'ilgan`
                  : (savedLooks.data?.length ?? 0) > 0
                    ? `Looklar — ${savedLooks.data?.length} ta saqlangan`
                    : 'AI Designer'
              }
              /*
                Ikki holat, bitta ikonka:
                  — foydalanuvchi mahsulotlardan "Look" bosib buyumlar yig'yapti
                    (`outfit.length > 0`) → kiyintirish ekraniga, u yerda ko'radi;
                  — hali hech narsa yig'ilmagan → saqlangan looklariga.
                Badge esa qaysi oqimda bo'lsa — o'shaning sonini chiqaradi.
              */
              onPress={() =>
                router.push(outfit.length > 0 ? '/ai/fitting' : '/looks')
              }
              hitSlop={8}
              style={styles.aiBtn}
            >
              <Icon name="tryon" size={22} color={colors.accent} />
              {outfit.length > 0 ? (
                <View style={styles.aiBadge}>
                  <Text style={styles.aiBadgeText}>{outfit.length}</Text>
                </View>
              ) : (savedLooks.data?.length ?? 0) > 0 ? (
                <View style={styles.aiBadge}>
                  <Text style={styles.aiBadgeText}>{savedLooks.data!.length}</Text>
                </View>
              ) : null}
            </Pressable>
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
      </View>

      {/*
        Yangilash indikatori — fon USTIDA suzadi (RefreshControl kabi joy
        ochmaydi). Header ostida turadi, ya'ni logotipni to'smaydi.
      */}
      {products.isRefetching ? (
        <View
          style={[styles.refreshBadge, { top: headerHeight + spacing.sm }]}
          pointerEvents="none"
        >
          <ActivityIndicator color={colors.accent} size="small" />
        </View>
      ) : null}

    </Screen>
  );
}

const styles = StyleSheet.create({
  headerBar: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: spacing.md },
  refreshBadge: {
    position: 'absolute',
    alignSelf: 'center',
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10,10,15,0.65)',
  },
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
  // Katalog kartasi bilan bir xil yaxlit quti (`catalog.tsx` → styles.card)
  card: {
    flex: 1,
    maxWidth: '48.5%',
    gap: 2,
    padding: CARD_PADDING,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  imageWrap: { position: 'relative' },
  image: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: radius.md,
    backgroundColor: colors.surface2,
  },
  imagePlaceholder: { borderWidth: 1, borderColor: colors.border },
  footerLoading: { paddingVertical: spacing.lg, alignItems: 'center' },
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
  badgeTryon: {
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
  badgeTryonText: { ...text.tiny, color: colors.accent },
  lookBtn: {
    position: 'absolute',
    bottom: spacing.sm,
    left: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(10,10,15,0.72)',
    borderWidth: 1,
    borderColor: colors.borderAccent,
  },
  lookBtnOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  lookBtnText: { ...text.tiny, color: colors.text, letterSpacing: 0.3 },

  // AI tugmasidagi hisoblagich — binafsha pill, 1-9 va «9+»
  aiBtn: { position: 'relative' },
  aiBadge: {
    position: 'absolute',
    top: -6,
    right: -8,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    borderWidth: 1.5,
    borderColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiBadgeText: {
    ...text.tiny,
    color: colors.text,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 0,
  },
  cardTitle: {
    ...text.small,
    color: colors.text,
    marginTop: spacing.sm,
    paddingHorizontal: CARD_TEXT_INSET,
  },
  price: {
    ...text.price,
    color: colors.text,
    fontSize: 15,
    lineHeight: 20,
    paddingHorizontal: CARD_TEXT_INSET,
    paddingBottom: 2,
  },

  empty: { paddingVertical: spacing.xl, gap: spacing.sm },
  emptyTitle: { ...text.h3, color: colors.text, textAlign: 'center' },
  emptyHint: { ...text.small, color: colors.textDim, textAlign: 'center' },
});
