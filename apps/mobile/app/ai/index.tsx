import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HologramFigure } from '../../src/components/ai/HologramFigure';
import { Icon, type IconName } from '../../src/components/Icon';
import { Button } from '../../src/components/ui';
import { colors, radius, spacing, text } from '../../src/theme/tokens';

/**
 * AI Designer — oqimning kirish ekrani.
 *
 * Butun ekran bitta gologramma rasmiga qurilgan: unda tadbir/uslub/kayfiyat
 * kartalari va kiyim plitkalari ham bor, shuning uchun ular alohida
 * chizilmaydi.
 *
 * ⚠️ TANLOV ENDI BU YERDA YO'Q. Ilgari uchta bosiladigan karta bor edi,
 * lekin ular rasmdagilar bilan takrorlanardi. Hozir `aiFlowStore` dagi
 * qiymatlar SUKUT bo'yicha qoladi (`Kundalik`, `Smart Casual`, `Ishonchli`)
 * va ular komplekt nomida hamda kiyim filtrida ishlatiladi.
 *
 * Foydalanuvchiga tanlash imkonini qaytarish kerak bo'lsa — uni avatar
 * oqimiga qadam qilib qo'shish mantiqiyroq, bu ekranni yana to'ldirmasdan.
 *
 * ⚠️ Scroll yo'q: hamma narsa bitta ekranga sig'adi, rasm esa qolgan bo'sh
 * joyni egallab kichrayadi.
 */

const HOW_IT_WORKS: Array<{ icon: IconName; title: string }> = [
  { icon: 'looks', title: 'Tanlovingizni aytasiz' },
  { icon: 'tryon', title: 'AI komplekt yasaydi' },
  { icon: 'favorite', title: 'Yoqqanini tanlaysiz' },
];

