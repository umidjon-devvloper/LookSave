import { LinearGradient } from 'expo-linear-gradient';
import { Animated, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ImageSourcePropType } from 'react-native';

import { rtlStyles } from '../../i18n';
import { Icon, type IconName } from '../Icon';
import { colors, radius, spacing, text } from '../../theme/tokens';

/**
 * Home ekranining hero bloki — Atelier identity.
 *
 * Editorial moda-jurnali ochilishi: o'ngda portret foto, chapda serif
 * sarlavha. Krem fon rasmning chap chekkasiga oqib tushadi — matn foto
 * ustida ham o'qiladi, lekin dark-overlay klişesi yo'q.
 *
 * ⚠️ FON REZINKADEK CHO'ZILADI (`scrollY`). Ro'yxat pastga tortilganda
 * (`scrollY < 0`) fon rasmi cho'ziladi, lekin TEPASI ekran tepasida
 * QOTIB turadi — bo'sh fon chizig'i ochilmaydi. Matematikasi:
 *
 *   s = -scrollY  (necha px pastga tortilgan)
 *   scale     = 1 + s/H   →  yangi balandlik H + s
 *   translateY = -s/2      →  markazdan cho'zilish tepaga surilgani qaytariladi
 *
 * Transform tartibi MUHIM: `[translateY, scale]` — scale avval markazdan
 * qo'llaniladi, keyin translate suradi.
 */

/** Hero balandligi — cho'zilish nisbati shunga o'lchanadi (`styles.wrap.minHeight`) */
export const HERO_HEIGHT = 560;

const HERO_DARK = 'rgba(10,8,18,0.98)';
const HERO_SOFT = 'rgba(16,10,28,0.74)';
const HERO_CLEAR = 'rgba(16,10,28,0.08)';

