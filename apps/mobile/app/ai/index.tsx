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

        <View style={styles.cta}>
          <Button title="AI komplekt yasasin" onPress={() => router.push('/ai/avatar')} />
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
});
