import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HologramFigure } from '../../src/components/ai/HologramFigure';
import { Icon, type IconName } from '../../src/components/Icon';
import { Button } from '../../src/components/ui';
import { colors, radius, spacing, text } from '../../src/theme/tokens';
import { MOODS, OCCASIONS, STYLES, useAiFlowStore } from '../../src/store/aiFlowStore';
import { goBack } from '../../src/navigation/back';

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

/**
 * Bitta tanlov qatori — bosilganda keyingi qiymatga o'tadi.
 *
 * ⚠️ RO'YXAT EMAS, AYLANTIRISH. Har tanlov uchun pastdan chiqadigan
 * panel ochish uch marta bosishni talab qilardi va oqim cho'zilardi.
 * Variantlar oz (4–5 ta), shuning uchun bosgan sari keyingisiga o'tadi —
 * joriy qiymat doim ko'rinib turadi.
 */
function Choice<T extends string>({
  label,
  value,
  options,
  onPick,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onPick: (value: T) => void;
}): JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      onPress={() => {
        const next = options[(options.indexOf(value) + 1) % options.length];
        if (next) onPick(next);
      }}
      style={styles.choice}
    >
      <Text style={styles.choiceLabel}>{label}</Text>
      <Text style={styles.choiceValue} numberOfLines={1}>
        {value}
      </Text>
    </Pressable>
  );
}

export default function AiDesigner(): JSX.Element {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const occasion = useAiFlowStore((state) => state.occasion);
  const style = useAiFlowStore((state) => state.style);
  const mood = useAiFlowStore((state) => state.mood);
  const setOccasion = useAiFlowStore((state) => state.setOccasion);
  const setStyle = useAiFlowStore((state) => state.setStyle);
  const setMood = useAiFlowStore((state) => state.setMood);

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
          onPress={() => goBack('/(tabs)')}
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
        {/*
          Tanlovlar — maketdagi OCCASION / STYLE / MOOD kartalari.

          ⚠️ ULAR QAYTA TIKLANDI. Bir vaqtlar olib tashlangan edi
          («gologramma rasmida ular allaqachon bor») — lekin rasmdagilari
          BEZAK, bosib bo'lmaydi. Natijada `aiFlowStore` dagi qiymatlar
          sukut bo'yicha qolib ketardi va AI hammaga bir xil komplekt
          taklif qilardi. Deckning va'dasi esa aynan shu: «user shares
          the occasion».
        */}
        <View style={styles.choices}>
          <Choice label="Tadbir" value={occasion} options={OCCASIONS} onPick={setOccasion} />
          <Choice label="Uslub" value={style} options={STYLES} onPick={setStyle} />
          <Choice label="Kayfiyat" value={mood} options={MOODS} onPick={setMood} />
        </View>

        <View style={styles.cta}>
          <Button title="AI komplekt yasasin" onPress={() => router.push('/ai/look')} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  choices: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md },
  choice: {
    flex: 1,
    gap: 2,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: 'rgba(10, 10, 15, 0.72)',
  },
  choiceLabel: { ...text.tiny, color: colors.textDim },
  choiceValue: { ...text.bodyMed, color: colors.text },

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
});
