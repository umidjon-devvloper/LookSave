import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { getFullProfile, updateProfile } from '../../src/api/endpoints';
import { Icon, type IconName } from '../../src/components/Icon';
import { SignInRequired } from '../../src/components/SignInRequired';
import { Button, ErrorView, Loading } from '../../src/components/ui';
import { useI18n, type Dictionary } from '../../src/i18n';
import { useAuthStore } from '../../src/store/authStore';
import { isFaceLocked, setFaceLocked } from '../../src/store/faceLock';
import { colors, radius, spacing, text } from '../../src/theme/tokens';
import { goBack } from '../../src/navigation/back';

/**
 * Yuz surati — ko'rish va o'chirish.
 *
 * ⚠️ BU EKRAN VA'DANI BAJARADI. Yuz skaneridagi rozilik matni "istalgan
 * vaqtda o'chirasiz" deydi (12-tz.md D-42). Ilgari bunday yo'l umuman
 * yo'q edi: surat bir marta yuklansa, foydalanuvchi uni hech qachon
 * olib tashlay olmasdi. Ya'ni matn yozilgani bilan amalda bajarilmasdi.
 *
 * ⚠️ IKKALA MAYDON BIRGA TOZALANADI. Skaner bitta suratni ham profil
 * surati (`avatarUrl`), ham yuz teksturasi (`faceTextureUrl`) sifatida
 * yozadi. Faqat bittasini tozalasak, o'sha fayl ikkinchi havola orqali
 * ochilaverardi — ya'ni "o'chirdim" degan tugma hech narsani
 * o'chirmagan bo'lardi.
 */

/** Rozilik ekranidagi bandlar bilan bir xil — matni i18n (`t.facePhoto`) dan. */
const FACTS: Array<{ icon: IconName; key: keyof Dictionary['facePhoto'] }> = [
  { icon: 'premium', key: 'fact1' },
  { icon: 'looks', key: 'fact2' },
  { icon: 'trash', key: 'fact3' },
];

export default function FacePhoto(): JSX.Element {
  const authStatus = useAuthStore((state) => state.status);
  const t = useI18n((state) => state.t);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [done, setDone] = useState(false);

  // Yuz qulfi — qurilma-lokal bayroq, Switch'da ko'rsatiladi
  const [locked, setLocked] = useState(false);
  useEffect(() => {
    void isFaceLocked().then(setLocked);
  }, []);
  const toggleLock = (next: boolean): void => {
    setLocked(next); // optimistik — ekran darhol javob bersin
    void setFaceLocked(next);
  };

  const profile = useQuery({
    queryKey: ['profile', 'full'],
    queryFn: getFullProfile,
    enabled: authStatus === 'signedIn',
  });

  const remove = useMutation({
    /*
     * Ikkalasi BIR SO'ROVDA tozalanadi. Ketma-ket ikki so'rov bo'lsa,
     * oradagi xato bir maydonni tozalab, ikkinchisini qoldirardi —
     * fayl esa baribir ochiq qolardi.
     */
    mutationFn: () => updateProfile({ avatarUrl: null, faceTextureUrl: null }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['profile'] });
      // Avatar konfiguratsiyasida ham yuz teksturasi bor — u eskirdi
      await queryClient.invalidateQueries({ queryKey: ['avatar'] });
      // Qurilma-lokal qulf ham olib tashlanadi: surat o'chirilsa qulf
      // ma'nosiz; qolsa, /ai/avatar da qayta skan yo'li yopilib qoladi.
      await setFaceLocked(false);
      setLocked(false);
      setDone(true);
    },
    onError: () => Alert.alert(t.facePhoto.deleteFailedTitle, t.facePhoto.deleteFailedBody),
  });

  if (authStatus !== 'signedIn') {
    return <SignInRequired title={t.profile.facePhoto} hint={t.facePhoto.signInHint} />;
  }

  if (profile.isLoading) return <Loading />;
  if (profile.isError) {
    return <ErrorView message={t.avatar.profileLoadError} onRetry={() => void profile.refetch()} />;
  }

  const url = profile.data?.faceTextureUrl ?? null;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t.profile.facePhoto}</Text>

      {done || !url ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Icon name={done ? 'authentic' : 'camera'} size={22} color={colors.accent} />
          </View>
          <Text style={styles.emptyTitle}>
            {done ? t.facePhoto.deletedTitle : t.facePhoto.noFaceTitle}
          </Text>
          <Text style={styles.emptyHint}>
            {done ? t.facePhoto.deletedHint : t.facePhoto.noFaceHint}
          </Text>

          {!done ? (
            <Button title={t.facePhoto.goToScanner} onPress={() => router.push('/ai/avatar')} />
          ) : null}
        </View>
      ) : (
        <>
          <View style={styles.preview}>
            <Image source={{ uri: url }} style={styles.image} resizeMode="cover" />
          </View>

          {/*
            Qulf — bir marta skanlangan yuzni tasodifan /ai/avatar oqimi
            qayta yozib yubormasligi uchun. Faqat shu qurilma darajasi,
            server bilmaydi.
          */}
          <View style={styles.lockRow}>
            <View style={styles.lockText}>
              <Text style={styles.lockTitle}>{t.facePhoto.lockTitle}</Text>
              <Text style={styles.lockHint}>{t.facePhoto.lockHint}</Text>
            </View>
            <Switch
              value={locked}
              onValueChange={toggleLock}
              trackColor={{ false: colors.borderStrong, true: colors.accent }}
              thumbColor={colors.text}
            />
          </View>

          <View style={styles.facts}>
            {FACTS.map((fact) => (
              <View key={fact.key} style={styles.factRow}>
                <Icon name={fact.icon} size={14} color={colors.textMuted} />
                <Text style={styles.factText}>{t.facePhoto[fact.key]}</Text>
              </View>
            ))}
          </View>

          <Button
            title={t.facePhoto.deletePhoto}
            variant="danger"
            loading={remove.isPending}
            onPress={() =>
              Alert.alert(t.facePhoto.deleteConfirmTitle, t.facePhoto.deleteConfirmBody, [
                { text: t.common.cancel, style: 'cancel' },
                {
                  text: t.facePhoto.delete,
                  style: 'destructive',
                  onPress: () => remove.mutate(),
                },
              ])
            }
          />

          <Pressable onPress={() => goBack('/profile')} style={styles.back}>
            <Text style={styles.backText}>{t.facePhoto.back}</Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, gap: spacing.md },
  title: { ...text.h2, color: colors.text },

  preview: { alignItems: 'center' },
  image: {
    width: 180,
    height: 180,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },

  lockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  lockText: { flex: 1, gap: 2 },
  lockTitle: { ...text.body, color: colors.text, fontWeight: '600' },
  lockHint: { ...text.tiny, color: colors.textMuted },

  facts: { gap: spacing.sm },
  factRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  factText: { ...text.tiny, color: colors.textMuted, flex: 1 },

  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  emptyTitle: { ...text.h3, color: colors.text },
  emptyHint: { ...text.small, color: colors.textMuted, textAlign: 'center' },

  back: { alignSelf: 'center', padding: spacing.sm },
  backText: { ...text.small, color: colors.textMuted },
});
