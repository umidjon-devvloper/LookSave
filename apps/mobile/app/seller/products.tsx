import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, FlatList, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  deleteStoreProduct,
  getMyProduct,
  getMyProducts,
  updateVariantStock,
  type ProductStatusFilter,
  type StoreProduct,
} from '../../src/api/endpoints';
import { explainError } from '../../src/api/explainError';
import { Icon } from '../../src/components/Icon';
import { SkeletonList } from '../../src/components/Skeleton';
import { Button, Empty, ErrorView, Screen } from '../../src/components/ui';
import { useI18n, type Dictionary } from '../../src/i18n';
import { useAuthStore } from '../../src/store/authStore';
import { money } from '../../src/theme/format';
import { SELLER_TAB_BAR_SPACE } from '../../src/theme/sellerTabBar';
import { colors, radius, spacing, text } from '../../src/theme/tokens';
import { goBack } from '../../src/navigation/back';

const SELLER_BAG = require('../../assets/seller-dashboard-bag-v2.png');

/** «Mahsulot qo'shish» suzuvchi tugmasining balandligi (`styles.addButton`) */
const ADD_BUTTON_HEIGHT = 58;

/**
 * Do'kon mahsulotlari.
 *
 * ⚠️ QOLDIQ SHU YERDA TAHRIRLANADI, alohida ekranda emas. Bu eng tez-tez
 * bajariladigan ish: mahsulot sotilganda sotuvchi darhol raqamni
 * kamaytirishi kerak. Uni ichki ekranga yashirsak, har safar ikki-uch
 * bosish qo'shilardi va ko'p sotuvchi umuman yangilamay qo'yardi —
 * natijada mijoz omborda yo'q narsani buyurtma qilardi.
 *
 * ⚠️ RO'YXAT JAVOBI BATAFSILIDAN FARQ QILADI. Server ro'yxatda faqat
 * bitta rasm va UMUMIY qoldiq beradi; variantlar va o'lchamlar yo'q.
 * Buni sinovda topdim — tip noto'g'ri yozilgani uchun ilova
 * `product.images[0]` da qulagan edi.
 */

const FILTERS: Array<{ key: ProductStatusFilter; labelKey: keyof Dictionary['seller'] }> = [
  { key: 'all', labelKey: 'filterAll' },
  { key: 'active', labelKey: 'statusActive' },
  { key: 'draft', labelKey: 'statusDraft' },
  { key: 'pending', labelKey: 'statusPending' },
];

const STATUS_LABEL: Record<string, { textKey: keyof Dictionary['seller']; color: string }> = {
  active: { textKey: 'statusActive', color: colors.success },
  draft: { textKey: 'statusDraft', color: colors.textDim },
  pending: { textKey: 'statusPending', color: colors.warning },
  rejected: { textKey: 'statusRejected', color: colors.danger },
  archived: { textKey: 'statusArchived', color: colors.textDim },
};

