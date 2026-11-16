import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, type Href } from 'expo-router';
import { Animated, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import { useRef } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '../../src/components/Icon';
import { ScrollFade } from '../../src/components/ScrollFade';
import { Screen } from '../../src/components/ui';
import { rtlStyles, useI18n } from '../../src/i18n';
import { images } from '../../src/theme/images';
import { colors, radius, spacing, text } from '../../src/theme/tokens';

/**
 * Marketplace — deckning 07-slaydi.
 *
 * Kolleksiyalar `products.gender` va `products.is_limited` ustunlari bo'yicha
 * filtrlanadi (004_catalog.sql). Ya'ni bo'linish haqiqiy, ko'z bo'yash emas.
 */
/**
 * Hero balandligi — cho'zilish nisbati shunga o'lchanadi (`styles.hero.minHeight`).
 * Home ekranidagi bilan bir xil usul (`Hero.tsx` dagi izohga qarang).
 */
const HERO_HEIGHT = 590;

interface Collection {
  key: string;
  title: string;
  icon: IconName;
  tagline?: string;
  href: Href;
  /** Deckdagidek: model fotosi kartaning o'ng yarmida turadi. */
  image: ImageSourcePropType;
  accent: string;
}

function CollectionCard({
  collection,
  subtitle,
  onPress,
  isRTL,
  dark,
}: {
  collection: Collection;
  subtitle: string;
  onPress: () => void;
  isRTL: boolean;
  dark: boolean;
}): JSX.Element {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        dark && styles.cardDark,
        pressed && { borderColor: collection.accent },
      ]}
      onPress={onPress}
    >
      {/* Foto o'ngda — deckdagi kompozitsiya. Chap yarmi matn uchun bo'sh qoladi. */}
      <Image
        source={collection.image}
        style={isRTL ? styles.cardImageRTL : styles.cardImage}
        resizeMode="cover"
      />

      {/* Atelier: krem oqim matn tomondan — foto o'ng tomonda ochiq ko'rinadi */}
      <LinearGradient
        colors={
          dark
            ? ['rgba(18,15,31,0.98)', 'rgba(27,20,45,0.84)', 'rgba(18,15,31,0)']
            : ['rgba(255,255,255,0.98)', 'rgba(250,247,255,0.86)', 'rgba(255,255,255,0)']
        }
        locations={[0, 0.55, 1]}
        start={{ x: isRTL ? 1 : 0, y: 0.5 }}
        end={{ x: isRTL ? 0 : 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.cardBody, rtlStyles.row(isRTL)]}>
        <Icon name={collection.icon} size={22} color={collection.accent} />

        <View style={[styles.cardText, rtlStyles.align(isRTL)]}>
          <Text style={[styles.cardSubtitle, dark && styles.textMutedDark, rtlStyles.text(isRTL)]}>
            {subtitle}
          </Text>
          <Text style={[styles.cardTitle, dark && styles.textDark, rtlStyles.text(isRTL)]}>
            {collection.title}
          </Text>
          {collection.tagline ? (
            <Text style={[styles.tagline, rtlStyles.text(isRTL), { color: collection.accent }]}>
              {collection.tagline}
            </Text>
          ) : null}
        </View>

        <View style={[styles.chevron, { borderColor: collection.accent }]}>
          <Icon name={isRTL ? 'back' : 'next'} size={16} color={collection.accent} />
        </View>
      </View>
    </Pressable>
  );
}

