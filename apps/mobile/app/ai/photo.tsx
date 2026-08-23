import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { SaveFormat, manipulateAsync } from 'expo-image-manipulator';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '../../src/components/Icon';
import { SignInRequired } from '../../src/components/SignInRequired';
import { Button } from '../../src/components/ui';
import { getFullProfile, uploadBodyPhoto } from '../../src/api/endpoints';
import { useAuthStore } from '../../src/store/authStore';
import { colors, radius, spacing, text } from '../../src/theme/tokens';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

/**
 * To'liq bo'yli surat — AI kiyintirishning asosi.
 *
 * ⚠️ BU EKRAN NATIJANI BELGILAYDI. AI kiyimni aynan shu suratdagi gavdaga
 * kiydiradi, ya'ni surat qanday bo'lsa natija ham shunday chiqadi. Qiyshiq,
 * qorong'i yoki yarim gavda surat berilsa — natija ham shunday bo'ladi va
 * foydalanuvchi buni "AI yomon" deb tushunadi.
 *
 * Shuning uchun bu yerda talablar OLDINDAN va ANIQ ko'rsatiladi, xato
 * chiqqandan keyin emas. Har bir talab natijaga qanday ta'sir qilishini
 * bilgan holda yozilgan.
 */

const RULES: Array<{ icon: IconName; title: string; hint: string }> = [
  {
    icon: 'profile',
    title: 'To`liq gavda',
    hint: 'Boshdan oyoqgacha ko`rinsin — kesilgan surat ishlamaydi',
  },
  {
    icon: 'tryon',
    title: 'Tik turing',
    hint: 'Qo`llar yon tomonda, tanaga yopishmagan holda',
  },
  {
    icon: 'looks',
    title: 'Sodda fon',
    hint: 'Bir tekis devor eng yaxshisi — naqshli fon chalg`itadi',
  },
  {
    icon: 'favorite',
    title: 'Tor kiyim',
    hint: 'Keng kiyim gavda shaklini yashiradi va o`lcham noto`g`ri chiqadi',
  },
];

