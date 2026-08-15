import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ImageSourcePropType } from 'react-native';

import { rtlStyles } from '../../i18n';
import { Icon, type IconName } from '../Icon';
import { colors, radius, spacing, text } from '../../theme/tokens';

/**
 * Home ekranining hero bloki — deckning 01-slaydi.
 *
 * Deckda hero ekranning butun kengligini egallaydi va logotip qatori uning
 * USTIDA turadi — alohida sarlavha yo'q. Shuning uchun bu komponent `header`
 * ni o'z ichiga oladi va ro'yxatning chetlaridan tashqariga chiqadi
 * (`marginHorizontal: -16`).
 */
export function Hero({
  header,
  headerInset,
  title,
  titleAccent,
  titleEnd,
  subtitle,
  ctaLabel,
  ctaHint,
  onCta,
  badges,
  image,
  isRTL,
}: {
  header: ReactNode;
  /** Status bar balandligi — kontent uning ostidan boshlanadi */
  headerInset: number;
  title: string;
  titleAccent: string;
  titleEnd: string;
  subtitle: string;
  ctaLabel: string;
  ctaHint: string;
  onCta: () => void;
  badges: Array<{ icon: IconName; title: string; hint: string }>;
  image?: ImageSourcePropType;
  /** Arabcha: rasm chapga, matn o'ngga — butun kompozitsiya ko'zguga solinadi */
  isRTL: boolean;
}): JSX.Element {
  return (
    <View style={styles.wrap}>
      {/* Foto o'ngda, to'liq bo'y — deckdagi kompozitsiya */}
      {image ? (
        <Image source={image} style={isRTL ? styles.imageRTL : styles.image} resizeMode="cover" />
      ) : null}

      {/* Chapdan o'ngga qorong'ilashuv — matn fotoga tushsa ham o'qiladi */}
      <LinearGradient
        colors={['rgba(10,10,15,0.97)', 'rgba(10,10,15,0.8)', 'rgba(10,10,15,0)']}
        locations={[0, 0.45, 1]}
        start={{ x: 0, y: 0.6 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Pastki chetini fonga ulash — kesilgan chegara ko'rinmasin */}
      <LinearGradient
        colors={['rgba(10,10,15,0)', colors.bg]}
        style={styles.bottomFade}
        pointerEvents="none"
      />

      <View style={[styles.content, { paddingTop: headerInset }]}>
        {header}

        <View style={[styles.body, rtlStyles.align(isRTL)]}>
          {/* Sarlavha yuqorida, tugma va belgilar pastda — orasi bo'sh qoladi */}
          <View>
            <Text style={[styles.heroLine, rtlStyles.text(isRTL)]}>{title}</Text>
            <Text style={[styles.heroLine, rtlStyles.text(isRTL), { color: colors.primary }]}>
              {titleAccent}
            </Text>
            <Text style={[styles.heroLine, rtlStyles.text(isRTL)]}>{titleEnd}</Text>

            <Text style={[styles.subtitle, rtlStyles.text(isRTL)]}>{subtitle}</Text>
          </View>

          <View>
            <Pressable
              style={({ pressed }) => [
                styles.cta,
                rtlStyles.row(isRTL),
                pressed && { borderColor: colors.accent },
              ]}
              onPress={onCta}
            >
              <LinearGradient
                colors={[colors.primary, colors.primaryDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.ctaIcon}
              >
                <Icon name="cart" size={20} color={colors.text} />
              </LinearGradient>

              <View style={styles.ctaText}>
                <Text style={styles.ctaLabel}>{ctaLabel}</Text>
                <Text style={[styles.ctaHint, rtlStyles.text(isRTL)]}>{ctaHint}</Text>
              </View>
              <Icon name={isRTL ? 'back' : 'next'} size={20} color={colors.textMuted} />
            </Pressable>

            <View style={[styles.badges, rtlStyles.row(isRTL)]}>
              {badges.map((badge, index) => (
                <View key={badge.title} style={[styles.badgeRow, rtlStyles.row(isRTL)]}>
                  {index > 0 ? <View style={styles.badgeDivider} /> : null}
                  <View style={[styles.badge, rtlStyles.row(isRTL)]}>
                    <Icon name={badge.icon} size={16} color={colors.accent} />
                    <View style={styles.badgeText}>
                      <Text style={[styles.badgeTitle, rtlStyles.text(isRTL)]} numberOfLines={1}>
                        {badge.title}
                      </Text>
                      <Text style={[styles.badgeHint, rtlStyles.text(isRTL)]} numberOfLines={1}>
                        {badge.hint}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    // Ekran chetlariga chiqish: ro'yxatning 16px paddingi bekor qilinadi
    marginHorizontal: -spacing.md,
    backgroundColor: colors.bg,
    // Baland blok — model ko'proq ko'rinadi va matn siqilib qolmaydi
    minHeight: 540,
  },
  // Rasm o'ngga suriladi: chap tomonda sarlavha uchun toza joy qoladi
  image: { position: 'absolute', right: -30, top: 0, width: '100%', height: '100%' },
  // Arabchada rasm chapga o'tadi — LTR joylashuvining aniq ko'zgu aksi.
  // ⚠️ `width` shart: `left: 0, right: 0` qilinsa blok kengayib ketadi va
  // `cover` vertikal rasmni haddan tashqari kesadi (modeldan yelka qoladi).
  imageRTL: { position: 'absolute', left: -30, top: 0, width: '100%', height: '100%' },
  bottomFade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 90 },

  // `flex: 1` shart — bo'lmasa ichkaridagi `body` ning `flex-end` i ishlamaydi
  // va matn blokidan keyin bo'sh joy qolib ketadi.
  content: { flex: 1, paddingHorizontal: spacing.md },
  // Sarlavha yuqoriga, tugma pastga tortiladi — bo'sh joy ikkisining orasida
  // qoladi va model fotosi ochiq ko'rinadi.
  body: {
    flex: 1,
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    // Tugma blokini pastdan ko'taradi — model fotosining pastki qismi
    // (krossovka va aks) ochiq qoladi.
    paddingBottom: spacing.xxl,
  },

  // `lineHeight` tokendagidan kattaroq: deckdagi kabi qatorlar orasi ochiq
  heroLine: { ...text.hero, lineHeight: 54, color: colors.text, textTransform: 'uppercase' },
  subtitle: {
    ...text.small,
    color: colors.textMuted,
    marginTop: spacing.sm,
    maxWidth: '58%',
  },

  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 0,
    padding: spacing.sm + 2,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    backgroundColor: 'rgba(20,18,28,0.88)',
    // iOS'da rangli soya nurlanish beradi (06-dizayn.md §5)
    shadowColor: colors.primary,
    shadowOpacity: 0.4,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },
  ctaIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { flex: 1 },
  ctaLabel: { ...text.bodyMed, color: colors.text, letterSpacing: 1.4, flexShrink: 1 },
  // Arabcha tartibda joy torroq — harflar orasi kengligi kamaytiriladi
  ctaLabelRTL: { letterSpacing: 0 },
  ctaHint: { ...text.tiny, color: colors.accent },

  badges: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md },
  badgeRow: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  badgeDivider: {
    width: 1,
    height: 22,
    backgroundColor: colors.border,
    marginHorizontal: spacing.sm,
  },
  badge: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2, flexShrink: 1 },
  badgeText: { flexShrink: 1 },
  badgeTitle: { ...text.tiny, color: colors.text },
  badgeHint: { ...text.tiny, color: colors.textDim, fontSize: 9, letterSpacing: 0.6 },
});