export default function Marketplace(): JSX.Element {
  const router = useRouter();
  const t = useI18n((state) => state.t);
  const isRTL = useI18n((state) => state.isRTL);
  const insets = useSafeAreaInsets();
  // Marketplace foydalanuvchi tizim temasidan qat'i nazar oq premium ko'rinishda.
  const dark = false;

  /*
   * Scroll holati — Home ekranidagi bilan bir xil tizim: fon rezinkadek
   * cho'ziladi, tepa fon 100px da to'liq qorayadi. RN `Animated` +
   * `useNativeDriver` (reanimated emas: babel plagini yo'q).
   */
  const scrollY = useRef(new Animated.Value(0)).current;

  /* Pastga tortilganda fon cho'ziladi, TEPASI ekran tepasida qotib qoladi */
  const stretchStyle = {
    transform: [
      {
        translateY: scrollY.interpolate({
          inputRange: [-HERO_HEIGHT, 0],
          outputRange: [-HERO_HEIGHT / 2, 0],
          extrapolateRight: 'clamp' as const,
        }),
      },
      {
        scale: scrollY.interpolate({
          inputRange: [-HERO_HEIGHT, 0],
          outputRange: [2, 1],
          extrapolateRight: 'clamp' as const,
        }),
      },
    ],
  };

  /** Fixed header egallaydigan balandlik — hero kontenti shundan keyin boshlanadi */
  const headerHeight = insets.top + 62;

  const collections: Collection[] = [
    {
      key: 'men',
      title: t.marketplace.men,
      icon: 'slotTop',
      // Endi to'g'ridan-to'g'ri mahsulot emas — avval DO'KONLAR ochiladi
      href: '/market/stores?gender=male',
      image: images.collectionMen,
      accent: colors.primary,
    },
    {
      key: 'women',
      title: t.marketplace.women,
      icon: 'dress',
      href: '/market/stores?gender=female',
      image: images.collectionWomen,
      accent: colors.accent,
    },
    {
      key: 'limited',
      title: t.marketplace.limited,
      icon: 'limited',
      tagline: t.marketplace.limitedTagline,
      href: '/collection?kind=limited',
      image: images.collectionLimited,
      accent: colors.limited,
    },
  ];

  return (
    <Screen>
      <View style={[StyleSheet.absoluteFill, dark && styles.screenDark]} pointerEvents="none" />
      <Animated.ScrollView
        style={dark ? styles.screenDark : undefined}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        /* `16` — 60 FPS; kattaroq son cho'zilishni sakratadi */
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: true,
        })}
      >
        <View style={[styles.hero, dark && styles.heroDark, { paddingTop: headerHeight }]}>
          {/*
            ⚠️ CHO'ZILUVCHI FON QATLAMI — rasm VA gradientlar BIRGA.
            Alohida bo'lsa pastga tortilganda rasm gradient ostidan sirg'alib
            chiqib, yorqin chekka ochilib qolardi (Home'da xuddi shu xato
            tuzatilgan). `overflow: hidden` shu konteynerда: rasm hero'dan
            uzunroq (`top: 44, height: 400`) va u kesilishi kerak, lekin
            kesish chegarasi konteyner bilan BIRGA cho'ziladi.
          */}
          <Animated.View style={[StyleSheet.absoluteFill, styles.bgLayer, stretchStyle]}>
            <Image
              source={images.heroMarket}
              style={isRTL ? styles.heroImageRTL : styles.heroImage}
              resizeMode="cover"
            />
            <LinearGradient
              colors={
                dark
                  ? ['rgba(10,8,18,0.98)', 'rgba(15,10,28,0.78)', 'rgba(15,10,28,0.02)']
                  : ['rgba(251,250,255,0.98)', 'rgba(251,250,255,0.80)', 'rgba(251,250,255,0)']
              }
              locations={[0, 0.55, 1]}
              start={{ x: isRTL ? 1 : 0, y: 0.55 }}
              end={{ x: isRTL ? 0 : 1, y: 0.1 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>

          <View style={styles.marketChip}>
            <Icon name="slotTop" size={16} color={colors.primary} />
            <Text style={styles.marketChipText}>{t.marketplace.title}</Text>
          </View>

          <Text style={[styles.heroLine, dark && styles.textDark, rtlStyles.text(isRTL)]}>
            {t.marketplace.heroLine1}
          </Text>
          <Text style={[styles.heroLine, dark && styles.textDark, rtlStyles.text(isRTL)]}>
            <Text style={{ color: colors.primary }}>{t.marketplace.heroAccent}</Text>
            {t.marketplace.heroLine2}
          </Text>
          <Text style={[styles.heroSubtitle, dark && styles.textMutedDark, rtlStyles.text(isRTL)]}>
            {t.marketplace.heroSubtitle}
          </Text>

          <Pressable
            style={({ pressed }) => [styles.heroCta, pressed && { opacity: 0.86 }]}
            onPress={() => router.push('/catalog')}
          >
            <Text style={styles.heroCtaText}>{t.home.exploreNow}</Text>
            <Icon name={isRTL ? 'back' : 'next'} size={20} color="#FFFFFF" />
          </Pressable>

          <View style={styles.sliderDots}>
            <View style={styles.sliderDotActive} />
            <View style={styles.sliderDot} />
            <View style={styles.sliderDot} />
          </View>

          {/* Pastki chet fonga aralashsin — krem rangning shaffof→solid */}
          <LinearGradient
            colors={dark ? ['rgba(10,8,18,0)', '#0A0812'] : ['rgba(251,250,255,0)', colors.bg]}
            style={styles.heroFade}
            pointerEvents="none"
          />
        </View>

        <View style={styles.categoryHeader}>
          <Text style={styles.categoryTitle}>{t.marketplace.chooseCategory}</Text>
          <Pressable style={styles.viewAll} onPress={() => router.push('/catalog')}>
            <Text style={styles.viewAllText}>{t.home.viewAll}</Text>
            <Icon name={isRTL ? 'back' : 'next'} size={18} color={colors.primary} />
          </Pressable>
        </View>

        <View style={styles.cards}>
          {collections.map((collection) => (
            <CollectionCard
              key={collection.key}
              collection={collection}
              subtitle={t.marketplace.collection}
              isRTL={isRTL}
              dark={dark}
              onPress={() => router.push(collection.href)}
            />
          ))}
        </View>
      </Animated.ScrollView>

      {/* Tepa fon — sarlavha qatori ORQASIDA (`ScrollFade` izohiga qarang) */}
      <ScrollFade scrollY={scrollY} height={headerHeight} tone={dark ? 'dark' : 'light'} />

      {/*
        FIXED header — MARKETPLACE sarlavhasi va savat. Ilgari scroll ichida
        edi va status bar ostiga kirib ketardi (soat bilan ustma-ust tushardi).
      */}
      <View style={[styles.headerBar, { paddingTop: insets.top + spacing.sm }]}>
        <View style={[styles.topBar, rtlStyles.row(isRTL)]}>
          <View style={[styles.brandWrap, rtlStyles.row(isRTL)]}>
            <View style={[styles.titleWrap, rtlStyles.align(isRTL)]}>
              <Text style={styles.title}>Look Save</Text>
              <Text style={styles.brandSubtitle}>{t.marketplace.title}</Text>
            </View>
          </View>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenDark: { backgroundColor: '#0A0812' },
  scroll: { paddingHorizontal: spacing.md, gap: spacing.lg, paddingBottom: 120 },

  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brandWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  titleWrap: { flex: 1, alignItems: 'flex-start' },
  // Atelier: Fraunces serif sarlavha, ALL CAPS yo'q
  title: { ...text.h2, color: colors.text },
  brandSubtitle: { ...text.small, color: colors.textMuted },
  hero: {
    // Ekran chetlariga chiqadi — Home ekranidagi hero bilan bir xil usul.
    // Yumaloq burchak olib tashlandi: rasm o'ng chetga to'liq yopishadi va
    // uning chegarasi umuman ko'rinmaydi.
    marginHorizontal: -spacing.md,
    /*
     * ⚠️ `visible` SHART. Cho'zilganda fon qatlami hero chegarasidan TEPAGA
     * chiqadi (tepasini ekranda ushlab turish uchun). `hidden` bo'lsa aynan
     * o'sha qism kesilib, rezinka o'rniga bo'sh chiziq ko'rinardi. Rasmni
     * kesish endi `bgLayer` ning vazifasi.
     */
    overflow: 'visible',
    paddingHorizontal: spacing.md,
    /*
     * ⚠️ IKKI TOMONLAMA XATO BO'LGAN JOY — o'rtasini topish kerak bo'ldi.
     *
     * Sarlavha qatori (`topBar`) fixed header'ga chiqqach `center`
     * kompozitsiyani bo'shatib yubordi: matn bilan «CHOOSE CATEGORY»
     * orasida katta qora joy qolardi. `flex-end` esa teskari tomonga
     * og'di — matn ekran pastiga yopishib, tepada rasm bilan bo'sh
     * maydon qolardi.
     *
     * Yechim: `center` qoldiriladi, lekin blok pasti qisqartiriladi
     * (`paddingBottom` kichik, `minHeight` past). Shunda matn markazga
     * yaqin turadi va ikkala chekka ham bo'shab qolmaydi.
     */
    paddingBottom: spacing.md,
    minHeight: HERO_HEIGHT - 40,
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  heroDark: { backgroundColor: '#0A0812' },
  // Rasm blokdan uzunroq va yuqoriga surilgan — `cover` markazni kesib
  // model boshini yo'qotmasligi uchun (kolleksiya kartalaridagi bilan bir usul).
  // Rasm status bar ostidan emas, biroz pastdan boshlanadi — model boshi
  // kesilmaydi va sarlavha bilan orasida havo qoladi.
  // Arabchada chapga o'tadi va kengroq — chegarasi ko'rinmasin
  // Rasm hero'dan uzunroq — shu qatlam uni kesadi, va kesish chegarasi
  // cho'zilish bilan birga kattalashadi (hero'ning o'zi `visible`).
  bgLayer: { overflow: 'hidden' },
  // Tepa qorong'ilashuvi — status bar + sarlavha qatorini qoplaydi
  topFade: { position: 'absolute', left: 0, right: 0, top: 0, height: 200 },
  headerBar: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: spacing.md },
  heroFade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 56 },
  // Atelier: Fraunces display, natural case
  heroLine: { ...text.hero, color: colors.text },
  heroSubtitle: {
    ...text.body,
    color: colors.textMuted,
    marginTop: spacing.sm,
    maxWidth: '70%',
  },
  heroCta: {
    alignSelf: 'flex-start',
    minWidth: 190,
    height: 54,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  heroCtaText: { ...text.bodyMed, color: '#FFFFFF' },

  marketChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(247,242,255,0.88)',
  },
  marketChipText: { ...text.small, color: colors.text },
  sliderDots: { flexDirection: 'row', gap: 7, marginTop: spacing.lg, alignItems: 'center' },
  sliderDotActive: { width: 34, height: 6, borderRadius: radius.pill, backgroundColor: colors.primary },
  sliderDot: { width: 8, height: 8, borderRadius: radius.pill, backgroundColor: colors.borderStrong },
  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
  },
  trustItem: { flexDirection: 'row', alignItems: 'center', gap: 7, flex: 1 },
  trustIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trustTitle: { ...text.small, color: colors.text, fontFamily: 'Inter_700Bold' },
  trustHint: { ...text.tiny, color: colors.textMuted },
  trustDivider: { width: 1, height: 36, marginHorizontal: 8, backgroundColor: colors.borderStrong },

  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  categoryTitle: { ...text.h2, color: colors.text },
  viewAll: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  viewAllText: { ...text.bodyMed, color: colors.primary },

  cards: { gap: spacing.md },
  // Rasmlar vertikal (1086×1448), karta esa past va keng. `cover` markazni
  // kesadi va model boshi kadrdan chiqib ketadi, shuning uchun rasm karta
  // balandligidan uzunroq qilinib yuqoriga suriladi — kadrda yelka va yuz qoladi.
  // O'ngdan 4% chekinadi: strelka tugmasi foto ustiga tushmaydi.
  heroImage: { position: 'absolute', right: 0, top: 44, width: '62%', height: 400 },
  // LTR ning ko'zgu aksi. `width` shart — Hero.tsx dagi izohga qarang.
  heroImageRTL: { position: 'absolute', left: 0, top: 44, width: '62%', height: 400 },
  cardImage: { position: 'absolute', right: 0, top: 0, width: '100%', height: '100%' },
  cardImageRTL: { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' },
  // Atelier: kolleksiya karta — toza oq, kichik radius, hair-thin
  card: {
    height: 150,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    shadowColor: '#6D28D9',
    shadowOpacity: 0.10,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
    elevation: 3,
  },
  cardDark: {
    borderColor: 'rgba(192,132,252,0.34)',
    backgroundColor: '#151120',
  },
  textDark: { color: '#FFFFFF' },
  textMutedDark: { color: '#C7C0D4' },
  cardBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
  },
  cardText: { flex: 1, gap: 2 },
  // Sarlavha Fraunces display, kichik eyebrow uning ustida
  cardTitle: { ...text.h2, color: colors.text },
  cardSubtitle: { ...text.eyebrow, color: colors.textMuted },
  tagline: { ...text.eyebrow, marginTop: spacing.xs },
  chevron: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
