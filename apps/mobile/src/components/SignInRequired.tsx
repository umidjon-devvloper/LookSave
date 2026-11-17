import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { useRouter } from 'expo-router';
import { useContext } from 'react';
import { Image, ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

// Avatar — glow doira va badge rasmning o'ziga chizilgan, shuning uchun
// vektor ikonka bilan almashtirilmaydi (sign-in/sign-up dan farqli).
const IMG_AVATAR = require('../../assets/profile-avatar-icon.png');

import { Icon, type IconName } from './Icon';
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

/**
 * Suzuvchi tab qatori egallaydigan balandlik (`app/(tabs)/_layout.tsx`:
 * qator 72 + ustki bo'shliq 6). Qator ekran ustida `absolute` turadi va
 * kontentni o'zi surmaydi — bu bo'shliq qo'yilmasa, tab ichida ochilgan
 * ekranda pastki kartalar qator ostida qolib, yozuvi kesilardi.
 */
const TAB_DOCK_HEIGHT = 78;

function ShortcutCard({
  icon,
  label,
  sub,
}: {
  icon: IconName;
  label: string;
  sub: string;
}): JSX.Element {
  return (
    <View style={card.wrap}>
      <View style={card.iconWrap}>
        <Icon name={icon} size={22} color={colors.accent} />
      </View>
      <Text style={card.label}>{label}</Text>
      <Text style={card.sub}>{sub}</Text>
    </View>
  );
}

export function SignInRequired({ title, hint }: { title?: string; hint?: string }): JSX.Element {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const t = useI18n((state) => state.t);
  // Tab navigatoridan tashqarida kontekst yo'q (`undefined`) — bo'shliq kerak emas
  const insideTabs = useContext(BottomTabBarHeightContext) !== undefined;
  const bottomSpace = insideTabs
    ? Math.max(insets.bottom, 8) + TAB_DOCK_HEIGHT + spacing.md
    : insets.bottom + spacing.lg;

  return (
    <ImageBackground
      source={require('../../assets/profile-bg.jpg')}
      style={styles.bg}
      resizeMode="cover"
    >
      {/* Profil rasmi ustidan oq-lavanda qatlam: qora matn har doim o'qiladi. */}
      <LinearGradient
        colors={['rgba(251,250,255,0.80)', 'rgba(251,250,255,0.94)', colors.bg]}
        locations={[0, 0.48, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View
        style={[
          styles.inner,
          { paddingTop: insets.top + spacing.lg, paddingBottom: bottomSpace },
        ]}
      >
        {/* Avatar — maxsus rasm (glow doira + badge o'z ichida) */}
        <Image source={IMG_AVATAR} style={styles.avatarImage} resizeMode="contain" />

        {/* Sarlavha va hint */}
        <Text style={styles.title}>{title ?? t.auth.requiredTitle}</Text>
        <Text style={styles.hint}>{hint ?? t.auth.requiredHint}</Text>

        {/* Tugmalar */}
        <View style={styles.actions}>
          {/* Sign in — gradient filled */}
          <Pressable
            style={({ pressed }) => [styles.btnPrimary, pressed && { opacity: 0.85 }]}
            onPress={() => router.push('/(auth)/sign-in')}
            accessibilityRole="button"
          >
            <LinearGradient
              colors={[colors.primary, colors.primaryDim]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            {/*
              Vektor ikonka, rasm EMAS. Ilgari bu yerda 1024x1024 PNG turardi
              va uning foni to'liq to'ldirilgan edi — binafsha tugma ustida
              boshqa ohangdagi kvadrat bo'lib ko'rinardi. Vektorda fon yo'q.
            */}
            <Icon name="login" size={24} color={colors.textOnPrimary} />
            <Text style={styles.btnPrimaryText}>{t.auth.signIn}</Text>
            <View style={styles.btnChevron}>
              <Icon name="next" size={16} color={colors.textOnPrimary} />
            </View>
          </Pressable>

          {/* Sign up — ghost */}
          <Pressable
            style={({ pressed }) => [
              styles.btnGhost,
              pressed && { backgroundColor: colors.surface2 },
            ]}
            onPress={() => router.push('/(auth)/sign-up')}
            accessibilityRole="button"
          >
            <Icon name="signup" size={24} color={colors.accent} />
            <Text style={styles.btnGhostText}>{t.auth.signUp}</Text>
            <View style={styles.btnChevron}>
              <Icon name="next" size={16} color={colors.textMuted} />
            </View>
          </Pressable>
        </View>

        <View style={{ flex: 1 }} />

        {/* Pastki uch karta */}
        <View style={styles.cards}>
          <ShortcutCard icon="orders" label={t.auth.cardOrders} sub={t.auth.cardOrdersHint} />
          <ShortcutCard
            icon="favorite"
            label={t.auth.cardFavorites}
            sub={t.auth.cardFavoritesHint}
          />
          <ShortcutCard icon="settings" label={t.auth.cardSettings} sub={t.auth.cardSettingsHint} />
        </View>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  inner: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },

  /* Avatar rasm */
  avatarImage: {
    width: 160,
    height: 160,
    marginTop: spacing.lg,
  },

  /* Tugma ikonka rasmi — PNG shaffof, clip kerak emas */

  /* Matn */
  title: { ...text.h2, color: colors.text, textAlign: 'center', marginTop: spacing.sm },
  hint: { ...text.body, color: colors.textMuted, textAlign: 'center', maxWidth: 300 },

  /* Tugmalar */
  actions: { alignSelf: 'stretch', gap: spacing.sm, marginTop: spacing.sm },
  btnPrimary: {
    height: 58,
    borderRadius: radius.xxl,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    overflow: 'hidden',
  },
  btnPrimaryText: { ...text.bodyMed, color: colors.textOnPrimary, flex: 1 },
  btnGhost: {
    height: 58,
    borderRadius: radius.xxl,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: 'rgba(255,255,255,0.78)',
  },
  btnGhostText: { ...text.bodyMed, color: colors.text, flex: 1 },
  btnChevron: { marginLeft: 'auto' },

  /* Pastki kartalar */
  cards: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignSelf: 'stretch',
  },
});

const card = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    gap: 6,
    shadowColor: '#6D28D9',
    shadowOpacity: 0.10,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { ...text.small, color: colors.text, fontWeight: '600', textAlign: 'center' },
  sub: { ...text.tiny, color: colors.textMuted, textAlign: 'center' },
});
