import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
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
}: {
  imageUrl: string | null;
  cutoutUrl?: string | null;
  measurements?: StageMeasurements;
  /** Kutish paytida surat xiralashadi */
  dimmed?: boolean;
  /** Halqalar va o'lchovlar — kiyintirish paytida chalg'itmasin uchun o'chiriladi */
  showRings?: boolean;
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
          colors={['rgba(139,92,246,0.45)', 'rgba(139,92,246,0)']}
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

      {source ? (
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
          {[0.32, 0.54, 0.74].map((top) => (
            <Animated.View
              key={top}
              style={[styles.ring, { top: `${top * 100}%`, transform: [{ scaleX: scale }] }]}
            >
              <LinearGradient
                colors={['rgba(192,132,252,0)', colors.accent, 'rgba(192,132,252,0)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.ringLine}
              />
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

  floorGlow: {
    position: 'absolute',
    left: '15%',
    right: '15%',
    bottom: 0,
    height: '18%',
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

  ring: { position: 'absolute', left: '14%', right: '14%', height: 3, justifyContent: 'center' },
  ringLine: { height: 3, borderRadius: 2 },

  platform: {
    position: 'absolute',
    left: '18%',
    right: '18%',
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
