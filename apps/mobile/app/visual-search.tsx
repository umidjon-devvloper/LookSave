import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '../src/components/Icon';
import { Button, Screen } from '../src/components/ui';
import { goBack } from '../src/navigation/back';
import { colors, radius, spacing, text } from '../src/theme/tokens';

/**
 * Visual search — rasmdan o'xshash mahsulot topish. Tier 1 funksiyasi #07.
 *
 * Hozir UI tayyor. Keyingi bosqich: kamera ochiladi yoki galereyadan rasm
 * yuklanadi, `POST /v1/search/image` orqali embedding olinadi,
 * katalogdan eng o'xshash 20 mahsulot qaytariladi (pgvector).
 */
export default function VisualSearch(): JSX.Element {
  const router = useRouter();

  return (
    <Screen>
      <View style={styles.head}>
        <Pressable onPress={() => goBack('/(tabs)')} hitSlop={10}>
          <Icon name="back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Rasmdan topish</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.body}>
        <View style={styles.hero}>
          <View style={styles.cameraFrame}>
            <View style={styles.cornerTL} />
            <View style={styles.cornerTR} />
            <View style={styles.cornerBL} />
            <View style={styles.cornerBR} />
            <Icon name="camera" size={56} color={colors.textDim} />
          </View>
          <Text style={styles.heroTitle}>Kiyimingizning rasmini yuklang</Text>
          <Text style={styles.heroHint}>
            Ko'chada yoki do'stingizda yoqtirgan kiyim — rasm oling, biz katalogdan
            eng o'xshashini topamiz.
          </Text>
        </View>

        <View style={styles.actions}>
          <Button title="Kameradan olish" onPress={() => {}} />
          <View style={{ height: spacing.sm }} />
          <Button title="Galereyadan yuklash" onPress={() => {}} variant="ghost" />
        </View>

        <View style={styles.tipRow}>
          <Text style={styles.tipDot}>•</Text>
          <Text style={styles.tipText}>Yorug'likda olingan rasm aniqroq topiladi</Text>
        </View>
        <View style={styles.tipRow}>
          <Text style={styles.tipDot}>•</Text>
          <Text style={styles.tipText}>Bitta kiyim ko'rinsin — aralash rasmlar past natija</Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { ...text.h3, color: colors.text },
  body: { flex: 1, padding: spacing.md, gap: spacing.md },
  hero: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg },
  cameraFrame: {
    width: 220,
    height: 220,
    borderRadius: radius.xl,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: spacing.md,
  },
  cornerTL: { position: 'absolute', top: 12, left: 12, width: 24, height: 24, borderTopWidth: 3, borderLeftWidth: 3, borderColor: colors.primary, borderTopLeftRadius: 8 },
  cornerTR: { position: 'absolute', top: 12, right: 12, width: 24, height: 24, borderTopWidth: 3, borderRightWidth: 3, borderColor: colors.primary, borderTopRightRadius: 8 },
  cornerBL: { position: 'absolute', bottom: 12, left: 12, width: 24, height: 24, borderBottomWidth: 3, borderLeftWidth: 3, borderColor: colors.primary, borderBottomLeftRadius: 8 },
  cornerBR: { position: 'absolute', bottom: 12, right: 12, width: 24, height: 24, borderBottomWidth: 3, borderRightWidth: 3, borderColor: colors.primary, borderBottomRightRadius: 8 },
  heroTitle: { ...text.h3, color: colors.text, textAlign: 'center' },
  heroHint: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20, paddingHorizontal: spacing.md },
  actions: { marginTop: spacing.md },
  tipRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  tipDot: { color: colors.primary, fontSize: 18 },
  tipText: { flex: 1, fontSize: 13, color: colors.textMuted, lineHeight: 18 },
});
