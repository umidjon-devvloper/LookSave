import { forwardRef, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

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

export function Empty({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}): JSX.Element {
  return (
    <View style={styles.center}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      {action ? <View style={{ marginTop: spacing.md }}>{action}</View> : null}
    </View>
  );
}

export function ErrorView({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}): JSX.Element {
  return (
    <View style={styles.center}>
      <Text style={[styles.emptyTitle, { color: colors.danger }]}>{message}</Text>
      {onRetry ? <Button title="Qayta urinish" variant="ghost" onPress={onRetry} /> : null}
    </View>
  );
}

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
  disabled?: boolean;
  loading?: boolean;
}

/**
 * `forwardRef` SHART: `<Link asChild><Button/></Link>` shaklida expo-router
 * bolasiga `ref` uzatadi (bosilishni o'zi ushlab, navigatsiyani bajaradi).
 * Oddiy funksiya komponenti `ref` ni qabul qilolmaydi va React ogohlantiradi.
 */
export const Button = forwardRef<View, ButtonProps>(function Button(
  { title, onPress, variant = 'primary', disabled = false, loading = false },
  ref,
): JSX.Element {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      ref={ref}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' && styles.buttonPrimary,
        variant === 'ghost' && styles.buttonGhost,
        variant === 'danger' && styles.buttonDanger,
        pressed && { opacity: 0.85 },
        isDisabled && { opacity: 0.5 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.text} />
      ) : (
        <Text
          style={[
            styles.buttonText,
            variant === 'ghost' && { color: colors.textMuted },
            variant === 'danger' && { color: colors.danger },
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
});

export function Field({
  label,
  error,
  ...props
}: TextInputProps & { label: string; error?: string | null }): JSX.Element {
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...props}
        placeholderTextColor={colors.textDim}
        style={[styles.input, error ? { borderColor: colors.danger } : null]}
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
  emptyTitle: { ...text.h3, color: colors.text, textAlign: 'center' },
  hint: { ...text.small, color: colors.textDim, textAlign: 'center' },
  button: {
    height: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  buttonPrimary: { backgroundColor: colors.primary },
  buttonGhost: { borderWidth: 1, borderColor: colors.border },
  buttonDanger: { borderWidth: 1, borderColor: colors.danger },
  buttonText: { ...text.bodyMed, color: colors.text },
  label: { ...text.label, color: colors.textDim, marginBottom: spacing.sm },
  input: {
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    color: colors.text,
    ...text.body,
  },
  error: { ...text.small, color: colors.danger, marginTop: spacing.xs },
});
