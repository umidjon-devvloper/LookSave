import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FlatList, Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { getStore, getStoreProducts } from '../../src/api/endpoints';
import { Button, Empty, ErrorView, Loading, Screen } from '../../src/components/ui';
import { useI18n } from '../../src/i18n';
import { money } from '../../src/theme/format';
import { colors, radius, spacing, text } from '../../src/theme/tokens';

export default function Store(): JSX.Element {
  const t = useI18n((state) => state.t);
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const store = useQuery({
    queryKey: ['store', id],
    queryFn: () => getStore(id),
    enabled: Boolean(id),
  });
  const products = useQuery({
    queryKey: ['store', id, 'products'],
    queryFn: () => getStoreProducts(id),
    enabled: Boolean(id),
  });

  if (store.isLoading) return <Loading />;
  if (store.isError || !store.data) {
    return <ErrorView message={t.common.notFound} onRetry={() => void store.refetch()} />;
  }

  const data = store.data;

  return (
    <Screen>
      <FlatList
        data={products.data?.items ?? []}
        keyExtractor={(product) => product.id}
        numColumns={2}
        columnWrapperStyle={{ gap: spacing.sm }}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.name}>{data.name}</Text>
            <Text style={[styles.status, { color: data.isOpen ? colors.success : colors.textDim }]}>
              {data.isOpen
                ? data.closesAt
                  ? `Ochiq · ${data.closesAt} gacha`
                  : 'Ochiq'
                : data.opensAt
                  ? `Yopiq · ${data.opensAt} da ochiladi`
                  : 'Yopiq'}
            </Text>

            <Text style={styles.address}>{data.address}</Text>
            {data.landmark ? <Text style={styles.landmark}>Mo'ljal: {data.landmark}</Text> : null}

            {data.avgResponseMin !== null ? (
              <Text style={styles.response}>
                Odatda {data.avgResponseMin} daqiqada javob beradi
              </Text>
            ) : null}

            <View style={styles.row}>
              <Button
                title={t.stores.call}
                variant="ghost"
                onPress={() => void Linking.openURL(`tel:${data.phone}`)}
              />
              <Button
                title={t.stores.directions}
                variant="ghost"
                onPress={() =>
                  void Linking.openURL(
                    `https://maps.google.com/?q=${data.location.lat},${data.location.lng}`,
                  )
                }
              />
            </View>

            {data.delivery.enabled ? (
              <Text style={styles.delivery}>
                Yetkazib berish {(data.delivery.radiusM / 1000).toFixed(0)} km gacha ·{' '}
                {Number(data.delivery.fee) === 0
                  ? 'bepul'
                  : money(data.delivery.fee, data.currency)}
                {data.delivery.freeFrom
                  ? ` · ${money(data.delivery.freeFrom, data.currency)} dan bepul`
                  : ''}
              </Text>
            ) : (
              <Text style={styles.delivery}>Faqat do'kondan olib ketish</Text>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => router.push(`/product/${item.id}`)}>
            {item.image ? (
              <Image source={{ uri: item.image }} style={styles.image} resizeMode="cover" />
            ) : (
              <View style={[styles.image, styles.imagePlaceholder]} />
            )}
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.price}>{money(item.price, item.currency)}</Text>
          </Pressable>
        )}
        ListEmptyComponent={
          products.isLoading ? <Loading /> : <Empty title="Bu do'konda hozircha mahsulot yo'q" />
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.md, gap: spacing.sm },
  header: { gap: spacing.xs, marginBottom: spacing.md },
  name: { ...text.h2, color: colors.text },
  status: { ...text.small },
  address: { ...text.body, color: colors.textMuted, marginTop: spacing.xs },
  landmark: { ...text.small, color: colors.textDim },
  response: { ...text.small, color: colors.accent, marginTop: spacing.xs },
  row: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  delivery: { ...text.small, color: colors.textDim, marginTop: spacing.sm },
  card: { flex: 1, gap: 2, marginBottom: spacing.md },
  image: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  imagePlaceholder: { borderWidth: 1, borderColor: colors.border },
  cardTitle: { ...text.bodyMed, color: colors.text, marginTop: spacing.sm },
  price: { ...text.bodyMed, color: colors.text },
});
