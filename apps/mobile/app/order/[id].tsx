import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';

import { cancelOrder, getOrder, type OrderDetail } from '../../src/api/endpoints';
import { Button, ErrorView, Loading, Screen } from '../../src/components/ui';
import { useI18n } from '../../src/i18n';
import { SignInRequired } from '../../src/components/SignInRequired';
import { useAuthStore } from '../../src/store/authStore';
import { money, phone as formatPhone } from '../../src/theme/format';
import { colors, radius, spacing, text } from '../../src/theme/tokens';
import { statusTone } from '../../src/theme/orderStatus';

const STEPS = ['Yuborildi', 'Tasdiqlandi', 'Tayyor', 'Topshirildi'];

const STEP_INDEX: Record<string, number> = {
  new: 0,
  seen: 0,
  confirmed: 1,
  ready: 2,
  completed: 3,
};

function remaining(expiresAt: string): string {
  const minutes = Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 60_000));
  const hours = Math.floor(minutes / 60);
  return `${hours} soat ${minutes % 60} daqiqa qoldi`;
}

function Progress({ status }: { status: string }): JSX.Element | null {
  const current = STEP_INDEX[status];
  if (current === undefined) return null;

  return (
    <View style={styles.progress}>
      {STEPS.map((label, index) => (
        <View key={label} style={styles.step}>
          <View style={[styles.dot, index <= current && styles.dotActive]} />
          <Text style={[styles.stepText, index <= current && { color: colors.textMuted }]}>
            {label}
          </Text>
        </View>
      ))}
    </View>
  );
}

function StatusBanner({ order }: { order: OrderDetail }): JSX.Element {
  const tone = statusTone(order.status);

  return (
    <View style={[styles.banner, { borderColor: tone }]}>
      <Text style={[styles.bannerTitle, { color: tone }]}>{order.statusLabel}</Text>

      {order.status === 'new' ? (
        <Text style={styles.bannerHint}>{remaining(order.expiresAt)}</Text>
      ) : null}

      {order.status === 'rejected' && order.rejectReason ? (
        <Text style={styles.bannerHint}>{order.rejectReason}</Text>
      ) : null}

      {order.status === 'expired' ? (
        <Text style={styles.bannerHint}>
          Do'kon javob bermadi. Shu mahsulotni boshqa do'konda qidirib ko'ring.
        </Text>
      ) : null}
    </View>
  );
}

