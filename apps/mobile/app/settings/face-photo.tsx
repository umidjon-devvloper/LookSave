import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { getFullProfile, updateProfile } from '../../src/api/endpoints';
import { Icon, type IconName } from '../../src/components/Icon';
import { SignInRequired } from '../../src/components/SignInRequired';
import { Button, ErrorView, Loading } from '../../src/components/ui';
import { useAuthStore } from '../../src/store/authStore';
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

/** Rozilik ekranidagi bandlar bilan bir xil — matn ikki joyda ajralib ketmasin. */
const FACTS: Array<{ icon: IconName; text: string }> = [
  { icon: 'premium', text: 'Avatar yasash uchun tashqi AI xizmatiga yuborilgan' },
  { icon: 'looks', text: 'Serverimizda saqlanadi — havolani bilgan odam ocha oladi' },
  { icon: 'trash', text: 'O‘chirilganda fayl serverdan ham butunlay yo‘q qilinadi' },
];

export default function FacePhoto(): JSX.Element {
  const authStatus = useAuthStore((state) => state.status);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [done, setDone] = useState(false);

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
      setDone(true);
    },
    onError: () => Alert.alert('O‘chirilmadi', 'Tarmoqni tekshirib, qayta urinib ko‘ring.'),
  });

  if (authStatus !== 'signedIn') {
    return <SignInRequired title="Yuz surati" hint="Ko‘rish uchun hisobingizga kiring." />;
  }

  if (profile.isLoading) return <Loading />;
  if (profile.isError) {
    return <ErrorView message="Profil yuklanmadi" onRetry={() => void profile.refetch()} />;
  }

  const url = profile.data?.faceTextureUrl ?? null;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Yuz surati</Text>

      {done || !url ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Icon name={done ? 'authentic' : 'camera'} size={22} color={colors.accent} />
          </View>
          <Text style={styles.emptyTitle}>{done ? 'Surat o‘chirildi' : 'Yuz surati yo‘q'}</Text>
          <Text style={styles.emptyHint}>
            {done
              ? 'Fayl serverdan ham o‘chirildi. Avatar endi faqat o‘lchovlaringizdan yasaladi.'
              : 'Avatar hozir faqat o‘lchovlaringizdan yasaladi. Xohlasangiz yuz qo‘shishingiz mumkin.'}
          </Text>

          {!done ? (
            <Button title="Yuz skaneriga o‘tish" onPress={() => router.push('/ai/avatar')} />
          ) : null}
        </View>
      ) : (
        <>
          <View style={styles.preview}>
            <Image source={{ uri: url }} style={styles.image} resizeMode="cover" />
          </View>

          <View style={styles.facts}>
            {FACTS.map((fact) => (
              <View key={fact.text} style={styles.factRow}>
                <Icon name={fact.icon} size={14} color={colors.textMuted} />
                <Text style={styles.factText}>{fact.text}</Text>
              </View>
            ))}
          </View>

          <Button
            title="Suratni o‘chirish"
            variant="danger"
            loading={remove.isPending}
            onPress={() =>
              Alert.alert(
                'Yuz suratini o‘chirish',
                'Surat serverdan butunlay o‘chadi va avatar uni ishlatmay qo‘yadi. Bu amalni qaytarib bo‘lmaydi.',
                [
                  { text: 'Bekor qilish', style: 'cancel' },
                  {
                    text: 'O‘chirish',
                    style: 'destructive',
                    onPress: () => remove.mutate(),
                  },
                ],
              )
            }
          />

          <Pressable onPress={() => goBack('/profile')} style={styles.back}>
            <Text style={styles.backText}>Orqaga</Text>
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
