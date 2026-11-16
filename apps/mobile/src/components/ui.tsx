import { forwardRef, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import { Icon, type IconName } from './Icon';
import { ApiError } from '../api/client';
import { explainError } from '../api/explainError';
import { useI18n } from '../i18n';
import { colors, radius, spacing, text } from '../theme/tokens';

/**
 * Har bir ekranda uchta holat majburiy: `loading`, `empty`, `error`
 * (05-mobile.md §5). Bo'sh oq ekran hech qachon ko'rinmaydi.
 */

export function Loading({ label }: { label?: string }): JSX.Element {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.primary} />
      {label ? <Text style={styles.hint}>{label}</Text> : null}
    </View>
  );
}

/**
 * Bo'sh holat.
 *
 * ⚠️ IKONKA BEJIZ EMAS. Faqat matndan iborat bo'sh ekran "xato bo'ldimi?"
 * degan taassurot qoldiradi. Doira ichidagi belgi esa bu holat ATAYIN
 * ekanini bildiradi — ya'ni hammasi joyida, shunchaki hali hech narsa yo'q.
 */
export function Empty({
  title,
  hint,
  icon = 'search',
  action,
}: {
  title: string;
  hint?: string;
  icon?: IconName;
  action?: ReactNode;
}): JSX.Element {
  return (
    <View style={styles.center}>
      <View style={styles.emptyIcon}>
        <Icon name={icon} size={26} color={colors.primary} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      {action ? <View style={styles.emptyAction}>{action}</View> : null}
    </View>
  );
}

/**
 * Xato holati.
 *
 * ⚠️ TARMOQ XATOSI ALOHIDA AJRATILADI. Ilgari hamma nosozlik "Xatolik yuz
 * berdi" deb ko'rsatilardi va yonida "Qayta urinish" tugmasi turardi. Lekin
 * internet yo'q bo'lsa qayta urinish HECH QACHON ishlamaydi — foydalanuvchi
 * tugmani bosaveradi va ilova buzuq deb o'ylaydi.
 *
 * `NETWORK` kodi kelganda sabab aniq aytiladi ("ulanishni tekshiring"),
 * ya'ni odam nima qilishini biladi.
 *
 * ⚠️ TUGMA MATNI i18n'DAN. Ilgari u qattiq "Qayta urinish" edi va qurilma
 * boshqa tilda bo'lsa ekranda ikki til aralashardi: xabar inglizcha,
 * tugma o'zbekcha.
 */
export function ErrorView({
  message,
  error,
  onRetry,
}: {
  message?: string;
  /** Ushlangan xato — tarmoq nosozligini ajratish uchun */
  error?: unknown;
  onRetry?: () => void;
}): JSX.Element {
  const t = useI18n((state) => state.t);

  const isNetwork = error instanceof ApiError && error.code === 'NETWORK';
  /*
   * ⚠️ XOM SERVER MATNI EMAS. `message` — chaqiruvchi bergan LOKAL matn
   * (allaqachon tarjima qilingan). Berilmasa va `error` bo'lsa, uni kod
   * bo'yicha `explainError` lokalga o'giradi — serverning o'zbekcha matni
   * ekranga tushmaydi. Hech biri bo'lmasa umumiy xabar.
   */
  const text = message ?? (error !== undefined ? explainError(error, t) : t.errors.generic);

  return (
    <View style={styles.center}>
      <View style={styles.errorIcon}>
        <Icon name={isNetwork ? 'settings' : 'close'} size={26} color={colors.danger} />
      </View>

      <Text style={styles.errorTitle}>{text}</Text>

      {onRetry ? (
        <View style={styles.emptyAction}>
          <Button title={t.common.retry} variant="ghost" onPress={onRetry} />
        </View>
      ) : null}
    </View>
  );
}

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  /** Yozuvdan oldin turadigan ikonka */
  icon?: IconName;
  /** Yozuvdan keyin turadigan ikonka — odatda «davom etish» strelkasi */
  trailingIcon?: IconName;
  /** To'liq dumaloq chekka. Ekranning ASOSIY amali uchun — maketdagidek */
  pill?: boolean;
}

/**
 * `forwardRef` SHART: `<Link asChild><Button/></Link>` shaklida expo-router
 * bolasiga `ref` uzatadi (bosilishni o'zi ushlab, navigatsiyani bajaradi).
 * Oddiy funksiya komponenti `ref` ni qabul qilolmaydi va React ogohlantiradi.
 */
