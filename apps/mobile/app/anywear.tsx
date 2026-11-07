import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '../src/components/Icon';
import { Screen } from '../src/components/ui';
import { colors, radius, spacing, text } from '../src/theme/tokens';

/**
 * Real-time try-on — Decart Anywear widget.
 *
 * ⚠️ WEBVIEW O'RNIGA TASHQI BRAUZER: `react-native-webview` native moduli
 * joriy dev-client build'ga qo'shilmagan (build 48). Prebuild + rebuild
 * qilmasdan ishlash uchun Safari'da ochamiz — foydalanuvchi widget bilan
 * to'liq tanishib, ilovaga qaytadi.
 *
 * Kelasi rebuild'da WebView'ga qaytarsak bo'ladi (git tarixida bor).
 */
const ANYWEAR_URL = 'https://looksave.uz/anywear.html';

export default function AnywearScreen(): JSX.Element {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [opened, setOpened] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        await Linking.openURL(ANYWEAR_URL);
        setOpened(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Brauzer ochilmadi');
      }
    })();
  }, []);

  return (
    <Screen>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Orqaga"
          onPress={() => router.back()}
          hitSlop={10}
          style={styles.backBtn}
        >
          <Icon name="back" size={20} color={colors.text} />
        </Pressable>
        <View style={styles.titleWrap}>
          <Icon name="tryon" size={18} color={colors.primary} />
          <Text style={styles.title}>Real-time kiyim ko‘rish</Text>
        </View>
        <View style={styles.backBtn} />
      </View>

      <View style={styles.body}>
        {error ? (
          <>
            <Icon name="close" size={48} color="#EF4444" />
            <Text style={styles.heading}>Brauzer ochilmadi</Text>
            <Text style={styles.sub}>{error}</Text>
            <Pressable
              style={styles.retry}
              onPress={() => {
                setError(null);
                void Linking.openURL(ANYWEAR_URL).catch((e) =>
                  setError(e instanceof Error ? e.message : 'Brauzer ochilmadi'),
                );
              }}
            >
              <Text style={styles.retryText}>Qayta urinish</Text>
            </Pressable>
          </>
        ) : opened ? (
          <>
            <Icon name="tryon" size={48} color={colors.primary} />
            <Text style={styles.heading}>Safari’da ochildi</Text>
            <Text style={styles.sub}>
              Real-time kiyim ko‘rish Safari’da ishga tushdi. Tugatgach ilovaga qayting.
            </Text>
            <Pressable
              style={styles.retry}
              onPress={() => void Linking.openURL(ANYWEAR_URL)}
            >
              <Text style={styles.retryText}>Qayta ochish</Text>
            </Pressable>
          </>
        ) : (
          <>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.sub}>Brauzer ochilmoqda…</Text>
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(192, 132, 252, 0.2)',
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(192, 132, 252, 0.3)',
  },
  titleWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { ...text.bodyMed, color: colors.text, fontWeight: '700' },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: '#FBF7FF',
  },
  heading: { ...text.h3, color: colors.text, textAlign: 'center' },
  sub: { ...text.body, color: colors.textMuted, textAlign: 'center' },
  retry: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
  },
  retryText: { ...text.bodyMed, color: '#FFFFFF', fontWeight: '700' },
});
