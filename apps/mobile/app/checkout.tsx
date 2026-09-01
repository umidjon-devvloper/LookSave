import { addressSchema } from '@looksave/validation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { ErrorView, Field, Loading, Screen } from '../src/components/ui';
import { Icon, type IconName } from '../src/components/Icon';
import { useAuthStore } from '../src/store/authStore';
import { useI18n } from '../src/i18n';
import { useLocationStore } from '../src/store/locationStore';
import { money } from '../src/theme/format';
import { colors, radius, spacing, text } from '../src/theme/tokens';
import { goBack } from '../src/navigation/back';

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
  const insets = useSafeAreaInsets();

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
    return <ErrorView message="Bu do'kon savatda yo'q" onRetry={() => goBack('/cart')} />;
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen>
        <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.order.title}
            onPress={() => goBack('/cart')}
            style={styles.roundButton}
          >
            <Icon name="back" size={20} color={colors.accent} />
          </Pressable>
          <Text style={styles.topTitle}>{t.order.title}</Text>
          {/* Sarlavhani markazda ushlaydigan ko'rinmas muvozanat */}
          <View style={styles.roundButtonGhost} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Qaysi do'kondan buyurtma qilinayotgani — birinchi navbatda aniq bo'lsin */}
          <View style={styles.storeCard}>
            <View style={styles.storeIcon}>
              <Icon name="shop" size={22} color={colors.accent} />
            </View>
            <View style={styles.storeText}>
              <Text style={styles.storeName} numberOfLines={1}>
                {group.store.name}
              </Text>
              <Text style={styles.storeMeta}>
                {group.items.length} {t.cart.products.toLowerCase()}
              </Text>
            </View>
          </View>

          <Text style={styles.label}>{t.checkout.deliveryType}</Text>
          <View style={styles.options}>
            {(
              [
                { value: 'pickup', label: t.checkout.pickup, icon: 'stores' },
                { value: 'delivery', label: t.cart.delivery, icon: 'delivery' },
              ] as Array<{ value: 'pickup' | 'delivery'; label: string; icon: IconName }>
            ).map((option) => {
              const active = deliveryType === option.value;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => setDeliveryType(option.value)}
                  style={[styles.option, active && styles.optionActive]}
                >
                  <Icon
                    name={option.icon}
                    size={20}
                    color={active ? colors.accent : colors.textDim}
                  />
                  <Text style={[styles.optionText, active && styles.optionTextActive]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
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

          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSubmit || submit.isPending }}
            disabled={!canSubmit || submit.isPending}
            onPress={() => {
              setError(null);
              submit.mutate();
            }}
          >
            <LinearGradient
              colors={
                canSubmit ? [colors.accent, colors.primary] : [colors.surface2, colors.surface2]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.submit, canSubmit && styles.submitReady]}
            >
              <Icon name="bag" size={18} color={canSubmit ? colors.text : colors.textDim} />
              <Text style={[styles.submitText, !canSubmit && { color: colors.textDim }]}>
                {submit.isPending ? t.common.loading : t.cart.placeOrder}
              </Text>
            </LinearGradient>
          </Pressable>
        </ScrollView>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.md,
  },
  topTitle: { ...text.h3, color: colors.text, flex: 1, textAlign: 'center' },
  roundButton: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderAccent,
    backgroundColor: colors.surface,
  },
  roundButtonGhost: { width: 44, height: 44 },

  content: { padding: spacing.md, paddingTop: 0, paddingBottom: spacing.xxl },

  storeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  storeIcon: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderAccent,
    backgroundColor: colors.primarySoft,
  },
  storeText: { flex: 1, gap: 2 },
  storeName: { ...text.bodyMed, color: colors.text, fontWeight: '700' },
  storeMeta: { ...text.tiny, color: colors.textDim },

  submit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md + 4,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    marginTop: spacing.sm,
  },
  // Nurlanish faqat tugma FAOL bo'lganda — o'chiq tugma yorqin ko'rinmasin
  submitReady: {
    shadowColor: colors.primary,
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
  },
  submitText: { ...text.bodyMed, color: colors.text, fontWeight: '700' },

  label: { ...text.label, color: colors.accent, marginBottom: spacing.sm },
  // Ikki variant yonma-yon — ustma-ust bo'lganda ular ro'yxatga o'xshab
  // ketardi va tanlov ekanligi darrov ko'rinmasdi
  options: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  option: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  optionActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  optionText: { ...text.small, color: colors.textMuted },
  optionTextActive: { color: colors.text, fontWeight: '600' },
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
