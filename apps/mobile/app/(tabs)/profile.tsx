import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getFullProfile, updateProfile } from '../../src/api/endpoints';
import { Icon, type IconName } from '../../src/components/Icon';
import { AvatarPicker } from '../../src/components/profile/AvatarPicker';
import { SignInRequired } from '../../src/components/SignInRequired';
import { Button, Screen } from '../../src/components/ui';
import { rtlStyles, useI18n } from '../../src/i18n';
import { useAuthStore } from '../../src/store/authStore';
import { phone as formatPhone } from '../../src/theme/format';
import { colors, radius, spacing, text } from '../../src/theme/tokens';

const LOCALES = [
  { value: 'uz', label: "O'zbekcha" },
  { value: 'ru', label: 'Русский' },
  { value: 'en', label: 'English' },
  { value: 'ar', label: 'العربية' },
] as const;

function Row({
  icon,
  label,
  hint,
  onPress,
  isRTL,
}: {
  icon: IconName;
  label: string;
  hint?: string;
  onPress: () => void;
  isRTL: boolean;
}): JSX.Element {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        rtlStyles.row(isRTL),
        pressed && { backgroundColor: colors.surface2 },
      ]}
      onPress={onPress}
    >
      <View style={[styles.rowIcon, isRTL ? { marginRight: 0, marginLeft: spacing.sm } : null]}>
        <Icon name={icon} size={18} color={colors.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowLabel, rtlStyles.text(isRTL)]}>{label}</Text>
        {hint ? <Text style={[styles.rowHint, rtlStyles.text(isRTL)]}>{hint}</Text> : null}
      </View>
      <Icon name={isRTL ? 'back' : 'next'} size={18} color={colors.textDim} />
    </Pressable>
  );
}

/** Uchta raqam: buyurtma, sevimli, komplekt — deckdagi qorong'i kartochkalarda. */
function Stat({ value, label }: { value: number; label: string }): JSX.Element {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function Profile(): JSX.Element {
  const router = useRouter();
  const status = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);
  const { locale, setLocale, t, isRTL } = useI18n();

  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const signedIn = status === 'signedIn';

  /*
   * Kirmagan foydalanuvchi uchun so'rov YUBORILMAYDI. `enabled: false`
   * bo'lmasa `GET /profile` 401 qaytaradi va ekranda "xato" ko'rinadi —
   * holbuki bu xato emas, shunchaki hali kirilmagan.
   */
  const profile = useQuery({
    queryKey: ['profile'],
    queryFn: getFullProfile,
    enabled: signedIn,
  });

  const saveAvatar = useMutation({
    mutationFn: (avatarUrl: string) => updateProfile({ avatarUrl }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profile'] }),
  });

  const height = profile.data?.measurements.height;
  const openOrders = profile.data?.trust.openOrders ?? 0;

  if (!signedIn) {
    return (
      <SignInRequired
        title="Profilingiz"
        hint="Buyurtmalar, o‘lchamlar va sevimlilar akkauntingizga bog‘lanadi. Katalogni ko‘rish uchun esa kirish shart emas."
      />
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Sarlavha kartasi — surat, ism va uchta raqam */}
        <View style={[styles.header, { paddingTop: insets.top + spacing.lg }]}>
          <LinearGradient
            colors={['rgba(76,42,158,0.35)', 'rgba(10,10,15,0)']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
          />

          <AvatarPicker
            url={profile.data?.avatarUrl ?? user?.avatarUrl ?? null}
            name={user?.fullName ?? null}
            onChange={async (url) => {
              await saveAvatar.mutateAsync(url);
            }}
            labels={{
              change: t.profile.changePhoto,
              permission: t.profile.photoPermission,
              failed: t.profile.photoFailed,
            }}
          />

          <Text style={styles.name}>{user?.fullName ?? t.profile.user}</Text>
          <Text style={styles.phone}>{user ? formatPhone(user.phone) : ''}</Text>

          <View style={styles.stats}>
            <Stat value={openOrders} label={t.profile.statOrders} />
            <View style={styles.statDivider} />
            <Stat value={profile.data?.favoritesCount ?? 0} label={t.profile.statFavorites} />
            <View style={styles.statDivider} />
            <Stat value={profile.data?.looksCount ?? 0} label={t.profile.statLooks} />
          </View>
        </View>

        <View style={styles.group}>
          <Row
            icon="orders"
            label={t.order.myOrders}
            hint={openOrders > 0 ? `${openOrders} ta faol` : undefined}
            onPress={() => router.push('/orders')}
            isRTL={isRTL}
          />
          <Row
            icon="favorite"
            label={t.profile.myFavorites}
            onPress={() => router.push('/favorites')}
            isRTL={isRTL}
          />
          <Row
            icon="looks"
            label={t.profile.myLooks}
            onPress={() => router.push('/looks')}
            isRTL={isRTL}
          />
          <Row
            icon="slotTop"
            label={t.profile.myMeasurements}
            hint={height === undefined ? t.profile.noMeasurements : `${height} sm`}
            onPress={() => router.push('/settings/measurements')}
            isRTL={isRTL}
          />
        </View>

        <View style={styles.group}>
          <Text style={styles.groupTitle}>{t.profile.language}</Text>
          <View style={[styles.locales, rtlStyles.row(isRTL)]}>
            {LOCALES.map((option) => (
              <Pressable
                key={option.value}
                onPress={() => setLocale(option.value)}
                style={[styles.locale, locale === option.value && styles.localeActive]}
              >
                <Text
                  style={[styles.localeText, locale === option.value && { color: colors.text }]}
                >
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {profile.data?.trust.isRestricted ? (
          <Text style={styles.restricted}>{t.profile.restricted}</Text>
        ) : null}

        <View style={{ flex: 1 }} />

        <Button title={t.profile.signOut} variant="ghost" onPress={() => void signOut()} />

        {/* App Store Guideline 5.1.1(v): akkauntni o'chirish ilova ichida
            bo'lishi shart, qo'llab-quvvatlashga yozish yetarli emas */}
        <Button
          title={t.profile.deleteAccount}
          variant="danger"
          onPress={() => router.push('/settings/delete-account')}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginHorizontal: -spacing.md,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  name: { ...text.h2, color: colors.text, marginTop: spacing.sm },
  phone: { ...text.small, color: colors.textMuted },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { ...text.h3, color: colors.text },
  statLabel: { ...text.tiny, color: colors.textDim, textTransform: 'uppercase', letterSpacing: 1 },
  statDivider: { width: 1, height: 26, backgroundColor: colors.border },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
    marginRight: spacing.sm,
  },
  group: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  groupTitle: { ...text.label, color: colors.textDim, padding: spacing.md, paddingBottom: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLabel: { ...text.body, color: colors.text },
  rowHint: { ...text.small, color: colors.textDim, marginTop: 2 },
  locales: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, padding: spacing.md },
  locale: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  localeActive: { borderColor: colors.primary, backgroundColor: colors.surface2 },
  localeText: { ...text.small, color: colors.textMuted },
  restricted: { ...text.small, color: colors.warning },
});
