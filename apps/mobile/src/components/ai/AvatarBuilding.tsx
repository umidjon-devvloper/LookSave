import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';

import { Icon } from '../Icon';
import { colors, radius, spacing, text } from '../../theme/tokens';

/**
 * Avatar yasalayotgandagi kutish holati.
 *
 * ⚠️ NEGA ALOHIDA KOMPONENT: bu foydalanuvchi eng uzoq turadigan joy —
 * 15–40 soniya. Oddiy aylanuvchi indikator bu vaqtni cheksiz qilib
 * ko'rsatadi va odam ilovani yopib yuboradi. Kutish esa allaqachon
 * to'langan: kredit sarflangan, natija yo'lda.
 *
 * Uchta narsa kutishni qisqartiradi va uchalasi ham shu yerda:
 *
 *   1. NIMA BO'LAYOTGANINI AYTISH — bosqichlar navbat bilan yonadi,
 *      shunda jarayon qotib qolgandek tuyulmaydi.
 *   2. NATIJANI KO'RSATISH — yuz surati markazda turadi, ya'ni odam
 *      nimadan nima yasalayotganini ko'radi.
 *   3. HARAKAT — aylanuvchi halqa jarayon tirikligini bildiradi.
 */

/**
 * Bosqichlar — haqiqiy ishga mos.
 *
 * ⚠️ VAQTLAR TAXMINIY va ataylab shunday: server bosqichni bilmaydi,
 * u faqat "processing" deydi. Lekin foydalanuvchi uchun muhimi aniq
 * vaqt emas, jarayonning harakatda ekani. Umumiy davomiylik haqiqiy
 * o'rtachadan (≈25 soniya) uzunroq olingan — erta tugab qotib qolgandan
 * ko'ra kech tugagani yaxshi.
 */
const STAGES = [
  { at: 0, label: 'Yuzingiz o`qilmoqda' },
  { at: 6, label: 'O`lchovlaringiz qo`llanmoqda' },
  { at: 14, label: 'Gavda yasalmoqda' },
  { at: 26, label: 'Tafsilotlar chizilmoqda' },
  { at: 38, label: 'Deyarli tayyor' },
];

export function AvatarBuilding({ faceUrl }: { faceUrl: string | null }): JSX.Element {
  const [seconds, setSeconds] = useState(0);
  const spin = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(0)).current;

  // Sekundomer — bosqichlarni almashtirish uchun
  useEffect(() => {
    const timer = setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    /*
     * Ikki animatsiya bir vaqtda: halqa aylanadi, doira esa sekin
     * kattalashib-kichrayadi. Faqat aylanish mexanik ko'rinadi —
     * "nafas olish" unga tiriklik qo'shadi.
     *
     * `useNativeDriver` — ikkalasi ham transform, ya'ni JS oqimidan
     * mustaqil ishlaydi va so'rovlar ketayotganda ham silliq qoladi.
     */
    const rotation = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 2600,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, {
          toValue: 1,
          duration: 1900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(breathe, {
          toValue: 0,
          duration: 1900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );

    rotation.start();
    pulse.start();
    return () => {
      rotation.stop();
      pulse.stop();
    };
  }, [spin, breathe]);

  // Oxirgi o'tilgan bosqich
  const activeIndex = STAGES.reduce(
    (found, stage, index) => (seconds >= stage.at ? index : found),
    0,
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.stage}>
        {/* Tashqi nur — halqa ortidan */}
        <Animated.View
          style={[
            styles.glow,
            {
              transform: [
                { scale: breathe.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1.08] }) },
              ],
              opacity: breathe.interpolate({ inputRange: [0, 1], outputRange: [0.32, 0.62] }),
            },
          ]}
        />

        {/* Aylanuvchi halqa — gradient bilan, boshi va oxiri farqlanadi */}
        <Animated.View
          style={[
            styles.ringWrap,
            {
              transform: [
                {
                  rotate: spin.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '360deg'],
                  }),
                },
              ],
            },
          ]}
        >
          <LinearGradient
            colors={[colors.accent, colors.primary, 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.ring}
          />
        </Animated.View>

        {/* Markazda yuz surati — nimadan yasalayotgani ko'rinib turadi */}
        <View style={styles.face}>
          {faceUrl ? (
            <Image source={{ uri: faceUrl }} style={styles.faceImage} resizeMode="cover" />
          ) : (
            <View style={[styles.faceImage, styles.facePlaceholder]}>
              <Icon name="profile" size={30} color={colors.primary} />
            </View>
          )}
        </View>
      </View>

      <Text style={styles.title}>Avataringiz yasalmoqda</Text>

      {/* Bosqichlar — o'tilgani so'nadi, joriysi yorqin */}
      <View style={styles.stages}>
        {STAGES.map((stage, index) => {
          const passed = index < activeIndex;
          const active = index === activeIndex;

          return (
            <View key={stage.label} style={styles.stageRow}>
              <View style={[styles.dot, passed && styles.dotPassed, active && styles.dotActive]}>
                {passed ? <Icon name="authentic" size={10} color={colors.bg} /> : null}
              </View>
              <Text
                style={[
                  styles.stageText,
                  passed && styles.stageTextPassed,
                  active && styles.stageTextActive,
                ]}
              >
                {stage.label}
              </Text>
            </View>
          );
        })}
      </View>

      <Text style={styles.hint}>
        Bu bir martalik — keyingi safar avatar tayyor turadi va kiyimlar darrov ko`rinadi.
      </Text>
    </View>
  );
}

const RING = 168;

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },

  stage: {
    width: RING,
    height: RING,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  glow: {
    position: 'absolute',
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    backgroundColor: colors.primaryDark,
  },
  ringWrap: { position: 'absolute', width: RING, height: RING },
  ring: { width: RING, height: RING, borderRadius: RING / 2 },

  face: {
    width: RING - 18,
    height: RING - 18,
    borderRadius: (RING - 18) / 2,
    overflow: 'hidden',
    backgroundColor: colors.bg,
    // Halqa bilan surat orasida ingichka bo'shliq — halqa aniq ajralib tursin
    borderWidth: 3,
    borderColor: colors.bg,
  },
  faceImage: { width: '100%', height: '100%' },
  facePlaceholder: {
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  title: { ...text.h2, color: colors.text, textAlign: 'center', marginBottom: spacing.lg },

  stages: { alignSelf: 'stretch', gap: spacing.sm, paddingHorizontal: spacing.md },
  stageRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: {
    width: 18,
    height: 18,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotPassed: { backgroundColor: colors.accent, borderColor: colors.accent },
  dotActive: { borderColor: colors.accent, backgroundColor: colors.primarySoft },

  stageText: { ...text.small, color: colors.textDim, flex: 1 },
  stageTextPassed: { color: colors.textMuted },
  stageTextActive: { color: colors.text, fontWeight: '600' },

  hint: {
    ...text.tiny,
    color: colors.textDim,
    textAlign: 'center',
    marginTop: spacing.xl,
    paddingHorizontal: spacing.md,
  },
});
