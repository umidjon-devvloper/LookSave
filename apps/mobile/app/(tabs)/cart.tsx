import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { getCart, removeCartItem, setCartItemQty, type CartStore } from '../../src/api/endpoints';
import { Button, Empty, ErrorView, Screen } from '../../src/components/ui';
import { SignInRequired } from '../../src/components/SignInRequired';
import { SkeletonList } from '../../src/components/Skeleton';
import { useI18n } from '../../src/i18n';
import { useAuthStore } from '../../src/store/authStore';
import { money } from '../../src/theme/format';
import { colors, radius, spacing, text } from '../../src/theme/tokens';

function StoreGroup({
  group,
  busy,
  onQty,
  onRemove,
  onCheckout,
}: {
  group: CartStore;
  busy: boolean;
  onQty: (itemId: string, qty: number) => void;
  onRemove: (itemId: string) => void;
  onCheckout: () => void;
}): JSX.Element {
  const hasUnavailable = group.items.some((item) => !item.available);

  return (
    <View style={styles.card}>
      <Text style={styles.storeName}>{group.store.name}</Text>

      {group.items.map((item) => (
        <View key={item.id} style={styles.item}>
          <View style={{ flex: 1 }}>
            <Text style={styles.itemTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.itemMeta}>
              {item.colorName ? `${item.colorName} · ` : ''}
              {item.size}
            </Text>
            {!item.available ? (
              <Text style={styles.unavailable}>
                {item.stock === 0 ? 'Tugadi' : `Faqat ${item.stock} dona qoldi`}
              </Text>
            ) : null}
            <Text style={styles.itemPrice}>{money(item.totalPrice, group.store.currency)}</Text>
          </View>

          <View style={styles.qty}>
            <Pressable
              accessibilityLabel="Kamaytirish"
              disabled={busy}
              style={styles.qtyButton}
              onPress={() => (item.qty === 1 ? onRemove(item.id) : onQty(item.id, item.qty - 1))}
            >
              <Text style={styles.qtyButtonText}>{item.qty === 1 ? '×' : '−'}</Text>
            </Pressable>

            <Text style={styles.qtyValue}>{item.qty}</Text>

            <Pressable
              accessibilityLabel="Ko'paytirish"
              disabled={busy || item.qty >= item.stock}
              style={[styles.qtyButton, item.qty >= item.stock && { opacity: 0.4 }]}
              onPress={() => onQty(item.id, item.qty + 1)}
            >
              <Text style={styles.qtyButtonText}>+</Text>
            </Pressable>
          </View>
        </View>
      ))}

      <View style={styles.totals}>
        <Text style={styles.totalLabel}>Mahsulotlar</Text>
        <Text style={styles.totalValue}>{money(group.subtotal, group.store.currency)}</Text>
      </View>
      <View style={styles.totals}>
        <Text style={styles.totalLabel}>Yetkazib berish</Text>
        <Text style={styles.totalValue}>
          {Number(group.deliveryFee) === 0
            ? 'Bepul'
            : money(group.deliveryFee, group.store.currency)}
        </Text>
      </View>
      <View style={styles.totals}>
        <Text style={styles.totalLabelStrong}>Jami</Text>
        <Text style={styles.totalValueStrong}>{money(group.total, group.store.currency)}</Text>
      </View>

      {/* K-10: hech qayerda "To'lash" yozilmaydi */}
      <Button title="Buyurtma yuborish" disabled={busy || hasUnavailable} onPress={onCheckout} />

      {hasUnavailable ? (
        <Text style={styles.warning}>
          Mavjud bo'lmagan mahsulotni olib tashlang — shundan keyin yuborish mumkin.
        </Text>
      ) : null}
    </View>
  );
}

export default function Cart(): JSX.Element {
  const router = useRouter();
  const queryClient = useQueryClient();
  const t = useI18n((state) => state.t);

  /*
   * ⚠️ QOROVUL BARCHA HOOKLARDAN KEYIN QAYTARADI, lekin holat SHU YERDA
   * o'qiladi: erta `return` hooklar tartibini buzadi va React qulaydi.
   */
  const signedIn = useAuthStore((state) => state.status) === 'signedIn';

  const cart = useQuery({ queryKey: ['cart'], queryFn: getCart, enabled: signedIn });

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['cart'] });
  };

  const changeQty = useMutation({
    mutationFn: ({ itemId, qty }: { itemId: string; qty: number }) => setCartItemQty(itemId, qty),
    onSuccess: invalidate,
  });

  const remove = useMutation({ mutationFn: removeCartItem, onSuccess: invalidate });
  const busy = changeQty.isPending || remove.isPending;

  // Kirmagan foydalanuvchiga xato emas, sabab ko'rsatiladi
  if (!signedIn) {
    return (
      <Screen>
        <SignInRequired />
      </Screen>
    );
  }

  if (cart.isLoading) return <SkeletonList count={3} />;
  if (cart.isError) {
    return <ErrorView error={cart.error} onRetry={() => void cart.refetch()} />;
  }

  if (!cart.data || cart.data.itemCount === 0) {
    return <Empty title={t.cart.emptyTitle} hint={t.cart.emptyHint} />;
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.list}>
        {cart.data.stores.map((group) => (
          <StoreGroup
            key={group.store.id}
            group={group}
            busy={busy}
            onQty={(itemId, qty) => changeQty.mutate({ itemId, qty })}
            onRemove={(itemId) => remove.mutate(itemId)}
            onCheckout={() => router.push(`/checkout?storeId=${group.store.id}`)}
          />
        ))}

        <Text style={styles.paymentNote}>
          To'lov ilovada emas: buyurtma do'konga so'rov bo'lib boradi, hisob-kitob topshirishda.
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  storeName: { ...text.h3, color: colors.text },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  itemTitle: { ...text.bodyMed, color: colors.text },
  itemMeta: { ...text.small, color: colors.textDim },
  itemPrice: { ...text.bodyMed, color: colors.text, marginTop: 2 },
  unavailable: { ...text.small, color: colors.warning },
  qty: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  qtyButton: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyButtonText: { ...text.bodyMed, color: colors.textMuted },
  qtyValue: { ...text.bodyMed, color: colors.text, minWidth: 20, textAlign: 'center' },
  totals: { flexDirection: 'row', justifyContent: 'space-between' },
  totalLabel: { ...text.small, color: colors.textDim },
  totalValue: { ...text.small, color: colors.textMuted },
  totalLabelStrong: { ...text.bodyMed, color: colors.text },
  totalValueStrong: { ...text.bodyMed, color: colors.text },
  warning: { ...text.small, color: colors.warning },
  paymentNote: { ...text.small, color: colors.textDim, textAlign: 'center' },
});
