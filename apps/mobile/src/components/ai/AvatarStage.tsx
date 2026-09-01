import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, text } from '../../theme/tokens';

/**
 * Avatar sahnasi — mijoz maketidagi ko'rinish.
 *
 * Qorong'i fon, to'r chiziqlari, gavda atrofidagi neon halqalar va chetdagi
 * o'lchov yozuvlari. Odam bularning orasida turadi.
 *
 * ⚠️ 3D EMAS, KOMPOZITSIYA. Maketdagi rasm ham 3D render emas —
 * fotorealistik surat ustiga qo'yilgan bezak. Shuni takrorlaymiz: AI
 * yasagan (yoki foydalanuvchi yuklagan) suratdan odam kesib olinadi va
 * shu sahnaga qo'yiladi.
 *
 * Bu yondashuvning ustunligi: sahna BEPUL va DARHOL chiziladi, har
 * o'zgarishda AI chaqirilmaydi.
 *
 * ⚠️ KESIM BO'LMASA HAM ISHLAYDI. `cutoutUrl` yo'q bo'lsa oddiy surat
 * ko'rsatiladi — u och kulrang fonli bo'ladi, lekin ekran buzilmaydi.
 * Kesim serverda yasaladi va u yerda nosozlik bo'lishi mumkin.
 */

export interface StageMeasurements {
  height?: number;
  weight?: number;
  waist?: number;
  shoeSize?: number;
}