export default function BodyPhotoScreen(): JSX.Element {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const authStatus = useAuthStore((state) => state.status);

  const [preview, setPreview] = useState<string | null>(null);

  const profile = useQuery({
    queryKey: ['profile'],
    queryFn: getFullProfile,
    enabled: authStatus === 'signedIn',
  });

  const upload = useMutation({
    mutationFn: uploadBodyPhoto,
    onSuccess: async () => {
      // Profil yangilanmasa keyingi ekran suratni topmaydi
      await queryClient.invalidateQueries({ queryKey: ['profile'] });
      router.replace('/ai/fitting');
    },
    onError: () => {
      setPreview(null);
      Alert.alert('Surat yuklanmadi', 'Internetni tekshirib qaytadan urinib ko`ring.');
    },
  });

  if (authStatus !== 'signedIn') {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <SignInRequired
          title="Kirish kerak"
          hint="AI kiyintirish suratingizga bog`langan, shuning uchun akkaunt kerak."
        />
      </View>
    );
  }

  const existing = profile.data?.bodyPhotoUrl ?? null;
  const shown = preview ?? existing;

  /**
   * Surat tanlash.
   *
   * ⚠️ `allowsEditing` ATAYIN O'CHIRILGAN. Kesish oynasi kvadratga
   * majburlaydi va odamning oyog'i yoki boshi kesilib qoladi — AI esa
   * aynan to'liq gavdani talab qiladi.
   */
  const pick = async (from: 'camera' | 'library'): Promise<void> => {
    const permission =
      from === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        'Ruxsat kerak',
        from === 'camera'
          ? 'Surat olish uchun kameraga ruxsat bering.'
          : 'Surat tanlash uchun galereyaga ruxsat bering.',
      );
      return;
    }

    const result =
      from === 'camera'
        ? await ImagePicker.launchCameraAsync({ quality: 0.9 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });

    if (result.canceled || !result.assets[0]) return;

    /*
     * ⚠️ BURILISH PIKSELGA SINGDIRILADI. Kamera suratni sensor
     * yo'nalishida saqlaydi va to'g'ri tomonni EXIF belgisida ko'rsatadi.
     * Telefonda u to'g'ri ko'rinadi, lekin AI provayderiga berilganda
     * belgi hisobga olinmaydi va odam yonboshlab ketadi.
     *
     * `manipulateAsync` amalsiz chaqirilsa ham suratni qayta kodlaydi va
     * burilishni pikselga singdiradi.
     */
    const upright = await manipulateAsync(result.assets[0].uri, [], {
      compress: 0.9,
      format: SaveFormat.JPEG,
    });

    setPreview(upright.uri);
    upload.mutate(upright.uri);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Orqaga"
          hitSlop={10}
          onPress={() => router.back()}
          style={styles.back}
        >
          <Icon name="back" size={20} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Suratingiz</Text>
        <View style={styles.back} />
      </View>

      <View style={styles.content}>
        {/* Ko'rinish maydoni */}
        <View style={styles.frame}>
          {shown ? (
            <Image source={{ uri: shown }} style={styles.photo} resizeMode="cover" />
          ) : (
            <LinearGradient
              colors={[colors.surface2, colors.surface]}
              style={styles.photo}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.emptyInner}>
                <Icon name="camera" size={34} color={colors.accent} />
                <Text style={styles.emptyText}>Surat hali yo`q</Text>
              </View>
            </LinearGradient>
          )}

          {upload.isPending ? (
            <View style={styles.busy}>
              <ActivityIndicator color={colors.accent} />
              <Text style={styles.busyText}>Yuklanmoqda…</Text>
            </View>
          ) : null}
        </View>

        {/* Talablar */}
        <View style={styles.rules}>
          {RULES.map((rule) => (
            <View key={rule.title} style={styles.rule}>
              <View style={styles.ruleIcon}>
                <Icon name={rule.icon} size={16} color={colors.accent} />
              </View>
              <View style={styles.ruleText}>
                <Text style={styles.ruleTitle}>{rule.title}</Text>
                <Text style={styles.ruleHint}>{rule.hint}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      <View style={[styles.actions, { paddingBottom: insets.bottom + spacing.md }]}>
        <Button
          title={shown ? 'Boshqa surat olish' : 'Surat olish'}
          onPress={() => void pick('camera')}
          disabled={upload.isPending}
        />
        <Button
          title="Galereyadan tanlash"
          variant="ghost"
          onPress={() => void pick('library')}
          disabled={upload.isPending}
        />

        {/*
          Surat allaqachon bor bo'lsa davom etish yo'li ochiq qoladi — qayta
          yuklash majburiy emas.
        */}
        {existing && !upload.isPending ? (
          <Pressable onPress={() => router.replace('/ai/fitting')} hitSlop={8}>
            <Text style={styles.skip}>Shu surat bilan davom etish</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.sm,
  },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...text.h3, color: colors.text, flex: 1, textAlign: 'center' },

  content: { flex: 1, paddingHorizontal: spacing.md, gap: spacing.md },

  frame: {
    flex: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  photo: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyInner: { alignItems: 'center', gap: spacing.sm },
  emptyText: { ...text.small, color: colors.textDim },

  busy: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(10, 10, 15, 0.72)',
  },
  busyText: { ...text.small, color: colors.textMuted },

  rules: { gap: spacing.sm },
  rule: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  ruleIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ruleText: { flex: 1 },
  ruleTitle: { ...text.bodyMed, color: colors.text },
  ruleHint: { ...text.tiny, color: colors.textDim },

  actions: { paddingHorizontal: spacing.md, paddingTop: spacing.md, gap: spacing.sm },
  skip: { ...text.small, color: colors.accent, textAlign: 'center', paddingVertical: spacing.xs },
});