export default function Order(): JSX.Element {
  const t = useI18n((state) => state.t);
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  /*
   * ⚠️ QOROVUL BARCHA HOOKLARDAN KEYIN QAYTARADI, lekin holat SHU YERDA
   * o'qiladi: erta `return` hooklar tartibini buzadi va React qulaydi.
   */
  const signedIn = useAuthStore((state) => state.status) === 'signedIn';

  const order = useQuery({
    queryKey: ['orders', id],
    queryFn: () => getOrder(id),
    enabled: Boolean(id) && signedIn,
    // Sotuvchi javobini kutayotgan buyurtma tez-tez yangilanadi.
    // SSE mijoz tomonida yo'q — push qo'shilgach bu interval olib tashlanadi.
    refetchInterval: (query) =>
      query.state.data && ['new', 'seen', 'confirmed'].includes(query.state.data.status)
        ? 30_000
        : false,
  });

  const cancel = useMutation({
    mutationFn: () => cancelOrder(id, 'Fikrimdan qaytdim'),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
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

  if (order.isLoading) return <Loading />;
  if (order.isError || !order.data) {
    return <ErrorView message={t.common.notFound} onRetry={() => void order.refetch()} />;
  }

  const data = order.data;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.number}>{data.orderNumber}</Text>

        <StatusBanner order={data} />
        <Progress status={data.status} />

        <View style={styles.card}>
          <Text style={styles.storeName}>{data.store.name}</Text>
          <View style={styles.row}>
            <Button
              title={t.stores.call}
              variant="ghost"
              onPress={() => void Linking.openURL(`tel:${data.store.phone}`)}
            />
            <Button
              title={t.stores.directions}
              variant="ghost"
              onPress={() =>
                void Linking.openURL(
                  `https://maps.google.com/?q=${data.store.location.lat},${data.store.location.lng}`,
                )
              }
            />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Mahsulotlar</Text>
          {data.items.map((item, index) => (
            <View key={`${item.title ?? 'item'}-${index}`} style={styles.item}>
              <Text style={styles.itemTitle}>{item.title ?? 'Mahsulot'}</Text>
              <Text style={styles.itemMeta}>
                {item.colorName ? `${item.colorName} · ` : ''}
                {item.size} · {item.qty} dona · {money(item.unitPrice, data.currency)}
              </Text>
            </View>
          ))}

          <View style={styles.totals}>
            <Text style={styles.totalLabel}>Mahsulotlar</Text>
            <Text style={styles.totalValue}>{money(data.subtotal, data.currency)}</Text>
          </View>
          <View style={styles.totals}>
            <Text style={styles.totalLabel}>Yetkazib berish</Text>
            <Text style={styles.totalValue}>
              {Number(data.deliveryFee) === 0 ? 'Bepul' : money(data.deliveryFee, data.currency)}
            </Text>
          </View>
          <View style={styles.totals}>
            <Text style={styles.totalLabelStrong}>Jami</Text>
            <Text style={styles.totalValueStrong}>{money(data.total, data.currency)}</Text>
          </View>
          <Text style={styles.paymentNote}>
            {data.paymentStatus === 'paid'
              ? "To'landi"
              : data.deliveryType === 'delivery'
                ? "To'lov yetkazib berilganda"
                : "To'lov do'konda"}
          </Text>
        </View>

        {data.deliveryType === 'delivery' && data.address?.text ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Manzil</Text>
            <Text style={styles.itemMeta}>{data.address.text}</Text>
            {data.address.landmark ? (
              <Text style={styles.itemMeta}>Mo'ljal: {data.address.landmark}</Text>
            ) : null}
            <Text style={styles.itemMeta}>{formatPhone(data.contactPhone)}</Text>
          </View>
        ) : null}

        {data.canCancel ? (
          <Button
            title={t.order.cancel}
            variant="danger"
            loading={cancel.isPending}
            onPress={() => cancel.mutate()}
          />
        ) : null}

        {data.status === 'expired' || data.status === 'rejected' ? (
          <Button title={t.order.findElsewhere} onPress={() => router.replace('/(tabs)')} />
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },
  number: { ...text.h3, color: colors.text },
  banner: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    gap: spacing.xs,
  },
  bannerTitle: { ...text.bodyMed },
  bannerHint: { ...text.small, color: colors.textMuted },
  progress: { flexDirection: 'row', justifyContent: 'space-between' },
  step: { alignItems: 'center', flex: 1, gap: spacing.xs },
  dot: {
    width: 10,
    height: 10,
    borderRadius: radius.full,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dotActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  stepText: { ...text.tiny, color: colors.textDim, textAlign: 'center' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  storeName: { ...text.h3, color: colors.text },
  row: { flexDirection: 'row', gap: spacing.sm },
  sectionTitle: { ...text.label, color: colors.textDim },
  item: { gap: 2 },
  itemTitle: { ...text.bodyMed, color: colors.text },
  itemMeta: { ...text.small, color: colors.textDim },
  totals: { flexDirection: 'row', justifyContent: 'space-between' },
  totalLabel: { ...text.small, color: colors.textDim },
  totalValue: { ...text.small, color: colors.textMuted },
  totalLabelStrong: { ...text.bodyMed, color: colors.text },
  totalValueStrong: { ...text.bodyMed, color: colors.text },
  paymentNote: { ...text.small, color: colors.textDim },
});
