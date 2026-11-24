import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet } from 'react-native';

import { colors } from '../theme/tokens';

/**
 * Yoqish/o'chirish kaliti — tizimning `Switch` i o'rniga.
 *
 * ⚠️ NEGA O'ZIMIZNIKI (2026-11-24). RN 0.81 (yangi arxitektura) + iOS 26/27
 * da tizim `Switch` i noto'g'ri o'lchanadi: uzun matn yonida kartadan o'ngga
 * chiqib kesiladi, o'chiq holati oq fonda deyarli ko'rinmaydi va simulyatorda
 * bosishga ham, surishga ham javob bermadi (`app/gift.tsx` dagi kalitda ham
 * xuddi shunday). Bu komponent oddiy View'lardan — har versiyada bir xil.
 *
 * Ekran o'quvchi uchun `accessibilityRole="switch"` + `checked` holati.
 */
interface Props {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
}

const TRACK_W = 50;
const TRACK_H = 30;
const THUMB = 26;
const PAD = (TRACK_H - THUMB) / 2;

export function Toggle({ value, onValueChange, disabled, accessibilityLabel }: Props): JSX.Element {
  const progress = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: value ? 1 : 0,
      duration: 160,
      // Fon rangi animatsiyasi native driver'da ishlamaydi
      useNativeDriver: false,
    }).start();
  }, [value, progress]);

  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [PAD, TRACK_W - THUMB - PAD],
  });
  const backgroundColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.borderStrong, colors.primary],
  });

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled: !!disabled }}
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      hitSlop={10}
      onPress={() => onValueChange(!value)}
      style={disabled ? styles.disabled : undefined}
    >
      <Animated.View style={[styles.track, { backgroundColor }]}>
        <Animated.View style={[styles.thumb, { transform: [{ translateX }] }]} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: { width: TRACK_W, height: TRACK_H, borderRadius: TRACK_H / 2, justifyContent: 'center' },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: '#FFFFFF',
    shadowColor: '#15131E',
    shadowOpacity: 0.18,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  disabled: { opacity: 0.5 },
});