export const Button = forwardRef<View, ButtonProps>(function Button(
  {
    title,
    onPress,
    variant = 'primary',
    disabled = false,
    loading = false,
    icon,
    trailingIcon,
    pill = false,
  },
  ref,
): JSX.Element {
  const isDisabled = disabled || loading;

  /*
   * Bosishda kichrayish.
   *
   * ⚠️ NEGA SHAFFOFLIK YETMAYDI: `opacity` tugmani xiralashtiradi, ya'ni
   * uni O'CHIQ ko'rsatadi — bosilgan emas. Kichrayish esa jismoniy javob:
   * barmoq ostida narsa bosilgandek tuyuladi. Farq kichik, lekin sifat
   * hissi shunday tafsilotlardan yig'iladi.
   *
   * `useNativeDriver` — animatsiya JS oqimidan mustaqil ishlaydi va
   * ro'yxat aylanayotganda ham silliq qoladi.
   */
  const scale = useRef(new Animated.Value(1)).current;

  const press = (to: number): void => {
    Animated.spring(scale, {
      toValue: to,
      useNativeDriver: true,
      speed: 40,
      bounciness: 4,
    }).start();
  };

  /*
   * Atelier: tugma ichidagi matn va ikonka rangi varianti bo'yicha.
   *  - primary: anor to'ldirilgan fon → krem (textOnPrimary) matn
   *  - ghost:   oq quti, chegara → ink matn
   *  - danger:  xira qizil quti → danger matn/ikonka
   */
  const contentColor =
    variant === 'danger'
      ? colors.danger
      : variant === 'primary'
        ? colors.textOnPrimary
        : colors.text;

  const label = <Text style={[styles.buttonText, { color: contentColor }]}>{title}</Text>;

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        ref={ref}
        accessibilityRole="button"
        accessibilityState={{ disabled: isDisabled, busy: loading }}
        onPress={onPress}
        onPressIn={() => press(0.97)}
        onPressOut={() => press(1)}
        disabled={isDisabled}
        style={[
          styles.button,
          pill && styles.buttonPill,
          variant === 'ghost' && styles.buttonGhost,
          variant === 'danger' && styles.buttonDanger,
          isDisabled && { opacity: 0.45 },
        ]}
      >
        {/*
          Atelier: primary tugma TOZA bir rangli anor. Oldingi gradient
          "SaaS brand gradient" klişesi edi; endi moda-uyining qat'iy
          to'ldirilgan quti — rang bir xil, hajmni tipografika beradi.
        */}
        {variant === 'primary' ? (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.primary }]} />
        ) : null}

        {loading ? (
          <ActivityIndicator color={contentColor} />
        ) : (
          <View style={styles.buttonRow}>
            {icon ? <Icon name={icon} size={20} color={contentColor} /> : null}
            {label}
            {trailingIcon ? <Icon name={trailingIcon} size={19} color={contentColor} /> : null}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
});

/**
 * Kiritish maydoni.
 *
 * ⚠️ FOKUS HOLATI QO'SHILDI. Ilgari maydon bosilganda hech narsa
 * o'zgarmasdi — foydalanuvchi qaysi maydonga yozayotganini faqat
 * klaviatura kursoridan bilardi. Bir necha maydonli formada (ro'yxatdan
 * o'tish, o'lchovlar) bu chalkashtiradi.
 *
 * Chegara rangi va fon o'zgaradi — soya emas: Android'da soya
 * `elevation` talab qiladi va u chegarani noto'g'ri chizadi.
 */
export function Field({
  label,
  error,
  onFocus,
  onBlur,
  ...props
}: TextInputProps & { label?: string; error?: string | null }): JSX.Element {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.field}>
      {/*
        ⚠️ Sarlavha IXTIYORIY. Ba'zi joyda u `placeholder` bilan bir xil
        matn bo'lib, ekranda ikki marta takrorlanardi ("SEARCH PRODUCTS…"
        ustida yana "Search products…"). Bunday joyda faqat `placeholder`
        qoldiriladi.
      */}
      {label ? (
        <Text style={[styles.label, focused && { color: colors.accent }]}>{label}</Text>
      ) : null}
      <TextInput
        {...props}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        placeholderTextColor={colors.textDim}
        style={[
          styles.input,
          focused && styles.inputFocused,
          // Xato fokusdan ustun: yozayotganda ham ko'rinib turishi kerak
          error ? styles.inputError : null,
        ]}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

export function Screen({ children }: { children: ReactNode }): JSX.Element {
  return <View style={styles.screen}>{children}</View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  emptyTitle: { ...text.h3, color: colors.text, textAlign: 'center' },

  /*
   * Xato sarlavhasi OQ, qizil emas. Qizil matn butun ekranni tashvishli
   * qiladi; sababni ikonka bildiradi, matn esa o'qilishi kerak.
   */
  errorTitle: { ...text.body, color: colors.text, textAlign: 'center', maxWidth: 300 },
  // Atelier: xato ikonkasi doirasi — primarySoft bilan bir qarindosh
  // (danger anorning quyuqrog'i), chegara shu oilaning to'q qatlami
  errorIcon: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(142,45,34,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(142,45,34,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  emptyAction: { alignSelf: 'stretch', marginTop: spacing.md },
  hint: { ...text.small, color: colors.textDim, textAlign: 'center' },

  button: {
    height: 52,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    // Gradient `absoluteFill` bilan ichkariga chiziladi — chekkasi kesilishi shart
    overflow: 'hidden',
  },
  buttonPill: { height: 54, borderRadius: radius.pill },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    maxWidth: '100%',
  },
  buttonGhost: { borderWidth: 1, borderColor: colors.borderStrong },
  // Och qizil fon — bo'sh ramka emas, «xavfli amal» ekani bir qarashda ko'rinsin
  buttonDanger: {
    borderWidth: 1,
    borderColor: colors.danger,
    // Danger ham anor oilasining quyuq qatlami — palette yaxlit qoladi
    backgroundColor: 'rgba(142,45,34,0.08)',
  },
  buttonText: { ...text.bodyMed, color: colors.text, flexShrink: 1, textAlign: 'center' },

  field: { marginBottom: spacing.md },
  label: { ...text.label, color: colors.textDim, marginBottom: spacing.sm },
  input: {
    height: 52,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    color: colors.text,
    ...text.body,
  },
  inputFocused: { borderColor: colors.borderAccent, backgroundColor: colors.surface2 },
  inputError: { borderColor: colors.danger },
  error: { ...text.small, color: colors.danger, marginTop: spacing.xs },
});
