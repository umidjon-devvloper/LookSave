import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from './ui';
import { Icon } from './Icon';
import { useI18n } from '../i18n';
import { colors, radius, spacing, text } from '../theme/tokens';

/**
 * Kirish talab qilinadigan ekranlar uchun holat.
 *
 * NEGA KERAK: ilova endi kirish so'ramasdan ochiladi — katalogni ko'rish,
 * do'konlarni izlash va narxlarni solishtirish uchun akkaunt shart emas.
 * Lekin profil, buyurtma va avatar shaxsiy ma'lumotga tayanadi.
 *
 * Bunday joyda foydalanuvchini avtomatik kirish ekraniga otib yuborish
 * yomon: u nima uchun tashlanganini tushunmaydi va orqaga qaytish
 * chalkashadi. Shuning uchun sabab aytiladi va tanlov qoldiriladi.
 */
export function SignInRequired({ title, hint }: { title?: string; hint?: string }): JSX.Element {
  const router = useRouter();
  const t = useI18n((state) => state.t);

  return (
    <View style={styles.wrap}>
      <View style={styles.icon}>
        <Icon name="profile" size={32} color={colors.accent} />
      </View>

      {/*
        Matn berilmasa umumiy variant ishlatiladi. ⚠️ QATTIQ YOZILGAN
        MATN QOLDIRILMAYDI: qurilma boshqa tilda bo'lsa ekranda ikki til
        aralashardi — sarlavha o'zbekcha, tugma inglizcha.
      */}
      <Text style={styles.title}>{title ?? t.auth.requiredTitle}</Text>
      <Text style={styles.hint}>{hint ?? t.auth.requiredHint}</Text>

      <View style={styles.actions}>
        <Button title={t.auth.signIn} onPress={() => router.push('/(auth)/sign-in')} />
        <Button
          title={t.auth.signUp}
          variant="ghost"
          onPress={() => router.push('/(auth)/sign-up')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  icon: {
    width: 72,
    height: 72,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  title: { ...text.h2, color: colors.text, textAlign: 'center' },
  hint: { ...text.body, color: colors.textMuted, textAlign: 'center' },
  actions: { alignSelf: 'stretch', gap: spacing.sm, marginTop: spacing.lg },
});
