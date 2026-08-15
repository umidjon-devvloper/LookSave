import { Link } from 'expo-router';
import { Image, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../src/components/ui';
import { useI18n } from '../../src/i18n';
import { useSplashLanding } from '../../src/store/splashTargetStore';
import { images } from '../../src/theme/images';
import { colors, spacing, text } from '../../src/theme/tokens';

export default function Welcome(): JSX.Element {
  const t = useI18n((state) => state.t);
  // Splash logotipi aynan shu logotip ustiga uchib qo'nadi
  const splashLanding = useSplashLanding();

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.hero}>
        {/* Birinchi ekran — logotip to'liq o'lchamda ko'rinadi */}
        <View
          ref={splashLanding.ref}
          onLayout={splashLanding.onLayout}
          collapsable={false}
          style={styles.logoWrap}
        >
          <Image source={images.logoMark} style={styles.logo} resizeMode="contain" />
        </View>
        <Text style={styles.wordmark}>LOOK SAVE</Text>
        <Text style={styles.title}>{t.auth.heroTitle}</Text>
        <Text style={styles.subtitle}>{t.auth.heroSubtitle}</Text>
      </View>

      <View style={styles.actions}>
        <Link href="/(auth)/sign-up" asChild>
          <Button title={t.auth.start} onPress={() => undefined} />
        </Link>
        <Link href="/(auth)/sign-in" asChild>
          <Button title={t.auth.haveAccount} variant="ghost" onPress={() => undefined} />
        </Link>
        <Text style={styles.note}>{t.auth.paymentNote}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: spacing.lg,
    justifyContent: 'space-between',
  },
  hero: { flex: 1, justifyContent: 'center', gap: spacing.md },
  // Chekka bo'shliq o'ramda: splash logotipi shu o'ramning markaziga qo'nadi,
  // shuning uchun o'ram tasvirning aniq o'lchamida qolishi kerak.
  logoWrap: { marginBottom: spacing.sm },
  logo: { width: 150, height: 105 },
  wordmark: { ...text.wordmark, color: colors.accent },
  title: { ...text.h1, color: colors.text },
  subtitle: { ...text.body, color: colors.textMuted },
  actions: { gap: spacing.sm, paddingBottom: spacing.md },
  note: { ...text.small, color: colors.textDim, textAlign: 'center', marginTop: spacing.sm },
});