export function Hero({
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
  scrollY,
}: {
  /** Fixed header balandligi — kontent uning ostidan boshlanadi */
  headerInset: number;
  title: string;
  titleAccent: string;
  titleEnd: string;
  subtitle: string;
  ctaLabel: string;
  ctaHint: string;
  onCta: () => void;
  badges?: Array<{ icon: IconName; title: string; hint: string }>;
  image?: ImageSourcePropType;
  /** Arabcha: rasm chapga, matn o'ngga — butun kompozitsiya ko'zguga solinadi */
  isRTL: boolean;
  /** Ro'yxat scroll holati — fonni rezinkadek cho'zish uchun. Bo'lmasa fon qotib turadi */
  scrollY?: Animated.Value;
}): JSX.Element {
  /*
   * Pull-down (negativ scrollY): rasm ekranda QOTIB TURADI — counter-translate
   * bilan scroll shiftini bekor qilamiz, refresh gesturi odatdagidek ishlaydi
   * (scroll gesture o'zi o'zgarmaydi, faqat vizualда rasm qimirlamaydi).
   * Scroll pastga: parallax saqlanadi (yarim tezlik).
   */
  /*
   * ScrollView pull-down da scrollY NEGATIVE bo'ladi. Kontent (shu
   * jumladan hero) scroll bilan birga pastga suriladi; rasmni ekranda
   * QOTIB tutish uchun ayni yo'nalishda qarshi translate kerak:
   *   scrollY=-50 → translateY=-50 (rasmni yuqoriga tortib qaytaradi).
   * Scroll pastga (positiv) uchun translate yarim tezlikda — parallax.
   */
  const stretchStyle = scrollY
    ? {
        transform: [
          {
            translateY: scrollY.interpolate({
              inputRange: [-1000, 0, HERO_HEIGHT],
              outputRange: [-1000, 0, HERO_HEIGHT * 0.18],
              extrapolate: 'clamp',
            }),
          },
        ],
      }
    : null;

  /* Matn ham refreshda qotadi va scroll pastga parallax qiladi */
  const parallaxStyle = scrollY
    ? {
        transform: [
          {
            translateY: scrollY.interpolate({
              inputRange: [-1000, 0, HERO_HEIGHT],
              outputRange: [-1000, 0, HERO_HEIGHT * 0.42],
              extrapolate: 'clamp',
            }),
          },
        ],
      }
    : null;

  return (
    <View style={styles.wrap}>
      {/*
        Fon qatlami: rasm + krem oqim. Dark gradient o'rniga krem gradient —
        rasmning chap chekkasi fon rangiga aralashadi, o'ng tomoni esa
        to'liq ko'rinadi. Atelier jurnalidagi chet-chetlab tushgan portret.
      */}
      <Animated.View style={[StyleSheet.absoluteFill, stretchStyle]}>
        {image ? (
          <Image source={image} style={isRTL ? styles.imageRTL : styles.image} resizeMode="cover" />
        ) : null}

        {/* Qora-binafsha oqim matnni tiniq, modelni esa yorqin qoldiradi. */}
        <LinearGradient
          colors={[HERO_DARK, HERO_SOFT, HERO_CLEAR]}
          locations={[0, 0.5, 1]}
          start={{ x: 0, y: 0.6 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />

        {/*
          Premium accent: o'ng chekkada tikka neon binafsha chiziq — ref
          dizaynidagi "studio light" effekti. Bir nechta qatlamli gradient
          bilan glow sezilarli bo'ladi.
        */}
        <View style={isRTL ? styles.neonBarRTL : styles.neonBar} pointerEvents="none">
          <LinearGradient
            colors={['rgba(192,132,252,0)', 'rgba(192,132,252,0.95)', 'rgba(192,132,252,0)']}
            locations={[0, 0.5, 1]}
            style={StyleSheet.absoluteFill}
          />
        </View>
        <View style={isRTL ? styles.neonGlowRTL : styles.neonGlow} pointerEvents="none">
          <LinearGradient
            colors={['rgba(168,85,247,0)', 'rgba(168,85,247,0.35)', 'rgba(168,85,247,0)']}
            locations={[0, 0.5, 1]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </View>

        {/* Orbital binafsha nur — chap yuqori burchakda, sekin ko'rinmas aura. */}
        <View style={styles.leftAura} pointerEvents="none">
          <LinearGradient
            colors={['rgba(124,58,237,0.42)', 'rgba(124,58,237,0.08)', 'rgba(124,58,237,0)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[StyleSheet.absoluteFill, { borderRadius: 160 }]}
          />
        </View>

        <LinearGradient
          colors={['rgba(10,8,18,0.72)', 'rgba(10,8,18,0)']}
          style={styles.topFade}
          pointerEvents="none"
        />
      </Animated.View>
      {/* Pastki chet oq kontentga yumshoq ulanadi. */}
      <LinearGradient
        colors={['rgba(10,8,18,0)', 'rgba(24,12,43,0.94)']}
        style={styles.bottomFade}
        pointerEvents="none"
      />

      <Animated.View
        style={[styles.content, { paddingTop: headerInset + spacing.md }, parallaxStyle]}
      >
        <View style={[styles.body, rtlStyles.align(isRTL)]}>
          <View>
            {/* Eyebrow — moda jurnali uslubi: italic Fraunces, ALL CAPS emas */}
            <View style={styles.eyebrowPill}>
              <Icon name="stores" size={14} color={colors.primary} />
              <Text style={[styles.eyebrow, rtlStyles.text(isRTL)]}>Atelye · Toshkent</Text>
            </View>

            {/* Sarlavha — title + titleAccent bir qatorda, titleEnd pastda */}
            <Text style={[styles.heroLine, rtlStyles.text(isRTL)]}>
              {title} <Text style={styles.heroAccent}>{titleAccent}</Text>
            </Text>
            <Text style={[styles.heroLine, rtlStyles.text(isRTL)]}>{titleEnd}</Text>

            <Text style={[styles.subtitle, rtlStyles.text(isRTL)]}>{subtitle}</Text>
          </View>

          <View style={styles.ctaBlock}>
            {/* Premium CTA — gradient to'ldirish + binafsha glow shadow */}
            <Pressable
              style={({ pressed }) => [styles.ctaWrap, pressed && { opacity: 0.85 }]}
              onPress={onCta}
            >
              <LinearGradient
                colors={['#B936F4', '#8B2CF5', '#6D28D9']}
                locations={[0, 0.55, 1]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.cta, rtlStyles.row(isRTL)]}
              >
                <View style={styles.ctaIcon}>
                  <Icon name="cart" size={18} color={colors.textOnPrimary} />
                </View>

                <View style={styles.ctaText}>
                  <Text style={styles.ctaLabel}>{ctaLabel}</Text>
                  <Text style={[styles.ctaHint, rtlStyles.text(isRTL)]}>{ctaHint}</Text>
                </View>
                <Icon name={isRTL ? 'back' : 'next'} size={18} color={colors.textOnPrimary} />
              </LinearGradient>
            </Pressable>

            {/* Belgilar — soch-ingichka chiziq bilan ajraladi */}
            {badges && badges.length > 0 ? (
              <View style={[styles.badges, rtlStyles.row(isRTL)]}>
                {badges.map((badge, index) => (
                  <View key={badge.title} style={[styles.badgeRow, rtlStyles.row(isRTL)]}>
                    {index > 0 ? <View style={styles.badgeDivider} /> : null}
                    <View style={[styles.badge, rtlStyles.row(isRTL)]}>
                      <Icon name={badge.icon} size={14} color={colors.primary} />
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
            ) : null}
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: -spacing.md,
    backgroundColor: '#0A0812',
    minHeight: HERO_HEIGHT,
    // overflow:visible — refresh pull-down da counter-translate ishlaydi,
    // rasm ekranda qotib turadi.
    overflow: 'visible',
  },
  // Rasm o'ngga chiqib turadi — chap chekkasi fonga aralashadi
  image: { position: 'absolute', right: 0, top: 0, width: '100%', height: '100%' },
  imageRTL: { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' },
  topFade: { position: 'absolute', left: 0, right: 0, top: 0, height: 180 },
  bottomFade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 80 },

  // Premium neon accents
  neonBar: {
    position: 'absolute',
    right: 14,
    top: 80,
    bottom: 100,
    width: 2.5,
  },
  neonBarRTL: {
    position: 'absolute',
    left: 14,
    top: 80,
    bottom: 100,
    width: 2.5,
  },
  neonGlow: {
    position: 'absolute',
    right: -8,
    top: 60,
    bottom: 80,
    width: 70,
  },
  neonGlowRTL: {
    position: 'absolute',
    left: -8,
    top: 60,
    bottom: 80,
    width: 70,
  },
  leftAura: {
    position: 'absolute',
    left: -80,
    top: -40,
    width: 320,
    height: 320,
  },

  content: { flex: 1, paddingHorizontal: spacing.md },
  body: {
    flex: 1,
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },

  // Eyebrow — italik serif, template "LABEL · fragment" uslubini butunlay almashtiradi
  eyebrow: {
    ...text.eyebrow,
    color: '#FFFFFF',
  },
  eyebrowPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    marginBottom: spacing.md,
  },

  // Sarlavha — Fraunces display, 2-3 qator, natural case. `text.hero` tokendan
  heroLine: {
    ...text.hero,
    color: '#FFFFFF',
    lineHeight: 64,
    marginBottom: 4,
  },
  // Markaziy qator anorga bo'yaladi — Chanel qoidasi, bitta aksent
  heroAccent: {
    color: colors.primary,
  },
  subtitle: {
    ...text.body,
    color: '#D6D1E2',
    marginTop: spacing.lg,
    maxWidth: '62%',
    lineHeight: 22,
  },

  // CTA bloki — body (alignItems: flex-start) ostida aniq kenglik beradi,
  // aks holda ctaWrap ichidagi maxWidth: '66%' va ctaText flex: 1 noaniq
  // ota-kenglikka nisbatan 0 ga tushib, yorliq matni qisiladi (badges olib
  // tashlangach shunday bo'lgandi).
  ctaBlock: { alignSelf: 'stretch' },
  // Premium CTA: gradient wrap (shadow uchun) + ichida gradient fill
  ctaWrap: {
    borderRadius: radius.lg,
    marginTop: spacing.lg,
    maxWidth: '66%',
    shadowColor: '#A855F7',
    shadowOpacity: 0.55,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
  },
  ctaIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryDim,
  },
  ctaText: { flex: 1, gap: 2 },
  ctaLabel: { ...text.bodyMed, color: colors.textOnPrimary, lineHeight: 20 },
  ctaHint: { ...text.tiny, color: colors.textOnPrimary, opacity: 0.8, lineHeight: 14 },

  // Belgilar — ingichka chiziq bilan ajraladi, kichik tipografika
  badges: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.lg },
  badgeRow: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  badgeDivider: {
    width: 1,
    height: 22,
    backgroundColor: 'rgba(255,255,255,0.24)',
    marginHorizontal: spacing.sm,
  },
  badge: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2, flexShrink: 1 },
  badgeText: { flexShrink: 1, gap: 2 },
  badgeTitle: { ...text.tiny, color: '#FFFFFF', lineHeight: 14 },
  badgeHint: { ...text.tiny, color: '#BDB5CA', fontSize: 9, letterSpacing: 0.3, lineHeight: 12 },
});
