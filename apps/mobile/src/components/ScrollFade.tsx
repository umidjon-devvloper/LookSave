import { LinearGradient } from 'expo-linear-gradient';
import { Animated, StyleSheet, View } from 'react-native';

import { colors } from '../theme/tokens';

/**
 * Ekran tepasidagi fon — status bar va sarlavha qatori ORQASIDA.
 *
 * ⚠️ NIMA MUAMMONI YECHADI. `headerShown: false` bo'lgan ekranlarda
 * (`(tabs)`, `ai`, `seller`) native header yo'q, ya'ni scroll qilinganda
 * kontent to'g'ridan-to'g'ri status bar ostidan o'tadi va soat/batareya
 * bilan ustma-ust tushib o'qilmay qoladi. Profile ekranida bu aniq
 * ko'rinardi: avatar doirasi soat ustiga chiqib turardi.
 *
 * Yechim — scroll bilan ochiladigan tekis qora band. Ro'yxatning O'ZIDA
 * emas, USTIDA: ichida bo'lsa u ham scroll bilan ketardi.
 *
 * ⚠️ IKKI QATLAM. Tekis `colors.bg` va uning pastki chetida 24px gradient.
 * Gradientsiz qora blokning pastki chegarasi kontent ustida keskin chiziq
 * bo'lib ko'rinadi.
 *
 * ⚠️ `useNativeDriver` BILAN ISHLASHI SHART. `opacity` interpolatsiyasi UI
 * oqimida hisoblanadi, ya'ni JS band bo'lsa ham (rasm yuklash, sahifalash)
 * band kechikmaydi. Shuning uchun chaqiruvchi `onScroll` da hech qanday
 * JS ishi qilmasligi kerak.
 *
 * Ishlatish:
 *
 *   const scrollY = useRef(new Animated.Value(0)).current;
 *   ...
 *   <Animated.ScrollView
 *     scrollEventThrottle={16}
 *     onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
 *       useNativeDriver: true,
 *     })}
 *   >…</Animated.ScrollView>
 *   <ScrollFade scrollY={scrollY} height={insets.top + 56} />
 */
export function ScrollFade({
  scrollY,
  height,
  /**
   * Necha px scroll qilinganda fon TO'LIQ qorayadi. 100 — sukut: shu
   * masofada tepadagi blok (hero, avatar) header ostidan o'tib bo'ladi.
   */
  distance = 100,
}: {
  scrollY: Animated.Value;
  height: number;
  distance?: number;
}): JSX.Element {
  const opacity = scrollY.interpolate({
    inputRange: [0, distance],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View style={[styles.fade, { height, opacity }]} pointerEvents="none">
      <View style={styles.solid} />
      <LinearGradient colors={[colors.bg, 'rgba(10,10,15,0)']} style={styles.edge} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fade: { position: 'absolute', top: 0, left: 0, right: 0 },
  solid: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.bg },
  edge: { position: 'absolute', left: 0, right: 0, bottom: -24, height: 24 },
});
