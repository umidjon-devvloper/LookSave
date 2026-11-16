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

import { hasItem } from '../../src/ai/lookTray';
import { getNearbyStores, getProducts, type ProductCard } from '../../src/api/endpoints';
import { Icon } from '../../src/components/Icon';
import { Hero, HERO_HEIGHT } from '../../src/components/home/Hero';
import { SectionHeader, StoreRow } from '../../src/components/home/Sections';
import { Empty, ErrorView, Screen } from '../../src/components/ui';
import { rtlStyles, useI18n } from '../../src/i18n';
import { useLocationStore } from '../../src/store/locationStore';
import { useLookStore } from '../../src/store/lookStore';
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
  const t = useI18n((state) => state.t);

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.imageWrap}>
        {/*
          ⚠️ `contain`, `cover` EMAS. `cover` katakni to'ldirish uchun rasmni
          kesardi — kurtka/ko'ylakning yuqori va pastki qismi ko'rinmasdi.
          `contain` butun mahsulotni ko'rsatadi (chetda biroz bo'sh joy qolsa
          ham) — mijoz nima sotib olayotganini to'liq ko'radi.
        */}
        {product.image ? (
          <Image source={{ uri: product.image }} style={styles.image} resizeMode="contain" />
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

        {/*
          «Lookga qo'sh» tugmasi — rasm pastki chekkasida yotgan pil.
          Yurak yuqoridagi burchakda, bu esa pastki qarshi burchakda:
          foydalanuvchi ikkisini chalkashtirmaydi. Mahsulot sahifasi
          ichida kiyintirish tajribasi bor, shu yerga olib boradi.
        */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={inLook ? t.tryon.removeFromLook : t.tryon.addToLook}
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
            color={inLook ? colors.textOnPrimary : colors.primary}
          />
          <Text style={[styles.lookBtnText, inLook && { color: colors.textOnPrimary }]}>
            {/* «Look» — brend atamasi, har tilda bir xil; qo'shilgan holati tarjima qilinadi */}
            {inLook ? t.tryon.inLook : 'Look'}
          </Text>
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
  // «Look» savati — kartadagi tugma kiyimni shu yerga yig'adi (`lookStore`)
  const lookItems = useLookStore((state) => state.items);
  const addLook = useLookStore((state) => state.add);
  const removeLook = useLookStore((state) => state.remove);
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

  const stores = useQuery({
    queryKey: ['stores', 'home', coords.lat, coords.lng],
    queryFn: () => getNearbyStores(coords.lat, coords.lng, { radius: 50_000 }),
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
        style={{ backgroundColor: '#FFFFFF' }}
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
            />

            <View style={styles.contentSheet}>
              {(stores.data ?? []).length > 0 ? (
                <View style={styles.section}>
                  <SectionHeader
                    icon="hot"
                    title={t.home.topStores}
                    actionLabel={t.home.viewAll}
                    onAction={() => router.push('/market/stores')}
                  />
                  <StoreRow
                    stores={stores.data ?? []}
                    onPress={(store) => router.push(`/store/${store.id}`)}
                  />
                </View>
              ) : null}

              <View style={styles.section}>
                <SectionHeader icon="limited" title={t.home.trendingNow} />
              </View>
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
                router.push(`/product/${item.id}`);
                return;
              }
              /*
               * ⚠️ HAMMA BOSILGANI SAQLANADI. 5 ta kurtka bosilsa beshalasi
               * ham savatga tushadi va nishon o'sadi; kiyiladigani esa bir
               * turdan bittasi — oxirgi qo'shilgani (qolganlari primerkada
               * nomzod bo'lib turadi va bosib almashtiriladi).
               *
               * Karta faqat MAHSULOTNI biladi. Rangi (variant) primerka
               * ekranida serverdan aniqlanadi; surat va narx esa hoziroq
               * beriladi — savat darhol to'g'ri ko'rinsin.
               */
              if (hasItem(lookItems, item.id)) {
                removeLook(item.id);
                return;
              }
              addLook({
                productId: item.id,
                variantId: null,
                slot: item.slot,
                title: item.title,
                image: item.image,
                price: item.price,
                currency: item.currency,
              });
            }}
            inLook={hasItem(lookItems, item.id)}
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

      <Animated.View
        style={[
          styles.headerBar,
          {
            paddingTop: insets.top + spacing.sm,
            transform: [
              {
                translateY: scrollY.interpolate({
                  inputRange: [0, headerHeight],
                  outputRange: [0, -headerHeight],
                  extrapolate: 'clamp',
                }),
              },
            ],
          },
        ]}
      >
        <View style={[styles.topBar, rtlStyles.row(isRTL)]}>
          <View style={[styles.wordmarkWrap, rtlStyles.row(isRTL)]}>
            <View ref={splashLanding.ref} onLayout={splashLanding.onLayout} collapsable={false}>
              <Image source={images.logoMark} style={styles.logo} resizeMode="contain" />
            </View>
            <Text style={styles.wordmark}>
              Look<Text style={styles.wordmarkAccent}>Save</Text>
            </Text>
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
                lookItems.length > 0
                  ? `${t.tryon.title} — ${t.tryon.collected.replace('{n}', String(lookItems.length))}`
                  : t.tryon.title
              }
              /*
                ⚠️ BITTA IKONKA — BITTA EKRAN. Ilgari bu tugma ikki joyga
                olib borardi: kiyim yig'ilgan bo'lsa primerkaga, bo'lmasa
                saqlangan komplektlar ro'yxatiga — nishon ham goh unisini,
                goh bunisini sanardi. Endi u doim primerkani ochadi va doim
                yig'ilgan kiyimlar sonini ko'rsatadi; savat bo'sh bo'lsa
                ekranning o'zi nima qilishni aytadi (saqlangan komplektlarga
                yo'l ham o'sha yerda).
              */
              onPress={() => router.push('/ai/fitting')}
              hitSlop={8}
              style={styles.aiBtn}
            >
              <Icon name="tryon" size={22} color="#FFFFFF" />
              {lookItems.length > 0 ? (
                <View style={styles.aiBadge}>
                  <Text style={styles.aiBadgeText}>{lookItems.length}</Text>
                </View>
              ) : null}
            </Pressable>
            <Pressable onPress={() => router.push('/catalog')} hitSlop={8}>
              <Icon name="search" size={22} color="#FFFFFF" />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Real-time kiyim ko'rish"
              onPress={() => router.push('/anywear')}
              hitSlop={8}
            >
              <Icon name="camera" size={22} color="#FFFFFF" />
            </Pressable>
            <Pressable onPress={() => router.push('/orders')} hitSlop={8}>
              <Icon name="bell" size={22} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>
      </Animated.View>

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
  // Atelier: krem pill (cho'tka ustida sal shaffof), ichida anor spinner.
  refreshBadge: {
    position: 'absolute',
    alignSelf: 'center',
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(247,242,234,0.92)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  list: {
    padding: spacing.md,
    paddingTop: 0,
    paddingBottom: 120,
    gap: spacing.md,
    backgroundColor: '#FFFFFF',
  },
  column: { gap: spacing.sm },
  header: { marginBottom: spacing.md },

  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wordmarkWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  // Logotipda mayda detallar bor (galstuk, krossovka) — kichik o'lchamda ular
  // bir-biriga qo'shilib ketadi, shuning uchun balandlik 46px.
  logo: { width: 64, height: 46 },
  wordmark: { ...text.wordmark, color: '#FFFFFF', fontSize: 18 },
  wordmarkAccent: { color: colors.accent },
  topActions: { flexDirection: 'row', gap: spacing.md },

  contentSheet: {
    marginHorizontal: -spacing.md,
    marginTop: -spacing.xl,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xl,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    zIndex: 4,
    elevation: 4,
  },
  section: { marginTop: spacing.sm },

  // Atelier karta: soyasiz, hair-thin chegara, deyarli kvadrat burchak (radius.md).
  // SaaS-card-kit yumaloq soyali shablonning aksi.
  card: {
    flex: 1,
    maxWidth: '48.5%',
    gap: 2,
    padding: CARD_PADDING,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    shadowColor: '#5B21B6',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
    elevation: 3,
  },
  imageWrap: { position: 'relative' },
  image: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radius.md,
    backgroundColor: colors.surface2,
  },
  imagePlaceholder: { borderWidth: 1, borderColor: colors.border },
  footerLoading: { paddingVertical: spacing.lg, alignItems: 'center' },
  // Yurak — rasm ustida oq doira, ichida chernila yurak. Oldingi yarim-shaffof
  // qora doira dark-fon uchun edi; bu yerda rasm ustida ham o'qiladi.
  heart: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  hotBadge: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    height: 26,
    paddingHorizontal: 9,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  hotBadgeText: { ...text.tiny, color: colors.textOnPrimary, fontSize: 12 },
  // "AI" belgisi — mayda, tipografik. Primary soft fon shaffof: rasm ustida
  // anor tus beradi, matn va chegara to'liq anor.
  badgeTryon: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(247,242,234,0.94)',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  badgeTryonText: {
    ...text.tiny,
    color: colors.primary,
    letterSpacing: 1.2,
  },
  // Look tugmasi — krem pill, ichida ink matn. Lookda bo'lsa anorga aylanadi.
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
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  lookBtnOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  lookBtnText: { ...text.tiny, color: colors.text, letterSpacing: 0.3 },

  // AI tugmasidagi hisoblagich — anor pill, krem matn
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
    color: colors.textOnPrimary,
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
  // Narx Atelier'da serif (text.price → Fraunces display semibold).
  // Shu bilan har karta "moda jurnali tilini" gapiradi.
  price: {
    ...text.price,
    color: colors.text,
    fontSize: 17,
    lineHeight: 22,
    paddingHorizontal: CARD_TEXT_INSET,
    paddingBottom: 2,
  },

  empty: { paddingVertical: spacing.xl, gap: spacing.sm },
  emptyTitle: { ...text.h3, color: colors.text, textAlign: 'center' },
  emptyHint: { ...text.small, color: colors.textDim, textAlign: 'center' },
});
