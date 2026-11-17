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
import { useI18n, type Dictionary } from '../../src/i18n';
import { useAuthStore } from '../../src/store/authStore';
import { colors, radius, spacing, text } from '../../src/theme/tokens';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { goBack } from '../../src/navigation/back';

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

/** Talablar — matni i18n (`t.photo`) dan, bu yerda faqat ikonka va kalit. */
const RULES: Array<{
  icon: IconName;
  titleKey: keyof Dictionary['photo'];
  hintKey: keyof Dictionary['photo'];
}> = [
  { icon: 'profile', titleKey: 'rule1Title', hintKey: 'rule1Hint' },
  { icon: 'tryon', titleKey: 'rule2Title', hintKey: 'rule2Hint' },
  { icon: 'looks', titleKey: 'rule3Title', hintKey: 'rule3Hint' },
  { icon: 'favorite', titleKey: 'rule4Title', hintKey: 'rule4Hint' },
];

export default function BodyPhotoScreen(): JSX.Element {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const t = useI18n((state) => state.t);
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
      Alert.alert(t.photo.uploadFailedTitle, t.photo.uploadFailedBody);
    },
  });

  if (authStatus !== 'signedIn') {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <SignInRequired title={t.auth.requiredTitle} hint={t.photo.signInHint} />
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
        t.photo.permissionTitle,
        from === 'camera' ? t.photo.cameraPermission : t.photo.libraryPermission,
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
          accessibilityLabel={t.common.back}
          hitSlop={10}
          onPress={() => goBack('/ai')}
          style={styles.back}
        >
          <Icon name="back" size={20} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{t.photo.title}</Text>
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
                <Text style={styles.emptyText}>{t.photo.noPhoto}</Text>
              </View>
            </LinearGradient>
          )}

          {upload.isPending ? (
            <View style={styles.busy}>
              <ActivityIndicator color={colors.accent} />
              <Text style={styles.busyText}>{`${t.common.loading}…`}</Text>
            </View>
          ) : null}
        </View>

        {/* Talablar */}
        <View style={styles.rules}>
          {RULES.map((rule) => (
            <View key={rule.titleKey} style={styles.rule}>
              <View style={styles.ruleIcon}>
                <Icon name={rule.icon} size={16} color={colors.accent} />
              </View>
              <View style={styles.ruleText}>
                <Text style={styles.ruleTitle}>{t.photo[rule.titleKey]}</Text>
                <Text style={styles.ruleHint}>{t.photo[rule.hintKey]}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      <View style={[styles.actions, { paddingBottom: insets.bottom + spacing.md }]}>
        {/*
          ⚠️ SURAT TASHQI XIZMATGA KETADI — buni tugma bosilishidan OLDIN
          aytish shart. Ilgari bu ekranda maxfiylik haqida bir og'iz ham
          yo'q edi, holbuki to'liq bo'yli surat yuz suratidan ham ko'proq
          ma'lumot beradi (12-tz.md D-42).

          Matn qisqa: uzun huquqiy paragrafni hech kim o'qimaydi va u
          hech narsani o'zgartirmaydi. Muhimi ikkita fakt — qayerga
          ketadi va qanday o'chiriladi.
        */}
        <Text style={styles.privacy}>{t.photo.privacy}</Text>

        <Button
          title={shown ? t.photo.retakePhoto : t.photo.takePhoto}
          onPress={() => void pick('camera')}
          disabled={upload.isPending}
        />
        <Button
          title={t.photo.fromGallery}
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
            <Text style={styles.skip}>{t.photo.continueWithThis}</Text>
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
  privacy: { ...text.tiny, color: colors.textDim, textAlign: 'center', marginBottom: spacing.xs },

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

  // Atelier: cream shaffof overlay (dark emas)
  busy: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(247,242,234,0.78)',
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
