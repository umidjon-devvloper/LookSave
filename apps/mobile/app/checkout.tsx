import { addressSchema } from '@looksave/validation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ApiError } from '../src/api/client';
import { translations } from '../src/i18n';
import { createOrder, getCart, type CreateOrderInput } from '../src/api/endpoints';
import { Button, ErrorView, Field, Loading, Screen } from '../src/components/ui';
import { useAuthStore } from '../src/store/authStore';
import { useI18n } from '../src/i18n';
import { useLocationStore } from '../src/store/locationStore';
import { money } from '../src/theme/format';
import { colors, radius, spacing, text } from '../src/theme/tokens';

/**
 * Server xatolari foydalanuvchi tushunadigan matnga o'giriladi (05-mobile §6.12).
 * Har biri nima qilish kerakligini aytadi — quruq "xato yuz berdi" emas.
 */
function explain(error: unknown): string {
  const t = translations().errors;
  if (!(error instanceof ApiError)) return t.generic;

  switch (error.code) {
    case 'PHONE_NOT_VERIFIED':
      return t.phoneNotVerified;
    case 'OUT_OF_RANGE':
      return t.outOfRange;
    case 'LIMIT_REACHED':
      return t.limitReached;
    case 'BLOCKED':
    case 'RESTRICTED':
      return t.blocked;
    case 'OUT_OF_STOCK':
      return t.outOfStock;
    case 'NETWORK':
      return t.network;
    default:
      // Server matni allaqachon foydalanuvchi tilida keladi
      return error.message;
  }
}