export function AvatarStage({
  imageUrl,
  cutoutUrl,
  measurements,
  dimmed = false,
  showRings = true,
  children,
}: {
  imageUrl: string | null;
  cutoutUrl?: string | null;
  measurements?: StageMeasurements;
  /** Kutish paytida surat xiralashadi */
  dimmed?: boolean;
  /** Halqalar va o'lchovlar — kiyintirish paytida chalg'itmasin uchun o'chiriladi */
  showRings?: boolean;
  /**
   * Suratning O'RNIGA qo'yiladigan tarkib — svayp tasmasi uchun.
   *
   * ⚠️ NEGA ALMASHTIRADI, USTIGA QO'SHMAYDI. Svayp tasmasi o'zi surat
   * chizadi; ostida yana bir `<Image>` qolsa, karta qiyshayganda uning
   * chetidan eski surat ko'rinib turardi.
   *
   * Sahnaning qolgan bezagi (to'r, platforma, halqalar, o'lchovlar)
   * saqlanadi — ular tasma ustidan o'tadi va maketdagi ko'rinish
   * buzilmaydi.
   */
  children?: ReactNode;
}): JSX.Element {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    /*
     * Halqalar sekin "nafas oladi". Aylanish emas, kattalashib-kichrayish:
     * aylanish e'tiborni tortadi va kiyimga qarashga xalaqit qiladi,
     * sekin puls esa sahnani tirik qiladi, lekin ko'zni charchatmaydi.
     */
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 2600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 2600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1.03] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0.95] });

  // Kesim bor bo'lsa u ustun: faqat u qorong'i fonda to'g'ri ko'rinadi
  const source = cutoutUrl ?? imageUrl;

  return (
    <View style={styles.root}>
      {/* To'r — maketdagi kabi, juda past kontrastda */}
      <View style={styles.grid} pointerEvents="none">
        {Array.from({ length: 14 }, (_, index) => (
          <View key={`h${index}`} style={[styles.gridLine, { top: `${(index + 1) * 7}%` }]} />
        ))}
        {Array.from({ length: 8 }, (_, index) => (
          <View key={`v${index}`} style={[styles.gridLineV, { left: `${(index + 1) * 12}%` }]} />
        ))}
      </View>

      {/* Pastdagi nur — odam "platforma" ustida turgandek */}
      <Animated.View style={[styles.floorGlow, { opacity }]} pointerEvents="none">
        <LinearGradient
          colors={['rgba(139,92,246,0.28)', 'rgba(139,92,246,0)']}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/*
        Oyoq ostidagi platforma — odamdan OLDIN, ya'ni uning ORQASIDA.

        ⚠️ TARTIB MUHIM: React Native da keyingi element ustga tushadi.
        Platforma odamdan keyin chizilsa halqa oyoq ustidan o'tib ketadi va
        odam platforma ichida emas, uning orqasida turgandek ko'rinadi.
      */}
      {showRings ? (
        <Animated.View
          style={[styles.platform, { transform: [{ scaleX: scale }] }]}
          pointerEvents="none"
        >
          <View style={styles.platformRing} />
        </Animated.View>
      ) : null}

      {children ? (
        <View style={[StyleSheet.absoluteFill, dimmed && styles.dimmed]}>{children}</View>
      ) : source ? (
        <Image
          source={{ uri: source }}
          style={[styles.person, dimmed && styles.dimmed]}
          resizeMode="contain"
        />
      ) : (
        <View style={styles.person} />
      )}

      {/*
        Halqalar odam USTIDAN o'tadi — maketda ham shunday: ular gavdani
        "skanerlayotgandek" ko'rinadi. Shuning uchun ular odamdan keyin.
      */}
      {showRings ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {/*
            ⚠️ ELLIPS, TO'G'RI CHIZIQ EMAS. Ilgari bu gorizontal gradient
            chiziq edi va gavdani KESIB o'tgandek ko'rinardi. Maketda esa
            halqa gavdani O'RAB oladi — old tomoni odamning ustidan,
            orqa tomoni ostidan o'tadi.
            
            To'liq o'rash uchun halqani ikkiga bo'lish kerak bo'lardi
            (yarmi odam ostida, yarmi ustida) va bu kesim shaklini
            bilishni talab qiladi — biz uni bilmaymiz. Shuning uchun
            yassi ellips ishlatiladi: perspektivada ko'rilgan halqa
            aynan shunday ko'rinadi va ko'z uni o'ralgan deb qabul
            qiladi.
          */}
          {[0.34, 0.56].map((top) => (
            <Animated.View
              key={top}
              style={[styles.ring, { top: `${top * 100}%`, transform: [{ scaleX: scale }] }]}
            >
              <View style={styles.ringEllipse} />
            </Animated.View>
          ))}
        </View>
      ) : null}

      {/* O'lchovlar — maketdagi joylashuvda */}
      {showRings && measurements ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {measurements.height ? (
            <Label value={String(Math.round(measurements.height))} unit="cm" pos="topLeft" />
          ) : null}
          {measurements.weight ? (
            <Label value={String(Math.round(measurements.weight))} unit="kg" pos="midRight" />
          ) : null}
          {measurements.waist ? (
            <Label value={String(Math.round(measurements.waist))} unit="cm" pos="lowLeft" />
          ) : null}
          {measurements.shoeSize ? (
            <Label value={String(Math.round(measurements.shoeSize))} unit="EU" pos="lowRight" />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const POSITIONS = {
  topLeft: { top: '10%', left: spacing.md },
  midRight: { top: '46%', right: spacing.md },
  lowLeft: { top: '68%', left: spacing.md },
  lowRight: { top: '82%', right: spacing.md },
} as const;

function Label({
  value,
  unit,
  pos,
}: {
  value: string;
  unit: string;
  pos: keyof typeof POSITIONS;
}): JSX.Element {
  return (
    <View style={[styles.label, POSITIONS[pos]]}>
      <Text style={styles.labelValue}>{value}</Text>
      <Text style={styles.labelUnit}>{unit}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  /*
   * ⚠️ SOF QORA, brend foni (#0A0A0F) emas. Sahna ilova fonidan
   * SEZILARLI qorong'iroq bo'lishi kerak — aks holda ramka bilinmaydi va
   * "sahna" hissi yo'qoladi.
   */
  root: {
    flex: 1,
    backgroundColor: '#050509',
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },

  grid: { ...StyleSheet.absoluteFillObject, opacity: 0.5 },
  gridLine: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: colors.border },
  gridLineV: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: colors.border },

  /*
   * ⚠️ TOR VA PAST. Avval kadrning 70% kengligi va 18% balandligi edi —
   * oyoq ostida katta binafsha dog' bo'lib turardi va sahnaning eng
   * ko'zga tashlanadigan qismiga aylanib qolgandi. Nur odamni FONDAN
   * ajratish uchun, o'ziga e'tibor tortish uchun emas.
   */
  floorGlow: {
    position: 'absolute',
    left: '30%',
    right: '30%',
    bottom: 0,
    height: '10%',
    borderRadius: 999,
    overflow: 'hidden',
  },

  /*
   * ⚠️ PASTDA JOY QOLDIRILADI. Boshqaruv tugmalari sahna ostida yotiq qator
   * bo'lib turadi va odam to'liq ekranni egallasa, ular oyoq ustiga
   * tushadi. 14% — tugmalar balandligi va biroz nafas.
   */
  person: { position: 'absolute', top: 0, left: 0, right: 0, bottom: '14%' },
  dimmed: { opacity: 0.35 },

  /*
   * ⚠️ KENGLIK GAVDAGA YAQIN. Avval 12% edi — halqa deyarli butun kadrni
   * egallab, gavdani o'ragandek emas, ustidan o'tgan katta to'rtburchakdek
   * ko'rinardi. Odam kadrning o'rtadagi ~45% ini egallaydi, halqa esa
   * undan bir oz kengroq bo'lishi kerak.
   */
  ring: { position: 'absolute', left: '27%', right: '27%', height: 26, justifyContent: 'center' },
  /*
   * Ellips — balandligi kichik, `borderRadius` esa yarmiga teng.
   * Faqat CHEGARA bo'yaladi, ichi shaffof: to'ldirilsa u odamni
   * bekitardi.
   */
  ringEllipse: {
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: colors.accent,
    // Neon taassuroti — chegara atrofidagi yorug'lik
    shadowColor: colors.accent,
    shadowOpacity: 0.9,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },

  platform: {
    position: 'absolute',
    left: '30%',
    right: '30%',
    bottom: '13%',
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  platformRing: {
    width: '100%',
    height: 40,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.accent,
    opacity: 0.75,
  },

  label: { position: 'absolute' },
  labelValue: { ...text.h3, color: colors.text, fontVariant: ['tabular-nums'] },
  labelUnit: { ...text.tiny, color: colors.textMuted, marginTop: -2 },
});
