import { useRouter } from 'expo-router';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '../src/components/Icon';
import { Screen } from '../src/components/ui';
import { colors, radius, spacing, text } from '../src/theme/tokens';

/**
 * Real-time try-on — Decart Anywear widget WebView ichida.
 *
 * NEGA WEBVIEW: Anywear faqat web uchun JS widget sifatida mavjud
 * (React Native SDK yo'q). `looksave.uz/anywear.html` sahifasini
 * WebView'ga yuklaymiz — widget mahsulot kartochkalarini o'zi tortadi
 * va foydalanuvchi "try on" bossa, kameradan surat olib virtual tryon
 * chiqaradi (real vaqt).
 *
 * ⚠️ NATIVE MODUL YUKLASH — LAZY (2026-11-09).
 *
 * `react-native-webview` Expo Go'da yo'q (custom native module) — top-level
 * `import` bilan yuklasak, butun ekran yuklanganda crash. Yechim:
 * require'ni try/catch bilan runtime'da chaqiramiz. Module topilmasa,
 * tashqi brauzerda ochish tugmasini ko'rsatamiz (fallback).
 *
 * Dev build (EAS build) ichida WebView bor — shu yerda to'liq ishlaydi.
 */
const ANYWEAR_URL = 'https://looksave.uz/anywear.html';

// Lazy load: faqat module borligini tekshiramiz, component yuklanadigan
// paytda top-level crash emas.
function loadWebView(): React.ComponentType<Record<string, unknown>> | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-webview') as { WebView?: React.ComponentType<Record<string, unknown>> };
    return mod.WebView ?? null;
  } catch {
    return null;
  }
}

const WebViewComponent = loadWebView();

export default function AnywearScreen(): JSX.Element {
  const insets = useSafeAreaInsets();
  const router = useRouter();

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

      {WebViewComponent ? (
        <WebViewComponent
          source={{ uri: ANYWEAR_URL }}
          originWhitelist={['*']}
          javaScriptEnabled
          domStorageEnabled
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          style={styles.web}
          startInLoadingState
          renderLoading={() => (
            <View style={styles.loading}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Widget yuklanmoqda…</Text>
            </View>
          )}
        />
      ) : (
        <View style={styles.fallback}>
          <Icon name="tryon" size={48} color={colors.primary} />
          <Text style={styles.fallbackTitle}>Real-time widget</Text>
          <Text style={styles.fallbackHint}>
            Bu ekran dev build ichida ochiladi. Expo Go'da WebView qo'llab-quvvatlanmaydi —
            widget'ni brauzerda oching.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void Linking.openURL(ANYWEAR_URL)}
            style={({ pressed }) => [styles.openBtn, pressed && { opacity: 0.8 }]}
          >
            <Text style={styles.openBtnText}>Brauzerda ochish</Text>
          </Pressable>
        </View>
      )}
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
  web: { flex: 1, backgroundColor: '#FBF7FF' },
  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FBF7FF',
    gap: spacing.sm,
  },
  loadingText: { ...text.small, color: colors.textMuted },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: '#FBF7FF',
  },
  fallbackTitle: { ...text.h3, color: colors.text, fontWeight: '700' },
  fallbackHint: { ...text.small, color: colors.textMuted, textAlign: 'center', maxWidth: 320 },
  openBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  openBtnText: { ...text.bodyMed, color: '#FFFFFF', fontWeight: '700' },
});