export default function SellerProducts(): JSX.Element {
  /*
   * ⚠️ Ildiz Stack bu bo'limda sarlavha chizmaydi (`headerShown: false`),
   * shuning uchun status paneli ostidagi bo'shliq QO'LDA qo'yiladi.
   * Aks holda sarlavha soat va batareya ustiga chiqib ketadi.
   */
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const t = useI18n((state) => state.t);
  const user = useAuthStore((state) => state.user);
  const isSeller = user?.role === 'store_owner';
  const [filter, setFilter] = useState<ProductStatusFilter>('all');

  const products = useQuery({
    queryKey: ['store', 'products', filter],
    queryFn: () => getMyProducts(filter),
    enabled: isSeller,
  });

  const remove = useMutation({
    mutationFn: deleteStoreProduct,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['store', 'products'] }),
    onError: (err) => Alert.alert(t.facePhoto.deleteFailedTitle, explainError(err, t)),
  });

  if (!isSeller) {
    return (
      <Screen>
        <View style={{ height: insets.top }} />
        <Empty
          icon="shop"
          title={t.sellerDashboard.notSellerTitle}
          hint={t.sellerDashboard.notSellerDesc}
          action={
            <Button
              title={t.sellerDashboard.applyNow}
              onPress={() => router.push('/become-seller')}
            />
          }
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <LinearGradient
        colors={['#FFFFFF', '#FBF8FF', '#F3ECFF']}
        locations={[0, 0.58, 1]}
        style={StyleSheet.absoluteFill}
      />

      <FlatList
        data={products.data?.items ?? []}
        keyExtractor={(product) => product.id}
        contentContainerStyle={styles.list}
        refreshing={products.isFetching}
        onRefresh={() => void products.refetch()}
        removeClippedSubviews
        initialNumToRender={6}
        ListHeaderComponent={
          <>
            <View style={{ height: insets.top + 8 }} />
            <View style={styles.topbar}>
              <Pressable
                accessibilityRole="button"
                onPress={() => goBack('/seller')}
                style={styles.roundButton}
              >
                <Icon name="back" size={25} color={colors.text} />
              </Pressable>
              <Text style={styles.wordmark} numberOfLines={1}>
                LOOK<Text style={styles.wordmarkAccent}>SAVE</Text>
                <Text style={styles.wordmarkSeller}> · SELLER</Text>
              </Text>
              {/*
                Qo'ng'iroq yangi buyurtmalarga olib boradi. Ilgari bu tugmada
                amal yo'q edi va ustida DOIM nuqta yonib turardi — bosilsa hech
                narsa bo'lmasdi (App Review 2.1 aynan shunday tugmalar uchun
                qaytaradi).
              */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t.sellerDashboard.viewOrders}
                style={styles.roundButton}
                onPress={() => router.push('/seller/orders')}
              >
                <Icon name="bell" size={24} color={colors.text} />
              </Pressable>
            </View>

            <View style={styles.hero}>
              <View style={styles.heroCopy}>
                <Text style={styles.heroTitle}>{t.seller.productsTitle}</Text>
                <Text style={styles.heroSubtitle}>
                  {t.seller.showing.replace('{n}', String(products.data?.items.length ?? 0))}
                </Text>
              </View>
              <View style={styles.bags} pointerEvents="none">
                <Image source={SELLER_BAG} style={styles.bagSmall} resizeMode="contain" />
                <Image source={SELLER_BAG} style={styles.bagLarge} resizeMode="contain" />
              </View>
              <View style={styles.heroWaveOne} />
              <View style={styles.heroWaveTwo} />
            </View>

            <View style={styles.filters}>
              {FILTERS.map((item) => {
                const selected = filter === item.key;
                const icon =
                  item.key === 'all'
                    ? 'orders'
                    : item.key === 'active'
                      ? 'check'
                      : item.key === 'draft'
                        ? 'clock'
                        : 'shop';
                return (
                  <Pressable
                    key={item.key}
                    accessibilityRole="button"
                    onPress={() => setFilter(item.key)}
                    style={styles.filterWrap}
                  >
                    {selected ? (
                      <LinearGradient
                        colors={[colors.accent, colors.primaryDim]}
                        style={styles.filter}
                      >
                        <Icon name={icon} size={17} color={colors.textOnPrimary} />
                        <Text style={[styles.filterText, styles.filterTextActive]}>
                          {t.seller[item.labelKey]}
                        </Text>
                      </LinearGradient>
                    ) : (
                      <View style={styles.filter}>
                        {item.key === 'active' ? (
                          <View style={styles.filterDot} />
                        ) : (
                          <Icon name={icon} size={17} color={colors.textMuted} />
                        )}
                        <Text style={styles.filterText}>{t.seller[item.labelKey]}</Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>

            {products.isLoading ? <SkeletonList count={3} /> : null}
            {products.isError ? (
              <ErrorView error={products.error} onRetry={() => void products.refetch()} />
            ) : null}
          </>
        }
        ListEmptyComponent={
          products.isLoading || products.isError ? null : (
            <Empty icon="slotTop" title={t.seller.pEmptyTitle} hint={t.seller.pEmptyHint} />
          )
        }
        renderItem={({ item }) => (
          <ProductRow
            product={item}
            onEdit={() => router.push({ pathname: '/seller/product-new', params: { id: item.id } })}
            onDelete={() =>
              Alert.alert(t.seller.deleteProductTitle, item.title, [
                { text: t.common.cancel, style: 'cancel' },
                {
                  text: t.facePhoto.delete,
                  style: 'destructive',
                  onPress: () => remove.mutate(item.id),
                },
              ])
            }
          />
        )}
      />

      <View style={styles.fab}>
        <Pressable accessibilityRole="button" onPress={() => router.push('/seller/product-new')}>
          <LinearGradient
            colors={[colors.accent, colors.primaryDim]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.addButton}
          >
            <View style={styles.addIcon}>
              <Text style={styles.addIconText}>+</Text>
            </View>
            <Text style={styles.addButtonText}>{t.seller.addProduct}</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </Screen>
  );
}

function ProductRow({
  product,
  onDelete,
  onEdit,
}: {
  product: StoreProduct;
  onDelete: () => void;
  onEdit: () => void;
}): JSX.Element {
  const t = useI18n((state) => state.t);
  const meta = STATUS_LABEL[product.status];
  const statusText = meta ? t.seller[meta.textKey] : product.status;
  const statusColor = meta?.color ?? colors.textDim;

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        {product.image ? (
          <Image source={{ uri: product.image }} style={styles.thumb} resizeMode="contain" />
        ) : (
          <View style={[styles.thumb, styles.thumbEmpty]}>
            <Icon name="slotTop" size={20} color={colors.textDim} />
          </View>
        )}

        <View style={styles.cardText}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {product.title}
          </Text>
          <Text style={styles.price}>{money(product.price, product.currency)}</Text>
          <View
            style={[
              styles.statusPill,
              { borderColor: `${statusColor}55`, backgroundColor: `${statusColor}1A` },
            ]}
          >
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>
          </View>
        </View>

        <View style={styles.cardActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.seller.edit}
            hitSlop={8}
            onPress={onEdit}
            style={styles.cardActionBtn}
          >
            <Icon name="edit" size={16} color={colors.accent} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.seller.deleteProductTitle}
            hitSlop={8}
            onPress={onDelete}
            style={styles.cardActionBtn}
          >
            <Icon name="trash" size={18} color={colors.textMuted} />
          </Pressable>
        </View>
      </View>

      {/*
        Qoldiq — o'lcham bo'yicha, shu yerda tahrirlanadi.

        ⚠️ VARIANTLAR RO'YXAT JAVOBIDA YO'Q: server yengil qilish uchun
        faqat umumiy sonni beradi. Shuning uchun ular ochilganda alohida
        so'raladi — hamma mahsulot uchun oldindan so'rasak, ro'yxat
        ochilishida o'nlab keraksiz so'rov ketardi.
      */}
      <StockEditor productId={product.id} total={product.stock.total} />
    </View>
  );
}

/**
 * Qoldiq muharriri.
 *
 * Yopiq holatda faqat umumiy son ko'rinadi. Ochilganda mahsulot batafsil
 * so'raladi va o'lchamlar chiqadi — ya'ni so'rov faqat kerak bo'lganda
 * yuboriladi.
 */
function StockEditor({ productId, total }: { productId: string; total: number }): JSX.Element {
  const queryClient = useQueryClient();
  const t = useI18n((state) => state.t);
  const [open, setOpen] = useState(false);

  const detail = useQuery({
    queryKey: ['store', 'product', productId],
    queryFn: () => getMyProduct(productId),
    enabled: open,
  });

  const variant = detail.data?.variants[0];
  const sizes = variant?.sizes ?? [];

  if (!open) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        style={styles.stockToggle}
      >
        <Text style={styles.stockLabel}>{t.seller.stockOf.replace('{n}', String(total))}</Text>
        <Text style={styles.stockEdit}>{t.seller.edit}</Text>
      </Pressable>
    );
  }

  if (detail.isLoading || !variant) {
    return (
      <View style={styles.stock}>
        <Text style={styles.stockLabel}>{`${t.common.loading}…`}</Text>
      </View>
    );
  }

  return <SizeInputs variantId={variant.id} sizes={sizes} queryClient={queryClient} />;
}

function SizeInputs({
  variantId,
  sizes,
  queryClient,
}: {
  variantId: string;
  sizes: Array<{ size: string; stock: number }>;
  queryClient: ReturnType<typeof useQueryClient>;
}): JSX.Element {
  const t = useI18n((state) => state.t);
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(sizes.map((s) => [s.size, String(s.stock)])),
  );

  const save = useMutation({
    mutationFn: (next: Array<{ size: string; stock: number }>) =>
      updateVariantStock(variantId, next),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['store'] }),
    onError: (err) => Alert.alert(t.look.saveFailed, explainError(err, t)),
  });

  /*
   * ⚠️ SAQLASH FOKUS YO'QOLGANDA, har bosishda emas. Har raqamda so'rov
   * yuborilsa "12" yozganda ikkita so'rov ketardi va oxirgisi kechikib
   * kelib eski qiymatni tiklashi mumkin edi.
   */
  const commit = (): void => {
    const next = sizes.map((s) => ({
      size: s.size,
      stock: Math.max(0, Number.parseInt(values[s.size] ?? '0', 10) || 0),
    }));
    const changed = next.some((n, i) => n.stock !== sizes[i]?.stock);
    if (changed) save.mutate(next);
  };

  return (
    <View style={styles.stock}>
      <Text style={styles.stockLabel}>{t.seller.stock}</Text>
      <View style={styles.stockRow}>
        {sizes.map((item) => (
          <View key={item.size} style={styles.stockItem}>
            <Text style={styles.stockSize}>{item.size}</Text>
            <TextInput
              value={values[item.size] ?? ''}
              onChangeText={(value) =>
                setValues((current) => ({ ...current, [item.size]: value.replace(/[^0-9]/g, '') }))
              }
              onBlur={commit}
              keyboardType="number-pad"
              style={styles.stockInput}
              maxLength={5}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topbar: {
    height: 64,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  roundButton: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderWidth: 1,
    borderColor: '#E7DDF8',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7C3AED',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  wordmark: {
    ...text.bodyMed,
    color: colors.text,
    fontWeight: '800',
    letterSpacing: 1.4,
    fontSize: 13,
    flexShrink: 1,
    textAlign: 'center',
  },
  wordmarkAccent: { color: colors.accent },
  wordmarkSeller: { color: colors.textMuted, fontWeight: '600' },
  hero: {
    height: 206,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    overflow: 'hidden',
  },
  heroCopy: { zIndex: 3, maxWidth: '60%' },
  heroTitle: { ...text.h1, color: colors.text, fontSize: 34, lineHeight: 40 },
  heroSubtitle: { ...text.bodyMed, color: colors.textMuted, marginTop: spacing.sm, fontSize: 17 },
  bags: { position: 'absolute', right: 10, top: 4, width: 210, height: 184, zIndex: 2 },
  bagLarge: {
    position: 'absolute',
    width: 150,
    height: 150,
    right: -4,
    top: 0,
    transform: [{ rotate: '3deg' }],
  },
  bagSmall: {
    position: 'absolute',
    width: 112,
    height: 112,
    left: 3,
    top: 62,
    transform: [{ rotate: '-5deg' }],
  },
  heroWaveOne: {
    position: 'absolute',
    width: '120%',
    height: 130,
    left: -20,
    bottom: -79,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(139,44,245,0.10)',
    transform: [{ rotate: '-7deg' }],
  },
  heroWaveTwo: {
    position: 'absolute',
    width: '110%',
    height: 82,
    right: -40,
    bottom: -52,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.75)',
    transform: [{ rotate: '-7deg' }],
  },
  filters: {
    flexDirection: 'row',
    marginHorizontal: spacing.sm,
    marginBottom: spacing.lg,
    padding: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: '#E7DDF8',
    backgroundColor: 'rgba(255,255,255,0.92)',
    shadowColor: '#7C3AED',
    shadowOpacity: 0.14,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  filterWrap: { flex: 1 },
  filter: {
    height: 48,
    paddingHorizontal: 5,
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterText: {
    ...text.tiny,
    color: colors.textMuted,
    fontWeight: '700',
    textAlign: 'center',
    fontSize: 10,
  },
  filterTextActive: { color: colors.textOnPrimary },
  filterDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#12C55B' },

  /*
   * Oxirgi karta tab bar VA suzuvchi «Mahsulot qo'shish» tugmasidan yuqoriga
   * chiqa olsin — aks holda uning «Tahrirlash»/«O'chirish» tugmalari tugma
   * ostida qolib, bosilmaydi.
   */
  list: {
    gap: spacing.md,
    paddingBottom: SELLER_TAB_BAR_SPACE + spacing.sm + ADD_BUTTON_HEIGHT + spacing.md,
  },

  card: {
    marginHorizontal: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: '#DDC9FA',
    padding: spacing.md,
    gap: spacing.sm,
    shadowColor: '#7C3AED',
    shadowOpacity: 0.14,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  cardTop: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  thumb: {
    width: 84,
    height: 84,
    borderRadius: radius.xl,
    backgroundColor: colors.surface2,
  },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  cardText: { flex: 1, gap: spacing.xs },
  cardTitle: { ...text.h3, color: colors.text, fontSize: 16 },
  price: { ...text.h3, color: colors.primary, fontSize: 19 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 1,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 0,
  },
  statusDot: { width: 6, height: 6, borderRadius: radius.pill },
  statusText: { ...text.tiny },
  cardActions: { flexDirection: 'column', gap: spacing.xs, alignItems: 'center' },
  cardActionBtn: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F4ECFF',
  },

  stock: {
    gap: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: '#E8DDF7',
    paddingTop: spacing.sm,
  },
  stockToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#E8DDF7',
    paddingTop: spacing.sm,
  },
  stockEdit: { ...text.small, color: colors.primary, fontWeight: '700' },
  stockLabel: { ...text.small, color: colors.textMuted, fontWeight: '600' },
  stockRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  stockItem: { alignItems: 'center', gap: 2 },
  stockSize: { ...text.tiny, color: colors.textMuted },
  stockInput: {
    width: 52,
    height: 40,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface2,
    color: colors.text,
    textAlign: 'center',
    ...text.body,
  },

  /*
   * ⚠️ TAB BARDAN YUQORIDA. Sotuvchi tab bari suzuvchi (`position: 'absolute'`)
   * — ekran uning ostiga ham chiziladi. Ilgari bu yerda `bottom: spacing.sm`
   * turardi va tugma BUTUNLAY bar ostida yashirin edi: ko'rinmasdi ham,
   * bosilmasdi ham (2026-11-18, `sellerTabBar.ts`).
   */
  fab: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: SELLER_TAB_BAR_SPACE + spacing.sm,
    shadowColor: colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  addButton: {
    height: ADD_BUTTON_HEIGHT,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  addIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addIconText: { color: colors.textOnPrimary, fontSize: 26, lineHeight: 28, fontWeight: '400' },
  addButtonText: { ...text.h3, color: colors.textOnPrimary },
});
