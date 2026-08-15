import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { getNearbyStores, getStoresMap, type NearbyStore } from '../src/api/endpoints';
import { StoreMap } from '../src/components/StoreMap';
import { Empty, ErrorView, Loading, Screen } from '../src/components/ui';
import { initialRegion, regionToBounds, type Bounds } from '../src/map/region';
import { useI18n } from '../src/i18n';
import { useLocationStore } from '../src/store/locationStore';
import { distance } from '../src/theme/format';
import { colors, radius, spacing, text } from '../src/theme/tokens';

function StoreRow({ store, onPress }: { store: NearbyStore; onPress: () => void }): JSX.Element {
  const t = useI18n((state) => state.t);

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.rowBetween}>
        <Text style={styles.name}>{store.name}</Text>
        <Text style={styles.distance}>{distance(store.distanceM)}</Text>
      </View>

      <Text style={styles.address} numberOfLines={1}>
        {store.address}
      </Text>

      <View style={styles.meta}>
        <Text style={[styles.badge, store.isOpen ? styles.open : styles.closed]}>
          {store.isOpen
            ? store.closesAt
              ? `${t.stores.open} · ${store.closesAt}`
              : t.stores.open
            : store.opensAt
              ? `${t.stores.closed} · ${store.opensAt}`
              : t.stores.closed}
        </Text>
        <Text style={styles.count}>
          {store.productCount} {t.home.products}
          {store.product3dCount > 0 ? ` · ${store.product3dCount} ta 3D` : ''}
        </Text>
      </View>
    </Pressable>
  );
}

export default function Stores(): JSX.Element {
  const router = useRouter();
  const t = useI18n((state) => state.t);
  const { coords, isFallback, permission, request } = useLocationStore();

  const [mode, setMode] = useState<'list' | 'map'>('list');
  const [bounds, setBounds] = useState<Bounds>(() => regionToBounds(initialRegion(coords)));

  useEffect(() => {
    if (permission === 'unknown') void request();
  }, [permission, request]);

  const stores = useQuery({
    queryKey: ['stores', 'nearby', coords.lat, coords.lng],
    queryFn: () => getNearbyStores(coords.lat, coords.lng, { radius: 10_000 }),
  });

  /**
   * Xarita so'rovi ro'yxatdan alohida: chegara o'zgargan sari yangilanadi.
   * `keepPreviousData` yo'q — eski markerlar yangi joyda qolib ketmasligi
   * kerak, lekin `placeholderData` bilan xarita bo'shab ketmaydi.
   */
  const mapStores = useQuery({
    queryKey: ['stores', 'map', bounds],
    queryFn: () => getStoresMap(bounds),
    enabled: mode === 'map',
    placeholderData: (previous) => previous,
    staleTime: 60_000,
  });

  const onBoundsChange = useCallback((next: Bounds) => {
    setBounds(next);
  }, []);

  const toggle = (
    <View style={styles.toggle}>
      {(['list', 'map'] as const).map((value) => (
        <Pressable
          key={value}
          accessibilityRole="tab"
          accessibilityState={{ selected: mode === value }}
          onPress={() => {
            setMode(value);
          }}
          style={[styles.toggleButton, mode === value && styles.toggleButtonActive]}
        >
          <Text style={[styles.toggleText, mode === value && styles.toggleTextActive]}>
            {value === 'list' ? t.stores.listView : t.stores.mapView}
          </Text>
        </Pressable>
      ))}
    </View>
  );

  if (mode === 'map') {
    return (
      <Screen>
        {toggle}
        {isFallback ? <Text style={styles.notice}>{t.stores.fallbackLocation}</Text> : null}

        <StoreMap
          coords={coords}
          markers={mapStores.data?.markers ?? []}
          clusters={mapStores.data?.clusters ?? []}
          onBoundsChange={onBoundsChange}
          onSelectStore={(id) => router.push(`/store/${id}`)}
        />
      </Screen>
    );
  }

  if (stores.isLoading) return <Loading label={t.stores.searching} />;

  if (stores.isError) {
    return <ErrorView message={t.errors.generic} onRetry={() => void stores.refetch()} />;
  }

  return (
    <Screen>
      {toggle}
      {isFallback ? <Text style={styles.notice}>{t.stores.fallbackLocation}</Text> : null}

      <FlatList
        data={stores.data ?? []}
        keyExtractor={(store) => store.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <StoreRow store={item} onPress={() => router.push(`/store/${item.id}`)} />
        )}
        ListEmptyComponent={<Empty title={t.stores.emptyTitle} hint={t.stores.emptyHint} />}
        refreshing={stores.isFetching}
        onRefresh={() => void stores.refetch()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.md, gap: spacing.sm },
  toggle: {
    flexDirection: 'row',
    margin: spacing.md,
    marginBottom: 0,
    padding: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    gap: spacing.xs,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    alignItems: 'center',
  },
  toggleButtonActive: { backgroundColor: colors.primary },
  toggleText: { ...text.small, color: colors.textMuted },
  toggleTextActive: { color: colors.text },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { ...text.h3, color: colors.text, flex: 1 },
  distance: { ...text.small, color: colors.accent },
  address: { ...text.small, color: colors.textDim },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  badge: { ...text.tiny },
  open: { color: colors.success },
  closed: { color: colors.textDim },
  count: { ...text.tiny, color: colors.textMuted },
  notice: {
    ...text.small,
    color: colors.warning,
    padding: spacing.md,
    paddingBottom: 0,
  },
});
