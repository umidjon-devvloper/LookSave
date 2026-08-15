import { LinearGradient } from 'expo-linear-gradient';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import type { View as RNView } from 'react-native';
import { Animated, Easing, StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { useSplashTargetStore, type SplashLanding } from '../store/splashTargetStore';
import { images } from '../theme/images';
import { colors, fonts } from '../theme/tokens';

/**
 * Ilova ochilgandagi brend animatsiyasi — native splash (app.json §splash) dan
 * keyin darhol ustiga chiqadi va ekranni to'suvchi qatlam bo'lib qoladi.
 *
 * NEGA SHUNDAY: native splash statik rasm, uni jonlantirib bo'lmaydi. Shuning
 * uchun bir xil fon (#0A0A0F) va bir xil belgi bilan JS qatlami chiziladi —
 * foydalanuvchi uchun bu bitta uzluksiz sahna bo'lib ko'rinadi. Native splash
 * aynan shu qatlam chizilgandan keyin yashiriladi (`onLayout`), shuning uchun
 * oradagi bo'sh kadr ko'rinmaydi.
 *
 * Sahna: belgi kattalashib chiqadi → orqasidan binafsha nur yoyiladi →
 * "LOOK SAVE" harflari birma-bir tushadi → tag chizig'i markazdan o'sadi.
 *
 * Chiqish ikki xil bo'ladi:
 *  1. **Qo'nish (shared element)** — ilova ichidagi haqiqiy logotip o'z o'rnini
 *     `useSplashLanding()` orqali bildirgan bo'lsa, splash logotipi o'sha joyga
 *     uchib borib kichrayadi va aynan ustiga tushadi. Fon esa yo'lda erib
 *     ketadi, shuning uchun splash ilovaga "aylanib ketgandek" ko'rinadi.
 *  2. **Erish** — nishon topilmasa (o'lchov kechikdi yoki ekranda logotip yo'q),
 *     sahna oldinga siljib shaffoflashadi. Ya'ni hech qachon buzilmaydi.
 *
 * ⚠️ Barcha animatsiyalar `useNativeDriver: true` bilan ishlaydi — shuning uchun
 * faqat `opacity` va `transform` jonlantirilgan. Chiziq eni `width` emas,
 * `scaleX` orqali o'sadi (`width` native driverda qo'llab-quvvatlanmaydi).
 */

const WORDMARK = 'LOOK SAVE';
const LETTERS = WORDMARK.split('');

/** logo-mark.png ning tabiiy nisbati (1254×878) — qutini shunga moslaymiz,
 *  shunda `contain` qutini to'liq to'ldiradi va qo'nishda siljish bo'lmaydi. */
const LOGO_ASPECT = 1254 / 878;

/** Harflar tugagach sahna shuncha ushlab turiladi — ko'z ilg'ashi uchun */
const HOLD_MS = 320;
/** Harflar boshlanish payti (belgi va nur allaqachon joyida bo'ladi) */
const LETTERS_DELAY_MS = 520;
const LETTER_STAGGER_MS = 52;

/**
 * Nishon kechiksa shuncha kutamiz. Uy ekrani avval mahsulotlarni yuklaydi va
 * logotip qatori shundan keyingina chiziladi — qisqa kutish qo'nish effektini
 * saqlab qoladi, kutish cho'zilsa esa erish bilan yopamiz.
 */
const LANDING_WAIT_MS = 700;

type Props = {
  /** Shriftlar yuklandimi — yuklanmaguncha Inter o'rniga tizim shrifti ishlaydi */
  fontsLoaded: boolean;
  /** Ilova (shrift + sessiya tiklash) tayyormi — tayyor bo'lmasa sahna kutadi */
  appReady: boolean;
  /** Chiqish animatsiyasi tugadi, qatlamni olib tashlash mumkin */
  onFinish: () => void;
};

export function AnimatedSplash({ fontsLoaded, appReady, onFinish }: Props): JSX.Element {
  const { width } = useWindowDimensions();
  const logoWidth = Math.min(width * 0.52, 240);
  const logoHeight = logoWidth / LOGO_ASPECT;
  const glowSize = logoWidth * 2.3;

  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.72)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;
  const glowScale = useRef(new Animated.Value(0.5)).current;
  const lineScale = useRef(new Animated.Value(0)).current;
  // Har bir harf o'z qiymati bilan juftlangan — indeks bo'yicha qidirilmaydi
  const letters = useRef(LETTERS.map((char) => ({ char, value: new Animated.Value(0) }))).current;

  // Nur "nafas olishi" — ilova sekin yuklansa sahna qotib qolmasligi uchun
  const breath = useRef(new Animated.Value(0)).current;

  // ── Chiqish qiymatlari ──
  /** Qo'nish yo'li: 0 → markaz, 1 → nishon ustida */
  const flight = useRef(new Animated.Value(0)).current;
  const bgOpacity = useRef(new Animated.Value(1)).current;
  const captionOpacity = useRef(new Animated.Value(1)).current;
  /** Erish yo'li (nishon topilmaganda) */
  const rootOpacity = useRef(new Animated.Value(1)).current;
  const exitScale = useRef(new Animated.Value(1)).current;

  // Uchish masofasi o'lchovdan keyin ma'lum bo'ladi, lekin `transform` render
  // paytida kerak — shuning uchun interpolyatsiya diapazoni holatda saqlanadi.
  const [flightTo, setFlightTo] = useState<{ dx: number; dy: number; scale: number } | null>(null);
  const [introDone, setIntroDone] = useState(false);

  const logoRef = useRef<RNView>(null);

  // ── Kirish sahnasi ──
  useEffect(() => {
    const intro = Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 420,
        delay: 60,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        delay: 60,
        damping: 11,
        stiffness: 90,
        mass: 0.9,
        useNativeDriver: true,
      }),
      Animated.timing(glowOpacity, {
        toValue: 1,
        duration: 520,
        delay: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(glowScale, {
        toValue: 1,
        duration: 760,
        delay: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(LETTERS_DELAY_MS),
        Animated.stagger(
          LETTER_STAGGER_MS,
          letters.map(({ value }) =>
            Animated.timing(value, {
              toValue: 1,
              duration: 260,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
          ),
        ),
      ]),
      Animated.sequence([
        Animated.delay(LETTERS_DELAY_MS + LETTERS.length * LETTER_STAGGER_MS),
        Animated.timing(lineScale, {
          toValue: 1,
          duration: 420,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]);

    const scene = Animated.sequence([intro, Animated.delay(HOLD_MS)]);
    scene.start(({ finished }) => {
      if (finished) setIntroDone(true);
    });

    return () => scene.stop();
  }, [glowOpacity, glowScale, letters, lineScale, logoOpacity, logoScale]);

  // ── Nafas olish: kirish tugagach, ilova hali tayyor bo'lmasa aylanib turadi ──
  useEffect(() => {
    if (!introDone || appReady) return;

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(breath, {
          toValue: 0,
          duration: 1100,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();

    return () => loop.stop();
  }, [appReady, breath, introDone]);

  // ── Chiqish ──
  useEffect(() => {
    if (!introDone || !appReady) return;

    let cancelled = false;
    let running: Animated.CompositeAnimation | null = null;

    /** Nishon ustiga uchib qo'nish */
    const landOn = (to: { dx: number; dy: number; scale: number }): void => {
      setFlightTo(to);
      running = Animated.parallel([
        // Yozuv va chiziq darhol chetga chiqadi — diqqat logotipda qoladi
        Animated.timing(captionOpacity, {
          toValue: 0,
          duration: 240,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(glowOpacity, {
          toValue: 0,
          duration: 340,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        // Logotip yo'lga chiqadi
        Animated.sequence([
          Animated.delay(140),
          Animated.timing(flight, {
            toValue: 1,
            duration: 620,
            // Sekin uzilib, tez ketib, nishon oldida yumshoq to'xtaydi
            easing: Easing.bezier(0.55, 0.06, 0.2, 1),
            useNativeDriver: true,
          }),
        ]),
        // Fon yo'lning o'rtasida eriydi — ilova logotip yetib borgunicha ochiladi
        Animated.sequence([
          Animated.delay(260),
          Animated.timing(bgOpacity, {
            toValue: 0,
            duration: 460,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ]);
      running.start(({ finished }) => {
        if (finished) onFinish();
      });
    };

    /** Zaxira: nishon yo'q — sahna oldinga siljib eriydi */
    const dissolve = (): void => {
      running = Animated.parallel([
        Animated.timing(rootOpacity, {
          toValue: 0,
          duration: 460,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(exitScale, {
          toValue: 1.14,
          duration: 520,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]);
      running.start(({ finished }) => {
        if (finished) onFinish();
      });
    };

    /** Nishon aniq bo'lgach yo'lni hisoblab, tegishli chiqishni boshlaydi */
    const begin = (landing: SplashLanding | null): void => {
      if (cancelled) return;
      const node = logoRef.current;
      if (!landing || !node) {
        dissolve();
        return;
      }
      // Ikkala nuqta ham `measureInWindow` dan olinadi — bir xil koordinata
      // tizimi, shuning uchun Android status bar kabi ofsetlar o'z-o'zidan
      // qisqaradi va qo'lda tuzatish kerak bo'lmaydi.
      node.measureInWindow((x, y, w, h) => {
        if (cancelled) return;
        if (w > 0 && h > 0) {
          landOn({
            dx: landing.x + landing.width / 2 - (x + w / 2),
            dy: landing.y + landing.height / 2 - (y + h / 2),
            scale: landing.width / w,
          });
        } else {
          dissolve();
        }
      });
    };

    let unsubscribe: (() => void) | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const ready = useSplashTargetStore.getState().landing;
    if (ready) {
      begin(ready);
    } else {
      // Ekran hali yuklanmoqda — logotip paydo bo'lishini qisqa kutamiz
      unsubscribe = useSplashTargetStore.subscribe((state) => {
        if (!state.landing) return;
        unsubscribe?.();
        clearTimeout(timer);
        begin(state.landing);
      });
      timer = setTimeout(() => {
        unsubscribe?.();
        begin(null);
      }, LANDING_WAIT_MS);
    }

    return () => {
      cancelled = true;
      running?.stop();
      unsubscribe?.();
      clearTimeout(timer);
    };
  }, [
    appReady,
    bgOpacity,
    captionOpacity,
    exitScale,
    flight,
    glowOpacity,
    introDone,
    onFinish,
    rootOpacity,
  ]);

  // Native splashni aynan shu qatlam chizilgandan keyin yashiramiz
  const handleLayout = (): void => {
    void SplashScreen.hideAsync().catch(() => {
      // Splash allaqachon yashiringan bo'lishi mumkin — bu xato emas
    });
  };

  const breathScale = breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.09] });
  const breathOpacity = breath.interpolate({ inputRange: [0, 1], outputRange: [1, 0.72] });

  // `flightTo` hali yo'q bo'lsa diapazon [0,0] — ya'ni harakat yo'q
  const flightX = flight.interpolate({ inputRange: [0, 1], outputRange: [0, flightTo?.dx ?? 0] });
  const flightY = flight.interpolate({ inputRange: [0, 1], outputRange: [0, flightTo?.dy ?? 0] });
  const flightScale = flight.interpolate({
    inputRange: [0, 1],
    outputRange: [1, flightTo?.scale ?? 1],
  });

  // Shrift hali yuklanmagan bo'lsa `fontFamily` berib bo'lmaydi — RN "Unrecognized
  // font family" deb yozadi va harflar ko'rinmay qoladi
  const wordmarkFont = fontsLoaded ? { fontFamily: fonts.bold } : { fontWeight: '700' as const };

  return (
    <Animated.View
      pointerEvents="none"
      onLayout={handleLayout}
      style={[
        StyleSheet.absoluteFill,
        styles.root,
        { opacity: rootOpacity, transform: [{ scale: exitScale }] },
      ]}
    >
      {/* Fon alohida qatlam: qo'nish paytida u yolg'iz eriydi, logotip qoladi */}
      <Animated.View style={[StyleSheet.absoluteFill, styles.bg, { opacity: bgOpacity }]} />

      {/* Binafsha nur — belgidan orqada, radial gradient */}
      <Animated.View
        style={[
          styles.glow,
          {
            width: glowSize,
            height: glowSize,
            marginLeft: -glowSize / 2,
            marginTop: -glowSize / 2,
            opacity: Animated.multiply(glowOpacity, breathOpacity),
            transform: [{ scale: Animated.multiply(glowScale, breathScale) }],
          },
        ]}
      >
        <Svg width={glowSize} height={glowSize}>
          <Defs>
            <RadialGradient id="looksaveGlow" cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0%" stopColor={colors.primary} stopOpacity={0.5} />
              <Stop offset="45%" stopColor={colors.primary} stopOpacity={0.16} />
              <Stop offset="100%" stopColor={colors.primary} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={glowSize / 2} cy={glowSize / 2} r={glowSize / 2} fill="url(#looksaveGlow)" />
        </Svg>
      </Animated.View>

      {/* Uchuvchi logotip. O'lchash uchun `collapsable={false}` shart (Android) */}
      <Animated.View
        ref={logoRef}
        collapsable={false}
        style={{
          width: logoWidth,
          height: logoHeight,
          transform: [{ translateX: flightX }, { translateY: flightY }, { scale: flightScale }],
        }}
      >
        <Animated.Image
          source={images.logoMark}
          resizeMode="contain"
          style={{
            width: '100%',
            height: '100%',
            opacity: logoOpacity,
            transform: [{ scale: logoScale }],
          }}
        />
      </Animated.View>

      <Animated.View
        style={[styles.caption, { marginTop: logoHeight / 2 + 22, opacity: captionOpacity }]}
      >
        <View style={styles.wordmarkRow}>
          {letters.map(({ char, value }, index) => (
            <Animated.Text
              // Harflar ro'yxati o'zgarmaydi — indeks kalit sifatida xavfsiz
              key={`${char}-${index}`}
              style={[
                styles.letter,
                wordmarkFont,
                char === ' ' && styles.letterSpace,
                {
                  opacity: value,
                  transform: [
                    { translateY: value.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
                  ],
                },
              ]}
            >
              {char}
            </Animated.Text>
          ))}
        </View>

        <Animated.View style={[styles.lineWrap, { transform: [{ scaleX: lineScale }] }]}>
          <LinearGradient
            colors={['transparent', colors.accent, 'transparent']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.line}
          />
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
    // Ilova ustida turishi shart
    zIndex: 10,
  },
  bg: { backgroundColor: colors.bg },
  glow: { position: 'absolute', top: '50%', left: '50%' },
  // Logotipdan pastda — oqimdan tashqarida, shunda logotip aniq markazda qoladi
  caption: { position: 'absolute', top: '50%', left: 0, right: 0, alignItems: 'center' },
  wordmarkRow: { flexDirection: 'row' },
  letter: {
    color: colors.text,
    fontSize: 18,
    lineHeight: 24,
    // Harflar alohida View bo'lgani uchun oraliq `letterSpacing` emas, `marginLeft`
    marginLeft: 5,
  },
  letterSpace: { width: 10 },
  lineWrap: { marginTop: 16, width: 140, alignItems: 'center' },
  line: { width: 140, height: 1.5, borderRadius: 1 },
});
