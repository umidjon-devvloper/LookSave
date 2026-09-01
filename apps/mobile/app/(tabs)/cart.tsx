import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  clearCart,
  getCart,
  getCategories,
  removeCartItem,
  setCartItemQty,
  type CartStore,
} from '../../src/api/endpoints';
import { ErrorView, Screen } from '../../src/components/ui';
import { CartArt } from '../../src/components/CartArt';
import { Icon, type IconName } from '../../src/components/Icon';
import { SignInRequired } from '../../src/components/SignInRequired';
import { SkeletonList } from '../../src/components/Skeleton';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useI18n } from '../../src/i18n';
import { useAuthStore } from '../../src/store/authStore';
import { money } from '../../src/theme/format';
import { colors, radius, spacing, text } from '../../src/theme/tokens';

/** Kategoriya sloti → ikonka. Slotsiz bo'limlarga umumiy kiyim belgisi. */
const SLOT_ICONS: Record<string, IconName> = {
  head: 'slotHead',
  top: 'slotTop',
  outer: 'slotOuter',
  bottom: 'slotBottom',
  feet: 'slotFeet',
  wrist: 'premium',
};

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

  const canSend = !busy && !hasUnavailable;

  return (
    <View style={styles.card}>
      {group.items.map((item) => (
        <View key={item.id} style={styles.item}>
          {/*
            Mahsulot surati — ilgari kartada umuman yo'q edi va savat
            faqat matn ro'yxati bo'lib ko'rinardi. Rasm nima buyurtma
            qilinayotganini bir qarashda aytadi.
          */}
          {item.image ? (
            <Image source={{ uri: item.image }} style={styles.itemImage} resizeMode="cover" />
          ) : (
            <View style={[styles.itemImage, styles.itemImageEmpty]} />
          )}

          <View style={styles.itemBody}>
            <Text style={styles.storeName} numberOfLines={1}>
              {group.store.name}
            </Text>
            <Text style={styles.itemTitle} numberOfLines={1}>
              {item.title}
            </Text>

            <View style={styles.sizeChip}>
              <Text style={styles.sizeChipText}>
                {item.colorName ? `${item.colorName} · ` : ''}
                {item.size}
              </Text>
            </View>

            {!item.available ? (
              <Text style={styles.unavailable}>
                {item.stock === 0 ? 'Tugadi' : `Faqat ${item.stock} dona qoldi`}
              </Text>
            ) : null}

            <View style={styles.itemFoot}>
              <Text style={styles.itemPrice}>{money(item.totalPrice, group.store.currency)}</Text>

              <View style={styles.qty}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Kamaytirish"
                  disabled={busy}
                  style={styles.qtyButton}
                  onPress={() =>
                    item.qty === 1 ? onRemove(item.id) : onQty(item.id, item.qty - 1)
                  }
                >
                  <Icon
                    name={item.qty === 1 ? 'trash' : 'close'}
                    size={15}
                    color={item.qty === 1 ? colors.danger : colors.text}
                  />
                </Pressable>

                <Text style={styles.qtyValue}>{item.qty}</Text>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Ko`paytirish"
                  disabled={busy || item.qty >= item.stock}
                  style={[styles.qtyButtonAdd, item.qty >= item.stock && { opacity: 0.4 }]}
                  onPress={() => onQty(item.id, item.qty + 1)}
                >
                  <Text style={styles.qtyButtonText}>+</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      ))}

      <View style={styles.divider} />

      <View style={styles.totals}>
        <View style={styles.totalLeft}>
          <Icon name="bag" size={17} color={colors.textDim} />
          <Text style={styles.totalLabel}>Mahsulotlar</Text>
        </View>
        <Text style={styles.totalValue}>{money(group.subtotal, group.store.currency)}</Text>
      </View>

      <View style={styles.totals}>
        <View style={styles.totalLeft}>
          <Icon name="delivery" size={17} color={colors.textDim} />
          <Text style={styles.totalLabel}>Yetkazib berish</Text>
        </View>
        <Text style={styles.totalValue}>
          {Number(group.deliveryFee) === 0
            ? 'Bepul'
            : money(group.deliveryFee, group.store.currency)}
        </Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.totals}>
        <Text style={styles.totalLabelStrong}>Jami</Text>
        <Text style={styles.totalValueStrong}>{money(group.total, group.store.currency)}</Text>
      </View>

      {/* K-10: hech qayerda "To'lash" yozilmaydi */}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !canSend }}
        disabled={!canSend}
        onPress={onCheckout}
      >
        <LinearGradient
          colors={canSend ? [colors.accent, colors.primary] : [colors.surface2, colors.surface2]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.sendButton, canSend && styles.sendButtonReady]}
        >
          <Icon name="bag" size={18} color={canSend ? colors.text : colors.textDim} />
          <Text style={[styles.sendText, !canSend && { color: colors.textDim }]}>
            Buyurtma yuborish
          </Text>
          <Icon name="next" size={18} color={canSend ? colors.text : colors.textDim} />
        </LinearGradient>
      </Pressable>

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
  const insets = useSafeAreaInsets();

  const cart = useQuery({ queryKey: ['cart'], queryFn: getCart, enabled: signedIn });

  /*
   * Kategoriyalar faqat BO'SH savatda kerak — u yerda ular kirish
   * nuqtasi bo'lib xizmat qiladi. Savat to'la bo'lsa so'rov yuborilmaydi.
   */
  const categories = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
    enabled: signedIn && cart.data?.itemCount === 0,
  });
  const topCategories = (categories.data ?? []).slice(0, 6);

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['cart'] });
  };

  const changeQty = useMutation({
    mutationFn: ({ itemId, qty }: { itemId: string; qty: number }) => setCartItemQty(itemId, qty),
    onSuccess: invalidate,
  });

  const remove = useMutation({ mutationFn: removeCartItem, onSuccess: invalidate });
  const clear = useMutation({ mutationFn: clearCart, onSuccess: invalidate });
  const busy = changeQty.isPending || remove.isPending || clear.isPending;

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
    /*
     * Bo'sh savat — TUPIK EMAS, kirish nuqtasi. Ilgari bu yerda bitta
     * qator matn turardi va foydalanuvchi orqaga qaytishdan boshqa
     * yo'l ko'rmasdi. Endi ekran uch savolga javob beradi: nega bo'sh,
     * nega bizdan xarid qilish kerak va qayerdan boshlash mumkin.
     */
    return (
      <Screen>
        {/* Tab header o'chirilgan — sarlavha bu yerda chiziladi */}
        <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
          <View style={styles.clearButtonGhost} />
          <Text style={styles.topTitle}>{t.tabs.cart}</Text>
          <View style={styles.clearButtonGhost} />
        </View>

        <ScrollView contentContainerStyle={styles.emptyScroll} showsVerticalScrollIndicator={false}>
          <View style={styles.emptyHero}>
            <View style={styles.emptyHeroText}>
              <Text style={styles.emptyTitle}>{t.cart.emptyTitle}</Text>
              <Text style={styles.emptyHint}>{t.cart.emptyHint}</Text>
            </View>
            <CartArt size={160} />
          </View>

          <Text style={styles.sectionTitle}>{t.cart.whyTitle}</Text>
          <View style={styles.whyRow}>
            {(
              [
                { icon: 'authentic', title: t.cart.whySecure, hint: t.cart.whySecureHint },
                { icon: 'delivery', title: t.cart.whyDelivery, hint: t.cart.whyDeliveryHint },
                { icon: 'premium', title: t.cart.whyQuality, hint: t.cart.whyQualityHint },
              ] as Array<{ icon: IconName; title: string; hint: string }>
            ).map((item) => (
              <View key={item.title} style={styles.whyCard}>
                <Icon name={item.icon} size={26} color={colors.accent} />
                <Text style={styles.whyTitle}>{item.title}</Text>
                <Text style={styles.whyHint}>{item.hint}</Text>
              </View>
            ))}
          </View>

          {/*
            ⚠️ KATEGORIYALAR API DAN, kodga yozilmagan. Ular do'kon
            katalogiga bog'liq va til bo'yicha serverdan keladi —
            qattiq yozilsa yangi bo'lim qo'shilganda bu ekran eskirib
            qolardi va tarjimasi ham qo'lda yuritilishi kerak bo'lardi.
          */}
          {topCategories.length > 0 ? (
            <>
              <Text style={styles.sectionTitle}>{t.cart.popularTitle}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.catRow}>
                  {topCategories.map((item) => (
                    <Pressable
                      key={item.id}
                      accessibilityRole="button"
                      onPress={() => router.push(`/catalog?category=${item.slug}`)}
                      style={styles.catCard}
                    >
                      <Icon
                        name={SLOT_ICONS[item.slot ?? ''] ?? 'slotTop'}
                        size={26}
                        color={colors.accent}
                      />
                      <Text style={styles.catLabel} numberOfLines={1}>
                        {item.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </>
          ) : null}

          <View style={styles.startCard}>
            <View style={styles.startIcon}>
              <Icon name="bag" size={26} color={colors.accent} />
            </View>
            <View style={styles.startText}>
              <Text style={styles.startTitle}>{t.cart.startTitle}</Text>
              <Text style={styles.startHint}>{t.cart.startHint}</Text>
            </View>
            <Pressable accessibilityRole="button" onPress={() => router.push('/catalog')}>
              <LinearGradient
                colors={[colors.accent, colors.primary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.startCta}
              >
                <Text style={styles.startCtaText}>{t.cart.startCta}</Text>
                <Icon name="next" size={15} color={colors.text} />
              </LinearGradient>
            </Pressable>
          </View>
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen>
      {/*
        Savatni tozalash — bitta-bitta o'chirish uzun savatda charchatadi.
        API'da `DELETE /v1/cart` boshidan bor edi, lekin ilovada unga
        kirish nuqtasi yo'q edi.
      */}
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        {/* Chapda ko'rinmas muvozanat — sarlavha aynan markazda tursin */}
        <View style={styles.clearButtonGhost} />
        <Text style={styles.topTitle}>{t.tabs.cart}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Savatni tozalash"
          disabled={busy}
          onPress={() => clear.mutate()}
          style={styles.clearButton}
        >
          <Icon name="trash" size={19} color={colors.danger} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
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

        {/* To'lov qanday ishlashini aytadi — K-10 bo'yicha bu SHART */}
        <View style={styles.paymentBox}>
          <Icon name="authentic" size={22} color={colors.accent} />
          <Text style={styles.paymentNote}>
            To'lov ilovada emas: buyurtma do'konga so'rov bo'lib boradi, hisob-kitob topshirishda.
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  emptyScroll: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },

  emptyHero: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  emptyHeroText: { flex: 1, gap: spacing.xs },
  emptyTitle: { ...text.h1, color: colors.text },
  emptyHint: { ...text.small, color: colors.textMuted },

  sectionTitle: { ...text.h3, color: colors.text, marginTop: spacing.sm },

  whyRow: { flexDirection: 'row', gap: spacing.sm },
  whyCard: {
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
  whyTitle: { ...text.small, color: colors.text, fontWeight: '600', textAlign: 'center' },
  whyHint: { ...text.tiny, color: colors.textDim, textAlign: 'center' },

  catRow: { flexDirection: 'row', gap: spacing.sm, paddingRight: spacing.md },
  catCard: {
    width: 92,
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  catLabel: { ...text.tiny, color: colors.textMuted },

  startCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    marginTop: spacing.sm,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  startIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderAccent,
    backgroundColor: colors.primarySoft,
  },
  startText: { flex: 1, gap: 2 },
  startTitle: { ...text.bodyMed, color: colors.text, fontWeight: '700' },
  startHint: { ...text.tiny, color: colors.textDim },
  startCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.pill,
  },
  startCtaText: { ...text.small, color: colors.text, fontWeight: '700' },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.md,
  },
  topTitle: { ...text.h3, color: colors.text, flex: 1, textAlign: 'center' },
  clearButtonGhost: { width: 42, height: 42 },
  clearButton: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
    backgroundColor: 'rgba(239,68,68,0.08)',
  },

  itemImage: {
    width: 92,
    height: 108,
    borderRadius: radius.md,
    backgroundColor: colors.surface2,
  },
  itemImageEmpty: { borderWidth: 1, borderColor: colors.border },
  itemBody: { flex: 1, gap: 3 },
  sizeChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    backgroundColor: colors.surface2,
    marginTop: 2,
  },
  sizeChipText: { ...text.tiny, color: colors.textMuted },
  itemFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },

  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xs },
  totalLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },

  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    // 20 px — maketdagi balandroq tugma (52 px o'rniga ~60 px)
    paddingVertical: spacing.md + 4,
    /*
     * ⚠️ GORIZONTAL PADDING SHART. Usiz chetdagi ikonkalar tugma
     * chegarasiga yopishib qolardi — matn markazda `flex: 1` bilan
     * cho'zilgani uchun ular ikki chekkaga surilib ketadi.
     */
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    marginTop: spacing.sm,
  },
  // Nurlanish faqat yuborish MUMKIN bo'lganda — o'chiq tugma yorqin bo'lmasin
  sendButtonReady: {
    shadowColor: colors.primary,
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
  },
  sendText: {
    ...text.bodyMed,
    color: colors.text,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },

  paymentBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },

  list: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    // Neon chegara — savat ekranning asosiy bloki, u ajralib tursin
    borderColor: colors.borderAccent,
    padding: spacing.md,
    gap: spacing.sm,
  },
  storeName: { ...text.bodyMed, color: colors.text, fontWeight: '700' },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  itemTitle: { ...text.small, color: colors.textMuted },
  itemPrice: { ...text.bodyMed, color: colors.text, fontWeight: '700' },
  unavailable: { ...text.tiny, color: colors.warning, marginTop: 2 },
  qty: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  /*
   * 42×42 va `radius.lg` — barmoq uchun qulay o'lcham (Apple tavsiyasi 44)
   * va maketdagi yumshoqroq burchak. Ilgari 36×36 / `radius.md` edi:
   * tugmalar mayda va o'tkir ko'rinardi.
   */
  qtyButton: {
    width: 42,
    height: 42,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Qo'shish tugmasi to'ldirilgan — asosiy amal shu
  qtyButtonAdd: {
    width: 42,
    height: 42,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyButtonText: { ...text.bodyMed, color: colors.text, fontWeight: '700' },
  qtyValue: { ...text.bodyMed, color: colors.text, minWidth: 22, textAlign: 'center' },
  totals: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  totalLabel: { ...text.small, color: colors.textDim },
  totalValue: { ...text.small, color: colors.textMuted },
  totalLabelStrong: { ...text.bodyMed, color: colors.text, fontWeight: '700' },
  totalValueStrong: { ...text.h3, color: colors.accent },
  warning: { ...text.small, color: colors.warning },
  paymentNote: { ...text.small, color: colors.textDim, flex: 1 },
});
