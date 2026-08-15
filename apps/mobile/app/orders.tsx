import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { getOrders } from '../src/api/endpoints';
import { Empty, ErrorView, Loading, Screen } from '../src/components/ui';
import { useI18n } from '../src/i18n';
import { money } from '../src/theme/format';
import { colors, radius, spacing, text } from '../src/theme/tokens';

const TABS = ['active', 'completed', 'cancelled'] as const;

type Tab = (typeof TABS)[number];

export default function Orders(): JSX.Element {
  const router = useRouter();
  const t = useI18n((state) => state.t);
  const [tab, setTab] = useState<Tab>('active');

  const orders = useQuery({
    queryKey: ['orders', 'list', tab],
    queryFn: () => getOrders(tab),
  });

  return (
    <Screen>
      <View style={styles.tabs}>
        {TABS.map((item) => (
          <Pressable
            key={item}
            onPress={() => setTab(item)}
            style={[styles.tab, tab === item && styles.tabActive]}
          >
            <Text style={[styles.tabText, tab === item && { color: colors.text }]}>
              {t.order[item]}
            </Text>
          </Pressable>
        ))}
      </View>

      {orders.isLoading ? <Loading /> : null}
      {orders.isError ? (
        <ErrorView message={t.errors.generic} onRetry={() => void orders.refetch()} />
      ) : null}

      {orders.data ? (
        <FlatList
          data={orders.data.items}
          keyExtractor={(order) => order.id}
          contentContainerStyle={styles.list}
          refreshing={orders.isFetching}
          onRefresh={() => void orders.refetch()}
          renderItem={({ item }) => (
            <Pressable style={styles.card} onPress={() => router.push(`/order/${item.id}`)}>
              <View style={styles.rowBetween}>
                <Text style={styles.number}>{item.orderNumber}</Text>
                <Text style={styles.status}>{item.statusLabel}</Text>
              </View>
              <Text style={styles.store}>{item.store.name}</Text>
              <Text style={styles.preview} numberOfLines={1}>
                {item.preview.title ?? 'Mahsulot'}
                {item.itemCount > 1 ? ` va yana ${item.itemCount - 1} ta` : ''}
              </Text>
              <Text style={styles.total}>{money(item.total, item.currency)}</Text>
            </Pressable>
          )}
          ListEmptyComponent={
            <Empty
              title={t.order.emptyActive}
              hint={tab === 'active' ? t.order.emptyHint : undefined}
            />
          }
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md },
  tab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabActive: { borderColor: colors.primary, backgroundColor: colors.surface2 },
  tabText: { ...text.small, color: colors.textMuted },
  list: { padding: spacing.md, gap: spacing.sm, paddingTop: 0 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 2,
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between' },
  number: { ...text.bodyMed, color: colors.text },
  status: { ...text.small, color: colors.accent },
  store: { ...text.small, color: colors.textMuted },
  preview: { ...text.small, color: colors.textDim },
  total: { ...text.bodyMed, color: colors.text, marginTop: spacing.xs },
});