export default function AiDesigner(): JSX.Element {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      {/* Scroll yo'q: hamma narsa bitta ekranga sig'adi, rasm esa qolgan
          bo'sh joyni egallab kichrayadi */}
      <View
        style={[
          styles.content,
          { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.lg },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Orqaga"
          onPress={() => router.back()}
          hitSlop={10}
          style={styles.close}
        >
          <Icon name="close" size={20} color={colors.textMuted} />
        </Pressable>

        <Text style={styles.title}>
          <Text style={styles.titleAccent}>AI</Text> DESIGNER
        </Text>
        <Text style={styles.subtitle}>Shaxsiy AI stilistingiz</Text>

        {/*
          ⚠️ FAQAT DEV. `/ai/studio` — backendsiz 3D studiya: Blender'dan
          olingan tana (`male-base-v1.glb`) va `assets/models` dagi kiyimlar.
          Marshrutga ilova ichidan havola yo'q edi, ya'ni modelni qurilmada
          ko'rishning yagona yo'li deep link edi. Bu tugma shu teshikni
          yopadi va ishlab chiqarish to'plamiga tushmaydi.
        */}
        {__DEV__ ? (
          <View style={styles.devRow}>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/ai/studio')}
              style={styles.devLink}
            >
              <Text style={styles.devLinkText}>DEV · 3D studiya</Text>
            </Pressable>
            {/*
              Siqish sinovi — 04-3d-pipeline §0, roadmapning 1-raqamli
              kritik yo'li. Marshrutga ilova ichidan havola bo'lmasa uni
              ochishning yagona yo'li deep link bo'lardi.
            */}
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/compression-test')}
              style={styles.devLink}
            >
              <Text style={styles.devLinkText}>DEV · siqish sinovi</Text>
            </Pressable>
          </View>
        ) : null}
        <Text style={styles.lead}>
          Uslubingiz, kayfiyatingiz yoki tadbir haqida ayting — AI siz uchun mos komplekt yasaydi.
        </Text>

        {/*
          Gologramma to'liq ko'rsatiladi — rasm ichida kartalar va kiyim
          plitkalari ham bor, shuning uchun ular alohida chizilmaydi.
        */}
        <View style={styles.figure}>
          <HologramFigure />
        </View>

        {/* Qanday ishlaydi */}
        <View style={styles.howCard}>
          <Text style={styles.howTitle}>Qanday ishlaydi?</Text>
          <View style={styles.howRow}>
            {HOW_IT_WORKS.map((step, index) => (
              <View key={step.title} style={styles.howStep}>
                <View style={styles.howIcon}>
                  <Icon name={step.icon} size={18} color={colors.accent} />
                </View>
                <Text style={styles.howText}>
                  {index + 1}. {step.title}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/*
          ⚠️ 3D OQIMIGA EMAS, SURAT OQIMIGA. Ilgari bu tugma `/ai/avatar`
          ga — 3D maneken yasash qadamlariga olib borardi. Undan voz
          kechildi: maneken "realistik" darajaga chiqmasdi, chunki buning
          uchun o'n minglab uchburchakli model, teri ostidan yorug'lik
          o'tishi va haqiqiy soch kerak.

          Yangi yo'lda foydalanuvchi qadamlardan o'tadi (jins, o'lchovlar,
          oyoq, do'kon), oxirida yuzini skaner qiladi va AI qolgan gavdani
          o'lchovlardan yasaydi.

          ⚠️ TO'LIQ BO'YLI SURAT SO'RALMAYDI: buning uchun joy, oyna va
          ko'pincha boshqa odamning yordami kerak — ko'p foydalanuvchi shu
          yerda to'xtardi. Selfi esa hammaga qulay.
        */}
        <View style={styles.cta}>
          <Button title="Meni kiyintir" onPress={() => router.push('/ai/avatar')} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  /*
   * Sof qora — brend foni `#0A0A0F` emas. Sabab: gologramma rasmi shaffof
   * emas va uning foni `#000000`. Ranglar bir xil bo'lmasa rasm atrofida
   * to'rtburchak chekka ko'rinadi.
   */
  root: { flex: 1, backgroundColor: '#000000' },
  content: { flex: 1, paddingHorizontal: spacing.md, gap: spacing.xs },
  close: { alignSelf: 'flex-start', padding: spacing.xs, marginBottom: spacing.xs },

  title: { ...text.h1, color: colors.text, textAlign: 'center', letterSpacing: 0.5 },
  titleAccent: { color: colors.accent },
  subtitle: { ...text.bodyMed, color: colors.textMuted, textAlign: 'center' },
  lead: {
    ...text.small,
    color: colors.textDim,
    textAlign: 'center',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
  },

  /*
   * ⚠️ `flex: 1` SHART. Rasm ham `flex: 1` bilan chiziladi — konteynerda
   * balandlik bo'lmasa u nolga siqiladi va umuman ko'rinmaydi. Xato jimgina
   * yuz beradi: rasm yuklanadi, joylashuv "ishlaydi", faqat ekranda hech
   * narsa yo'q.
   *
   * Manfiy chekka — `content` dagi yon bo'shliqni bekor qiladi, shunda
   * gologramma ekran chetidan chetiga to'liq yoyiladi.
   */
  figure: {
    flex: 1,
    alignItems: 'center',
    marginTop: spacing.sm,
    marginHorizontal: -spacing.md,
  },

  howCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  howTitle: {
    ...text.h3,
    color: colors.accent,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  howRow: { flexDirection: 'row', gap: spacing.sm },
  howStep: { flex: 1, alignItems: 'center', gap: spacing.xs },
  howIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  howText: { ...text.tiny, color: colors.textMuted, textAlign: 'center' },

  cta: { marginTop: spacing.lg },

  // ⚠️ Faqat dev — `__DEV__` bilan o'ralgan
  devRow: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap', justifyContent: 'center' },
  devLink: {
    alignSelf: 'center',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  devLinkText: { ...text.tiny, color: colors.accent },
});
