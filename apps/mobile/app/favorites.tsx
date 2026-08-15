import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { getFavorites, removeFavorite } from '../src/api/endpoints';
import { Empty, ErrorView, Loading, Screen } from '../src/components/ui';
import { useI18n } from '../src/i18n';
import { money } from '../src/theme/format';
import { colors, radius, spacing, text } from '../src/theme/tokens';

export default function Favorites(): JSX.Element {
  const router = useRouter();
  const queryClient = useQueryClient();
  const t = useI18n((state) => state.t);

  const favorites = useQuery({ queryKey: ['favorites'], queryFn: getFavorites });

  const remove = useMutation({
    mutationFn: removeFavorite,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['favorites'] });
    },
  });

  if (favorites.isLoading) return <Loading />;
  if (favorites.isError) {
    return <ErrorView message={t.errors.generic} onRetry={() => void favorites.refetch()} />;
  }

  return (
    <Screen>
      <FlatList
        data={favorites.data ?? []}
        keyExtractor={(product) => product.id}
        contentContainerStyle={styles.list}
        refreshing={favorites.isFetching}
        onRefresh={() => void favorites.refetch()}
        ListEmptyComponent={<Empty title={t.favorites.emptyTitle} hint={t.favorites.emptyHint} />}
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
                {item.has3d ? ' · 3D' : ''}
              </Text>
              <Text style={styles.price}>{money(item.price, item.currency)}</Text>
              {!item.isAvailable ? (
                <Text style={styles.unavailable}>{t.favorites.unavailable}</Text>
              ) : null}
            </View>

            <Pressable
              accessibilityLabel="Sevimlilardan olib tashlash"
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
});