export default function Checkout(): JSX.Element {
  const { storeId } = useLocalSearchParams<{ storeId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const t = useI18n((state) => state.t);
  const { coords, isFallback } = useLocationStore();

  const [deliveryType, setDeliveryType] = useState<'delivery' | 'pickup'>('delivery');
  const [contactName, setContactName] = useState(user?.fullName ?? '');
  const [addressText, setAddressText] = useState('');
  const [landmark, setLandmark] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  /**
   * Idempotentlik kaliti CHECKOUT boshlanganda bir marta yaratiladi.
   * Har urinishda yangisi yaratilsa, takroriy yuborish ikkinchi
   * buyurtma yaratib qo'yardi.
   */
  const idempotencyKey = useMemo(
    () => `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`,
    [],
  );

  const cart = useQuery({ queryKey: ['cart'], queryFn: getCart });
  const group = cart.data?.stores.find((item) => item.store.id === storeId);

  const addressValid =
    deliveryType === 'pickup' ||
    addressSchema.safeParse({
      text: addressText.trim(),
      lat: coords.lat,
      lng: coords.lng,
      ...(landmark.trim() ? { landmark: landmark.trim() } : {}),
    }).success;

  const canSubmit = contactName.trim().length >= 2 && addressValid && group !== undefined;

  const submit = useMutation({
    mutationFn: () => {
      if (!group || !user) throw new Error('Savat topilmadi');

      const input: CreateOrderInput = {
        storeId: group.store.id,
        deliveryType,
        contactName: contactName.trim(),
        contactPhone: user.phone,
        items: group.items.map((item) => ({
          variantId: item.variantId,
          size: item.size,
          qty: item.qty,
        })),
        ...(note.trim() ? { note: note.trim() } : {}),
        ...(deliveryType === 'delivery'
          ? {
              address: {
                text: addressText.trim(),
                lat: coords.lat,
                lng: coords.lng,
                ...(landmark.trim() ? { landmark: landmark.trim() } : {}),
              },
            }
          : {}),
      };

      return createOrder(input, idempotencyKey);
    },
    onSuccess: (order) => {
      void queryClient.invalidateQueries({ queryKey: ['cart'] });
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      router.replace(`/order/${order.id}`);
    },
    onError: (err) => setError(explain(err)),
  });

  if (cart.isLoading) return <Loading />;
  if (cart.isError) {
    return <ErrorView message="Savatni yuklab bo'lmadi" onRetry={() => void cart.refetch()} />;
  }
  if (!group) {
    return <ErrorView message="Bu do'kon savatda yo'q" onRetry={() => router.back()} />;
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.store}>{group.store.name}</Text>

          <Text style={styles.label}>{t.checkout.deliveryType}</Text>
          <View style={styles.options}>
            {(
              [
                { value: 'pickup', label: t.checkout.pickup },
                { value: 'delivery', label: t.cart.delivery },
              ] as const
            ).map((option) => (
              <Pressable
                key={option.value}
                onPress={() => setDeliveryType(option.value)}
                style={[styles.option, deliveryType === option.value && styles.optionActive]}
              >
                <Text
                  style={[
                    styles.optionText,
                    deliveryType === option.value && { color: colors.text },
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Field label={t.auth.fullName} value={contactName} onChangeText={setContactName} />

          <View style={styles.phoneBox}>
            <Text style={styles.phoneLabel}>{t.auth.phone}</Text>
            <Text style={styles.phoneValue}>{user?.phone}</Text>
            <Text style={styles.phoneHint}>
              Sotuvchi shu raqamga qo'ng'iroq qiladi. Raqamni profildan o'zgartirasiz.
            </Text>
          </View>

          {deliveryType === 'delivery' ? (
            <>
              <Field
                label="Manzil"
                value={addressText}
                onChangeText={setAddressText}
                placeholder="Chilonzor 9-kvartal, 24-uy, 12-xonadon"
              />
              <Field
                label="Mo'ljal"
                value={landmark}
                onChangeText={setLandmark}
                placeholder="Mehnat metrosi yonida"
              />

              {isFallback ? (
                <Text style={styles.warning}>
                  Joylashuv aniqlanmagan — koordinata Toshkent markazi bo'yicha yuboriladi. Do'kon
                  hududidan tashqarida chiqishi mumkin.
                </Text>
              ) : null}
            </>
          ) : (
            <Text style={styles.hint}>
              Buyurtma tasdiqlangach do'kondan olib ketasiz. Manzil kerak emas.
            </Text>
          )}

          <Field
            label="Izoh"
            value={note}
            onChangeText={setNote}
            placeholder="Kechqurun 18:00 dan keyin qo'ng'iroq qiling"
            multiline
          />

          <View style={styles.summary}>
            <View style={styles.totals}>
              <Text style={styles.totalLabel}>{t.cart.products}</Text>
              <Text style={styles.totalValue}>{money(group.subtotal, group.store.currency)}</Text>
            </View>
            <View style={styles.totals}>
              <Text style={styles.totalLabel}>{t.cart.delivery}</Text>
              <Text style={styles.totalValue}>
                {deliveryType === 'pickup' || Number(group.deliveryFee) === 0
                  ? 'Bepul'
                  : money(group.deliveryFee, group.store.currency)}
              </Text>
            </View>
            <View style={styles.totals}>
              <Text style={styles.totalLabelStrong}>{t.cart.total}</Text>
              <Text style={styles.totalValueStrong}>
                {money(
                  deliveryType === 'pickup' ? group.subtotal : group.total,
                  group.store.currency,
                )}
              </Text>
            </View>
            <Text style={styles.paymentNote}>
              To'lov {deliveryType === 'pickup' ? "do'konda" : 'yetkazib berilganda'}
            </Text>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button
            title={t.cart.placeOrder}
            disabled={!canSubmit}
            loading={submit.isPending}
            onPress={() => {
              setError(null);
              submit.mutate();
            }}
          />
        </ScrollView>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  store: { ...text.h3, color: colors.text, marginBottom: spacing.md },
  label: { ...text.label, color: colors.textDim, marginBottom: spacing.sm },
  options: { gap: spacing.sm, marginBottom: spacing.md },
  option: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  optionActive: { borderColor: colors.primary, backgroundColor: colors.surface2 },
  optionText: { ...text.body, color: colors.textMuted },
  phoneBox: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  phoneLabel: { ...text.label, color: colors.textDim },
  phoneValue: { ...text.bodyMed, color: colors.text, marginTop: spacing.xs },
  phoneHint: { ...text.small, color: colors.textDim, marginTop: spacing.xs },
  hint: { ...text.small, color: colors.textMuted, marginBottom: spacing.md },
  warning: { ...text.small, color: colors.warning, marginBottom: spacing.md },
  summary: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  totals: { flexDirection: 'row', justifyContent: 'space-between' },
  totalLabel: { ...text.small, color: colors.textDim },
  totalValue: { ...text.small, color: colors.textMuted },
  totalLabelStrong: { ...text.bodyMed, color: colors.text },
  totalValueStrong: { ...text.bodyMed, color: colors.text },
  paymentNote: { ...text.small, color: colors.textDim, marginTop: spacing.xs },
  error: { ...text.small, color: colors.danger, marginBottom: spacing.md },
});
