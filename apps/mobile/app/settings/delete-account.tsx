import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { deleteAccount, getDeletionStatus, restoreAccount } from '../../src/api/endpoints';
import { Button, ErrorView, Loading } from '../../src/components/ui';
import { explainError } from '../../src/api/explainError';
import { useI18n } from '../../src/i18n';
import { useAuthStore } from '../../src/store/authStore';
import { colors, radius, spacing, text } from '../../src/theme/tokens';
import { goBack } from '../../src/navigation/back';

/**
 * Akkauntni o'chirish (App Store Guideline 5.1.1(v)).
 *
 * Apple talab qiladi: ilova ichida akkauntni o'chirish yo'li bo'lsin,
 * qo'llab-quvvatlashga yozish yetarli emas. Shuning uchun bu ekran
 * profilda ochiq turadi.
 *
 * 30 kun kutish (03-api-spec §5) — foydalanuvchiga aniq sana
 * ko'rsatiladi va qaytarish tugmasi beriladi.
 */
export default function DeleteAccount(): JSX.Element {
  const t = useI18n((state) => state.t);
  const queryClient = useQueryClient();
  const signOut = useAuthStore((state) => state.signOut);

  const [error, setError] = useState<string | null>(null);

  const status = useQuery({ queryKey: ['deletion-status'], queryFn: getDeletionStatus });

  const remove = useMutation({
    mutationFn: () => deleteAccount(),
    onSuccess: () => {
      // Server barcha sessiyalarni yopdi — ilovada ham chiqamiz
      void signOut();
      router.replace('/(auth)/welcome');
    },
    onError: (err: unknown) => {
      setError(explainError(err, t));
    },
  });

  const restore = useMutation({
    mutationFn: restoreAccount,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['deletion-status'] });
    },
  });

  if (status.isLoading) return <Loading />;
  if (status.isError) {
    return <ErrorView error={status.error} onRetry={() => void status.refetch()} />;
  }

  const scheduled = status.data?.scheduledFor;

  if (status.data?.pending === true) {
    return (
      <ScrollView contentContainerStyle={styles.screen}>
        <View style={styles.warningBox}>
          <Text style={styles.warningTitle}>{t.deleteAccount.pendingTitle}</Text>
          <Text style={styles.body}>
            {t.deleteAccount.pendingBody}
            {scheduled ? ` ${new Date(scheduled).toLocaleDateString('uz-UZ')}` : ''}
          </Text>
        </View>

        <Text style={styles.body}>{t.deleteAccount.restoreHint}</Text>

        <Button
          title={t.deleteAccount.restore}
          loading={restore.isPending}
          onPress={() => {
            restore.mutate();
          }}
        />
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Text style={styles.title}>{t.deleteAccount.title}</Text>

      <View style={styles.warningBox}>
        <Text style={styles.warningTitle}>{t.deleteAccount.whatHappens}</Text>
        <Text style={styles.bullet}>• {t.deleteAccount.point1}</Text>
        <Text style={styles.bullet}>• {t.deleteAccount.point2}</Text>
        <Text style={styles.bullet}>• {t.deleteAccount.point3}</Text>
        <Text style={styles.bullet}>• {t.deleteAccount.point4}</Text>
      </View>

      {/*
        ⚠️ PAROL MAYDONI OLIB TASHLANDI (2026-11-16, egasining qarori).
        Himoya — shu aniq «danger» tugmasi va 30 kunlik kutish muddati:
        o'sha davrda qayta kirish o'chirishni bekor qiladi.
      */}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button
        title={t.deleteAccount.confirm}
        variant="danger"
        loading={remove.isPending}
        onPress={() => {
          remove.mutate();
        }}
      />

      <Button
        title={t.common.cancel}
        variant="ghost"
        onPress={() => {
          goBack('/profile');
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { padding: spacing.md, gap: spacing.md },
  title: { ...text.h2, color: colors.text },
  body: { ...text.body, color: colors.textMuted },
  bullet: { ...text.small, color: colors.textMuted, marginTop: spacing.xs },
  error: { ...text.small, color: colors.danger },
  warningBox: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  warningTitle: { ...text.h3, color: colors.danger, marginBottom: spacing.xs },
});
