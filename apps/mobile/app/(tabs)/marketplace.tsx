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
const HERO_HEIGHT = 420;

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
}: {
  collection: Collection;
  subtitle: string;
  onPress: () => void;
  isRTL: boolean;
}): JSX.Element {
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && { borderColor: collection.accent }]}
      onPress={onPress}
    >
      {/* Foto o'ngda — deckdagi kompozitsiya. Chap yarmi matn uchun bo'sh qoladi. */}
      <Image
        source={collection.image}
        style={isRTL ? styles.cardImageRTL : styles.cardImage}
        resizeMode="cover"
      />

      {/* Chapdan — matn fotoga tushib qolsa ham o'qiladi */}
      <LinearGradient
        colors={['rgba(10,10,15,0.99)', 'rgba(10,10,15,0.9)', 'rgba(10,10,15,0.05)']}
        locations={[0, 0.5, 1]}
        start={{ x: isRTL ? 1 : 0, y: 0.5 }}
        end={{ x: isRTL ? 0 : 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
      {/* O'ng chetni biroz qoraytirish — strelka fotoning yorug' joyiga tushmasin */}
      <LinearGradient
        colors={['rgba(10,10,15,0)', 'rgba(10,10,15,0.72)']}
        start={{ x: isRTL ? 0.22 : 0.78, y: 0.5 }}
        end={{ x: isRTL ? 0 : 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.cardBody, rtlStyles.row(isRTL)]}>
        <Icon name={collection.icon} size={26} color={collection.accent} />

        <View style={[styles.cardText, rtlStyles.align(isRTL)]}>
          <Text style={[styles.cardTitle, rtlStyles.text(isRTL)]}>{collection.title}</Text>
          <Text style={[styles.cardSubtitle, rtlStyles.text(isRTL)]}>{subtitle}</Text>
          {collection.tagline ? (
            <Text style={[styles.tagline, rtlStyles.text(isRTL), { color: collection.accent }]}>
              {collection.tagline}
            </Text>
          ) : null}
        </View>

        <View style={[styles.chevron, { borderColor: collection.accent }]}>
          <Icon name={isRTL ? 'back' : 'next'} size={18} color={colors.text} />
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
      href: '/collection?kind=men',
      image: images.collectionMen,
      accent: colors.primary,
    },
    {
      key: 'women',
      title: t.marketplace.women,
      icon: 'dress',
      href: '/collection?kind=women',
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
      <Animated.ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        /* `16` — 60 FPS; kattaroq son cho'zilishni sakratadi */
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: true,
        })}
      >
        <View style={[styles.hero, { paddingTop: headerHeight }]}>
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
              colors={['rgba(10,10,15,0.98)', 'rgba(10,10,15,0.88)', 'rgba(10,10,15,0.04)']}
              locations={[0, 0.5, 1]}
              start={{ x: isRTL ? 1 : 0, y: 0.55 }}
              end={{ x: isRTL ? 0 : 1, y: 0.1 }}
              style={StyleSheet.absoluteFill}
            />
            {/* Tepa qorong'ilashuvi — sarlavha va status bar doim o'qilsin */}
            <LinearGradient
              colors={['rgba(10,10,15,0.85)', 'rgba(10,10,15,0)']}
              style={styles.topFade}
              pointerEvents="none"
            />
          </Animated.View>

          <Text style={[styles.heroLine, rtlStyles.text(isRTL)]}>{t.marketplace.heroLine1}</Text>
          <Text style={[styles.heroLine, rtlStyles.text(isRTL)]}>
            <Text style={{ color: colors.primary }}>{t.marketplace.heroAccent}</Text>
            {t.marketplace.heroLine2}
          </Text>
          <Text style={[styles.heroSubtitle, rtlStyles.text(isRTL)]}>
            {t.marketplace.heroSubtitle}
          </Text>

          {/* Rasmning pastki cheti fonga singib ketsin — keskin chiziq qolmasin */}
          <LinearGradient
            colors={['rgba(10,10,15,0)', colors.bg]}
            style={styles.heroFade}
            pointerEvents="none"
          />
        </View>

        {/* Deckdagi "◆ CHOOSE CATEGORY ◆" ajratgichi */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerDiamond}>◆</Text>
          <Text style={styles.dividerText}>{t.marketplace.chooseCategory}</Text>
          <Text style={styles.dividerDiamond}>◆</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.cards}>
          {collections.map((collection) => (
            <CollectionCard
              key={collection.key}
              collection={collection}
              subtitle={t.marketplace.collection}
              isRTL={isRTL}
              onPress={() => router.push(collection.href)}
            />
          ))}
        </View>
      </Animated.ScrollView>

      {/* Tepa fon — sarlavha qatori ORQASIDA (`ScrollFade` izohiga qarang) */}
      <ScrollFade scrollY={scrollY} height={headerHeight} />

      {/*
        FIXED header — MARKETPLACE sarlavhasi va savat. Ilgari scroll ichida
        edi va status bar ostiga kirib ketardi (soat bilan ustma-ust tushardi).
      */}
      <View style={[styles.headerBar, { paddingTop: insets.top + spacing.sm }]}>
        <View style={[styles.topBar, rtlStyles.row(isRTL)]}>
          <View style={[styles.titleWrap, rtlStyles.align(isRTL)]}>
            <Text style={styles.title}>{t.marketplace.title}</Text>
            <Text style={styles.motto}>{t.marketplace.motto}</Text>
          </View>
          <Pressable style={styles.cartButton} onPress={() => router.push('/(tabs)/cart')}>
            <Icon name="cart" size={20} color={colors.text} />
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.md, gap: spacing.lg, paddingBottom: spacing.xl },

  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  // Sarlavha chapda, savat o'ngda — markazlashtirish olib tashlandi
  titleWrap: { flex: 1, alignItems: 'flex-start' },
  title: { ...text.h2, color: colors.text, letterSpacing: 1, textTransform: 'uppercase' },
  motto: { ...text.tiny, color: colors.accent, letterSpacing: 1, marginTop: 1 },
  cartButton: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },

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
  heroLine: { ...text.h1, color: colors.text, textTransform: 'uppercase', letterSpacing: 2 },
  heroSubtitle: {
    ...text.small,
    color: colors.textMuted,
    marginTop: spacing.sm,
    maxWidth: '70%',
    letterSpacing: 2,
  },

  divider: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.borderStrong },
  dividerDiamond: { color: colors.primary, fontSize: 10 },
  dividerText: { ...text.label, color: colors.text },

  cards: { gap: spacing.md },
  // Rasmlar vertikal (1086×1448), karta esa past va keng. `cover` markazni
  // kesadi va model boshi kadrdan chiqib ketadi, shuning uchun rasm karta
  // balandligidan uzunroq qilinib yuqoriga suriladi — kadrda yelka va yuz qoladi.
  // O'ngdan 4% chekinadi: strelka tugmasi foto ustiga tushmaydi.
  heroImage: { position: 'absolute', right: 0, top: 44, width: '62%', height: 400 },
  // LTR ning ko'zgu aksi. `width` shart — Hero.tsx dagi izohga qarang.
  heroImageRTL: { position: 'absolute', left: 0, top: 44, width: '62%', height: 400 },
  cardImage: { position: 'absolute', right: 0, top: -42, width: '74%', height: 300 },
  cardImageRTL: { position: 'absolute', left: 0, top: -42, width: '80%', height: 300 },
  card: {
    height: 150,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  cardBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
  },
  cardText: { flex: 1 },
  cardTitle: { ...text.h2, color: colors.text, textTransform: 'uppercase' },
  cardSubtitle: { ...text.tiny, color: colors.textMuted, letterSpacing: 2 },
  tagline: { ...text.tiny, marginTop: spacing.xs, letterSpacing: 1.2 },
  chevron: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
