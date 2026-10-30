import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, FlatList, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

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
import { SellerHeader } from '../../src/components/SellerHeader';
import { SkeletonList } from '../../src/components/Skeleton';
import { Button, Empty, ErrorView, Screen } from '../../src/components/ui';
import { useI18n, type Dictionary } from '../../src/i18n';
import { useAuthStore } from '../../src/store/authStore';
import { money } from '../../src/theme/format';
import { colors, radius, spacing, text } from '../../src/theme/tokens';
import { goBack } from '../../src/navigation/back';

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
        <SellerHeader title={t.sellerTabs.products} onBack={() => router.replace('/seller')} />
        <Empty
          icon="shop"
          title={t.sellerDashboard.notSellerTitle}
          hint={t.sellerDashboard.notSellerDesc}
          action={
            <Button title={t.sellerDashboard.applyNow} onPress={() => router.push('/seller/apply')} />
          }
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <SellerHeader
        title={t.seller.productsTitle}
        subtitle={
          products.data
            ? t.seller.showing.replace('{n}', String(products.data.items.length))
            : undefined
        }
        onBack={() => goBack('/seller')}
      />

      <View style={styles.filters}>
        {FILTERS.map((item) => (
          <Pressable
            key={item.key}
            accessibilityRole="button"
            onPress={() => setFilter(item.key)}
            style={styles.filterWrap}
          >
            {filter === item.key ? (
              <LinearGradient
                colors={[colors.accent, colors.primary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.filter}
              >
                <Text style={[styles.filterText, { color: colors.text }]}>
                  {t.seller[item.labelKey]}
                </Text>
              </LinearGradient>
            ) : (
              <View style={styles.filter}>
                <Text style={styles.filterText}>{t.seller[item.labelKey]}</Text>
              </View>
            )}
          </Pressable>
        ))}
      </View>

      {products.isLoading ? <SkeletonList count={4} /> : null}
      {products.isError ? (
        <ErrorView error={products.error} onRetry={() => void products.refetch()} />
      ) : null}

      {products.data ? (
        <FlatList
          data={products.data.items}
          keyExtractor={(product) => product.id}
          contentContainerStyle={styles.list}
          refreshing={products.isFetching}
          onRefresh={() => void products.refetch()}
          removeClippedSubviews
          initialNumToRender={6}
          ListEmptyComponent={
            <Empty
              icon="slotTop"
              title={t.seller.pEmptyTitle}
              hint={t.seller.pEmptyHint}
              action={
                <Button
                  title={t.seller.addProduct}
                  onPress={() => router.push('/seller/product-new')}
                />
              }
            />
          }
          renderItem={({ item }) => (
            <ProductRow
              product={item}
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
      ) : null}

      <View style={styles.fab}>
        <Button title={t.seller.addProduct} onPress={() => router.push('/seller/product-new')} />
      </View>
    </Screen>
  );
}

function ProductRow({
  product,
  onDelete,
}: {
  product: StoreProduct;
  onDelete: () => void;
}): JSX.Element {
  const t = useI18n((state) => state.t);
  const meta = STATUS_LABEL[product.status];
  const statusText = meta ? t.seller[meta.textKey] : product.status;
  const statusColor = meta?.color ?? colors.textDim;

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        {product.image ? (
          <Image source={{ uri: product.image }} style={styles.thumb} resizeMode="cover" />
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

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="O`chirish"
          hitSlop={8}
          onPress={onDelete}
          style={styles.delete}
        >
          <Icon name="close" size={16} color={colors.textDim} />
        </Pressable>
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
  filters: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    padding: spacing.xs,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: 'rgba(15, 13, 22, 0.92)',
  },
  filterWrap: { flex: 1 },
  filter: {
    minHeight: 38,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterText: { ...text.tiny, color: colors.textMuted, fontWeight: '700', textAlign: 'center' },

  list: { padding: spacing.md, gap: spacing.md, paddingBottom: 100 },

  card: {
    backgroundColor: 'rgba(20, 18, 28, 0.95)',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    padding: spacing.md,
    gap: spacing.sm,
    shadowColor: '#000000',
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
  },
  cardTop: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  thumb: {
    width: 62,
    height: 62,
    borderRadius: radius.lg,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  cardText: { flex: 1, gap: spacing.xs },
  cardTitle: { ...text.bodyMed, color: colors.text },
  price: { ...text.bodyMed, color: colors.accent },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 1,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  statusDot: { width: 6, height: 6, borderRadius: radius.pill },
  statusText: { ...text.tiny },
  delete: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface2,
  },

  stock: {
    gap: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.borderStrong,
    paddingTop: spacing.sm,
  },
  stockToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.borderStrong,
    paddingTop: spacing.sm,
  },
  stockEdit: { ...text.tiny, color: colors.accent },
  stockLabel: { ...text.tiny, color: colors.textDim },
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

  fab: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.lg,
    shadowColor: colors.primary,
    shadowOpacity: 0.36,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
});
