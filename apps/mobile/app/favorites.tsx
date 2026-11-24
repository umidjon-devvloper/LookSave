import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { getFavorites, getPriceAlerts, removeFavorite, setPriceAlerts } from '../src/api/endpoints';
import { Icon } from '../src/components/Icon';
import { Toggle } from '../src/components/Toggle';
import { Button, Empty, ErrorView, Screen } from '../src/components/ui';
import { SignInRequired } from '../src/components/SignInRequired';
import { SkeletonGrid } from '../src/components/Skeleton';
import { ensurePushRegistered, pushPermission, type PushPermission } from '../src/hooks/usePush';
import { useI18n } from '../src/i18n';
import { useAuthStore } from '../src/store/authStore';
import { money } from '../src/theme/format';
import { colors, radius, spacing, text } from '../src/theme/tokens';

export default function Favorites(): JSX.Element {
  const router = useRouter();
  const queryClient = useQueryClient();
  const t = useI18n((state) => state.t);

  /*
   * ⚠️ QOROVUL BARCHA HOOKLARDAN KEYIN QAYTARADI, lekin holat SHU YERDA
   * o'qiladi: erta `return` hooklar tartibini buzadi va React qulaydi.
   */
  const signedIn = useAuthStore((state) => state.status) === 'signedIn';

  const favorites = useQuery({
    queryKey: ['favorites'],
    queryFn: getFavorites,
    enabled: signedIn,
  });

  const remove = useMutation({
    mutationFn: removeFavorite,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['favorites'] });
    },
  });

  /*
   * «Narx tushsa xabar» — rozilik kaliti (`api/src/catalog/favorite-alerts.ts`).
   *
   * ⚠️ SUKUT O'CHIQ VA FAQAT SHU KALIT BILAN YOQILADI. App Store 4.5.4:
   * savdoga undovchi push faqat ilovada aniq rozilikdan keyin, o'chirish
   * imkoni ham ilovaning o'zida bo'lishi shart. Kalit ostidagi matn nima
   * yuborilishini aniq aytadi — rozilik matni shu.
   */
  const alerts = useQuery({
    queryKey: ['price-alerts'],
    queryFn: getPriceAlerts,
    enabled: signedIn,
  });
  const alertsOn = alerts.data?.enabled ?? false;
  const [permission, setPermission] = useState<PushPermission | null>(null);

  useEffect(() => {
    if (alertsOn) void pushPermission().then(setPermission);
  }, [alertsOn]);

  const toggleAlerts = useMutation({
    mutationFn: async (enabled: boolean) => {
      // Ruxsat so'rovi kalit bosilgan zahoti — foydalanuvchi nima uchunligini biladi
      if (enabled) setPermission(await ensurePushRegistered());
      return setPriceAlerts(enabled);
    },
    onMutate: (enabled) => {
      const previous = queryClient.getQueryData<{ enabled: boolean }>(['price-alerts']);
      queryClient.setQueryData(['price-alerts'], { enabled });
      return { previous };
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['price-alerts'], data);
    },
    // Server rad etsa kalit avvalgi holatiga qaytadi — «yoqilgan» deb aldamasin
    onError: (_err, _enabled, context) => {
      queryClient.setQueryData(['price-alerts'], context?.previous ?? { enabled: false });
    },
  });

  // Kirmagan foydalanuvchiga xato emas, sabab ko'rsatiladi
  if (!signedIn) {
    return (
      <Screen>
        <SignInRequired />
      </Screen>
    );
  }

  if (favorites.isLoading) {
    return (
      <View style={styles.list}>
        <SkeletonGrid count={4} />
      </View>
    );
  }
  if (favorites.isError) {
    return <ErrorView error={favorites.error} onRetry={() => void favorites.refetch()} />;
  }

  return (
    <Screen>
      <FlatList
        data={favorites.data ?? []}
        keyExtractor={(product) => product.id}
        contentContainerStyle={styles.list}
        refreshing={favorites.isFetching}
        onRefresh={() => void favorites.refetch()}
        ListHeaderComponent={
          <View style={styles.alertCard}>
            <View style={styles.alertRow}>
              <View style={styles.alertIcon}>
                <Icon name="bell" size={18} color={colors.primary} />
              </View>
              <View style={styles.alertText}>
                <Text style={styles.alertTitle}>{t.favorites.alertsTitle}</Text>
                <Text style={styles.alertHint}>{t.favorites.alertsHint}</Text>
              </View>
              {/* Tizim Switch'i emas — sababi `components/Toggle.tsx` da */}
              <Toggle
                value={alertsOn}
                disabled={alerts.isLoading}
                onValueChange={(value) => {
                  if (!toggleAlerts.isPending) toggleAlerts.mutate(value);
                }}
                accessibilityLabel={t.favorites.alertsTitle}
              />
            </View>
            {alertsOn && permission === 'denied' ? (
              <Pressable accessibilityRole="button" onPress={() => void Linking.openSettings()}>
                <Text style={styles.alertDenied}>
                  {t.favorites.alertsDenied}{' '}
                  <Text style={styles.alertLink}>{t.favorites.alertsOpenSettings}</Text>
                </Text>
              </Pressable>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <Empty
            title={t.favorites.emptyTitle}
            hint={t.favorites.emptyHint}
            icon="favorite"
            action={
              <Button
                title={t.marketplace.title}
                onPress={() => router.push('/(tabs)/marketplace')}
              />
            }
          />
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            disabled={!item.isAvailable}
            onPress={() => router.push(`/product/${item.id}`)}
          >
            {item.image ? (
              <Image source={{ uri: item.image }} style={styles.image} resizeMode="cover" />
            ) : (
              <View style={[styles.image, styles.placeholder]} />
            )}

            <View style={styles.info}>
              <Text style={styles.title} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.store} numberOfLines={1}>
                {item.store.name}
                {item.canTryOn ? ' · AI' : ''}
              </Text>
              <Text style={styles.price}>{money(item.price, item.currency)}</Text>
              {!item.isAvailable ? (
                <Text style={styles.unavailable}>{t.favorites.unavailable}</Text>
              ) : null}
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t.fitting.favRemove}
              hitSlop={12}
              disabled={remove.isPending}
              onPress={() => remove.mutate(item.id)}
            >
              <Text style={styles.remove}>×</Text>
            </Pressable>
          </Pressable>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.md, gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  image: { width: 64, height: 80, borderRadius: radius.md, backgroundColor: colors.surface2 },
  placeholder: { borderWidth: 1, borderColor: colors.border },
  info: { flex: 1, gap: 2 },
  title: { ...text.bodyMed, color: colors.text },
  store: { ...text.small, color: colors.textDim },
  price: { ...text.bodyMed, color: colors.text },
  unavailable: { ...text.small, color: colors.warning },
  remove: { ...text.h3, color: colors.textDim, paddingHorizontal: spacing.sm },
  alertCard: {
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  alertRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  alertIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(139,44,245,0.08)',
  },
  alertText: { flex: 1, flexShrink: 1, minWidth: 0, gap: 2 },
  alertTitle: { ...text.bodyMed, color: colors.text },
  alertHint: { ...text.small, color: colors.textDim },
  alertDenied: { ...text.small, color: colors.warning },
  alertLink: { color: colors.primary, fontWeight: '600' },
});
