import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ImageSourcePropType,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '../src/components/Icon';
import { useI18n, type Dictionary } from '../src/i18n';
import { useOnboardingStore } from '../src/store/onboardingStore';
import { colors, radius, spacing, text } from '../src/theme/tokens';

const AVATAR_ART = require('../assets/profile-avatar-icon.png');
const FITTING_ART = require('../assets/tryon-boutique-male-v1.png');
const ORDER_ART = require('../assets/seller-orders-empty-v2.png');

/*
 * ⚠️ UCH SLAYD — ILOVA NIMA QILISHI: avatar → AI kiyintirish → buyurtma.
 * 2026-11-17 gacha bu yerda sotuvchi uchun slaydlar turardi («do'kon oching,
 * mahsulot boshqaring, sotuvni kuzating») va ular HAR BIR yangi
 * foydalanuvchiga, shu jumladan xaridorga ham ko'rsatilardi — ilovaning
 * asosiy ishi (o'zingda kiyib ko'rish) haqida esa bir og'iz gap yo'q edi.
 * App Store 4.3(b) aynan «konsepsiya» ni so'raydi; birinchi ekran shunga
 * javob berishi kerak. Sotuvchi yo'li profilda («Do'kon ochish»).
 *
 * Matnlar lug'atdan (`t.onboarding.*`) — to'rt tilda. Ilgari ular shu yerda
 * o'zbekcha qattiq yozilgan edi: inglizcha telefonda ilova ochilishi bilan
 * birinchi ekran o'zbekcha, qolgani inglizcha chiqardi.
 */
type OnboardingKey = keyof Dictionary['onboarding'];

interface Slide {
  id: string;
  image: ImageSourcePropType;
  /** `framed` — rasmning o'z foni bor, yumaloq ramkada; `small` — kichik manba, kattalashtirilmaydi */
  shape: 'art' | 'small' | 'framed';
  title: OnboardingKey;
  body: OnboardingKey;
}

const SLIDES: Slide[] = [
  { id: 'avatar', image: AVATAR_ART, shape: 'small', title: 'slide1Title', body: 'slide1Body' },
  { id: 'tryon', image: FITTING_ART, shape: 'framed', title: 'slide2Title', body: 'slide2Body' },
  { id: 'order', image: ORDER_ART, shape: 'art', title: 'slide3Title', body: 'slide3Body' },
];

export default function Onboarding(): JSX.Element {
  const router = useRouter();
  const complete = useOnboardingStore((state) => state.complete);
  const t = useI18n((state) => state.t);
  const { width } = useWindowDimensions();
  const listRef = useRef<FlatList<Slide>>(null);
  const [index, setIndex] = useState(0);
  const last = index === SLIDES.length - 1;

  const finish = (): void => {
    complete();
    router.replace('/(tabs)');
  };

  const next = (): void => {
    if (last) return finish();
    const nextIndex = index + 1;
    setIndex(nextIndex);
    listRef.current?.scrollToOffset({ offset: nextIndex * width, animated: true });
  };

  const onScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>): void => {
    setIndex(Math.round(event.nativeEvent.contentOffset.x / width));
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <LinearGradient
        colors={['#FFFFFF', '#FBF8FF', '#F1E8FF']}
        locations={[0, 0.62, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.topbar}>
        <Text style={styles.wordmark}>
          LOOK<Text style={styles.wordmarkAccent}>SAVE</Text>
        </Text>
        <Pressable accessibilityRole="button" hitSlop={12} onPress={finish}>
          <Text style={styles.skip}>{t.onboarding.skip}</Text>
        </Pressable>
      </View>
      <FlatList
        ref={listRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        onMomentumScrollEnd={onScrollEnd}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width }]}>
            <View style={styles.artStage}>
              {item.shape === 'framed' ? (
                <Image source={item.image} style={styles.artFramed} resizeMode="cover" />
              ) : (
                <>
                  <View style={styles.artGlow} />
                  <Image
                    source={item.image}
                    style={item.shape === 'small' ? styles.artSmall : styles.art}
                    resizeMode="contain"
                  />
                </>
              )}
            </View>
            <Text style={styles.title}>{t.onboarding[item.title]}</Text>
            <Text style={styles.body}>{t.onboarding[item.body]}</Text>
          </View>
        )}
      />
      <View style={styles.bottom}>
        <View style={styles.dots}>
          {SLIDES.map((item, itemIndex) => (
            <View key={item.id} style={[styles.dot, itemIndex === index && styles.dotActive]} />
          ))}
        </View>
        <Pressable accessibilityRole="button" onPress={next}>
          <LinearGradient
            colors={[colors.accent, colors.primaryDim]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.cta}
          >
            <Text style={styles.ctaText}>{last ? t.onboarding.start : t.onboarding.next}</Text>
            <Icon name={last ? 'check' : 'next'} size={22} color={colors.textOnPrimary} />
          </LinearGradient>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  topbar: {
    height: 70,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 2,
  },
  wordmark: {
    ...text.bodyMed,
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  wordmarkAccent: { color: colors.accent },
  skip: { ...text.small, color: colors.textMuted, fontWeight: '600' },
  slide: { flex: 1, alignItems: 'center', paddingHorizontal: spacing.xl },
  artStage: {
    width: '100%',
    height: '52%',
    minHeight: 300,
    maxHeight: 430,
    alignItems: 'center',
    justifyContent: 'center',
  },
  artGlow: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(139,44,245,0.08)',
  },
  art: { width: '93%', height: '93%' },
  // 480 px manba — kattaroq chizilsa xira tortadi
  artSmall: { width: 230, height: 230 },
  // Kiyinish xonasi surati (941×1672) — bo'yiga, yumaloq ramkada
  artFramed: { height: '94%', aspectRatio: 941 / 1672, borderRadius: radius.xxl },
  title: {
    ...text.h1,
    color: colors.text,
    textAlign: 'center',
    fontSize: 31,
    lineHeight: 37,
    marginTop: spacing.sm,
  },
  body: {
    ...text.body,
    color: colors.textMuted,
    textAlign: 'center',
    fontSize: 16,
    lineHeight: 24,
    marginTop: spacing.md,
  },
  bottom: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, gap: spacing.xl },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 10 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#E3D9EF' },
  dotActive: { backgroundColor: colors.primary },
  cta: {
    height: 58,
    borderRadius: radius.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    shadowColor: colors.primary,
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 9 },
  },
  ctaText: { ...text.h3, color: colors.textOnPrimary },
});
