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
import { useOnboardingStore } from '../src/store/onboardingStore';
import { colors, radius, spacing, text } from '../src/theme/tokens';

const STORE_ART = require('../assets/seller-onboarding-store-v1.png');
const PRODUCTS_ART = require('../assets/seller-onboarding-products-v1.png');
const ANALYTICS_ART = require('../assets/seller-onboarding-analytics-v1.png');

interface Slide {
  id: string;
  image: ImageSourcePropType;
  title: string;
  body: string;
}

const SLIDES: Slide[] = [
  {
    id: 'store',
    image: STORE_ART,
    title: 'O‘z do‘koningizni\nyarating',
    body: 'Bir necha daqiqada do‘kon oching\nva mahsulotlaringizni katalogga\nqo‘shing.',
  },
  {
    id: 'products',
    image: PRODUCTS_ART,
    title: 'Mahsulotlaringizni\nboshqaring',
    body: 'Rasmlar, narx, kategoriya, o‘lcham\nva zaxirani qulay tarzda\ntasdiqlang.',
  },
  {
    id: 'analytics',
    image: ANALYTICS_ART,
    title: 'Sotuvlarni kuzating\nva rivojlantiring',
    body: 'Buyurtmalar, ko‘rishlar va statistika\norqali do‘koningiz samaradorligini\noshiring.',
  },
];

export default function Onboarding(): JSX.Element {
  const router = useRouter();
  const complete = useOnboardingStore((state) => state.complete);
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
          <Text style={styles.wordmarkSeller}> · SELLER</Text>
        </Text>
        <Pressable accessibilityRole="button" hitSlop={12} onPress={finish}>
          <Text style={styles.skip}>O‘tkazib yuborish</Text>
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
              <View style={styles.artGlow} />
              <Image source={item.image} style={styles.art} resizeMode="contain" />
            </View>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.body}>{item.body}</Text>
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
            <Text style={styles.ctaText}>{last ? 'Boshlash' : 'Keyingi'}</Text>
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
  wordmarkSeller: { color: colors.textMuted, fontWeight: '600' },
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
