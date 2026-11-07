import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

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
 * `domain=looksave.uz` parametri widget serveriga qaysi hisob
 * ulanayotganini aytadi — hisob sozlamalarida `looksave.uz` ruxsat
 * berilgan bo'lishi kerak.
 *
 * ⚠️ NATIVE MODUL: `react-native-webview` Expo autolinking bilan avtomatik
 * qo'shiladi, lekin faqat prebuild+rebuild'dan keyin native binary'ga
 * kiradi. Agar dev-client build'da modul yo'q bo'lsa — yangi EAS build.
 */
const ANYWEAR_URL = 'https://looksave.uz/anywear.html';

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

      <WebView
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
});
