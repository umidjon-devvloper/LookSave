import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import { ApiError } from '../../src/api/client';
import { Icon } from '../../src/components/Icon';
import { SkeletonList } from '../../src/components/Skeleton';
import { Button, Empty, ErrorView, Screen } from '../../src/components/ui';
import { money } from '../../src/theme/format';
import { colors, radius, spacing, text } from '../../src/theme/tokens';

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

const FILTERS: Array<{ key: ProductStatusFilter; label: string }> = [
  { key: 'all', label: 'Hammasi' },
  { key: 'active', label: 'Faol' },
  { key: 'draft', label: 'Qoralama' },
  { key: 'pending', label: 'Tekshiruvda' },
];

const STATUS_LABEL: Record<string, { text: string; color: string }> = {
  active: { text: 'Faol', color: colors.success },
  draft: { text: 'Qoralama', color: colors.textDim },
  pending: { text: 'Tekshiruvda', color: colors.warning },
  rejected: { text: 'Rad etilgan', color: colors.danger },
  archived: { text: 'Arxiv', color: colors.textDim },
};

export default function SellerProducts(): JSX.Element {
  /*
   * ⚠️ Ildiz Stack bu bo'limda sarlavha chizmaydi (`headerShown: false`),
   * shuning uchun status paneli ostidagi bo'shliq QO'LDA qo'yiladi.
   * Aks holda sarlavha soat va batareya ustiga chiqib ketadi.
   */
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<ProductStatusFilter>('all');

  const products = useQuery({
    queryKey: ['store', 'products', filter],
    queryFn: () => getMyProducts(filter),
  });

  const remove = useMutation({
    mutationFn: deleteStoreProduct,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['store', 'products'] }),
    onError: (err) =>
      Alert.alert('O`chirilmadi', err instanceof ApiError ? err.message : 'Qaytadan urining'),
  });

  return (
    <Screen>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Orqaga"
          hitSlop={10}
          onPress={() => router.back()}
          style={styles.back}
        >
          <Icon name="back" size={20} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Mahsulotlar</Text>
        <View style={styles.back} />
      </View>

      <View style={styles.filters}>
        {FILTERS.map((item) => (
          <Pressable
            key={item.key}
            accessibilityRole="button"
            onPress={() => setFilter(item.key)}
            style={[styles.filter, filter === item.key && styles.filterActive]}
          >
            <Text style={[styles.filterText, filter === item.key && { color: colors.text }]}>
              {item.label}
            </Text>
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
              title="Mahsulot yo`q"
              hint="Birinchi mahsulotni qo`shing — u katalogda ko`rinadi."
              action={
                <Button
                  title="Mahsulot qo`shish"
                  onPress={() => router.push('/seller/product-new')}
                />
              }
            />
          }
          renderItem={({ item }) => (
            <ProductRow
              product={item}
              onDelete={() =>
                Alert.alert('Mahsulotni o`chirish', item.title, [
                  { text: 'Bekor qilish', style: 'cancel' },
                  {
                    text: 'O`chirish',
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
        <Button title="Mahsulot qo`shish" onPress={() => router.push('/seller/product-new')} />
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
  const status = STATUS_LABEL[product.status] ?? STATUS_LABEL['draft'];

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
          <Text style={[styles.status, { color: status?.color }]}>{status?.text}</Text>
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
        <Text style={styles.stockLabel}>Qoldiq: {total} dona</Text>
        <Text style={styles.stockEdit}>O`zgartirish</Text>
      </Pressable>
    );
  }

  if (detail.isLoading || !variant) {
    return (
      <View style={styles.stock}>
        <Text style={styles.stockLabel}>Yuklanmoqda…</Text>
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
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(sizes.map((s) => [s.size, String(s.stock)])),
  );

  const save = useMutation({
    mutationFn: (next: Array<{ size: string; stock: number }>) =>
      updateVariantStock(variantId, next),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['store'] }),
    onError: (err) =>
      Alert.alert('Saqlanmadi', err instanceof ApiError ? err.message : 'Qaytadan urining'),
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
      <Text style={styles.stockLabel}>Qoldiq</Text>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
  },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { ...text.h3, color: colors.text, flex: 1, textAlign: 'center' },

  filters: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  filter: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterActive: { borderColor: colors.borderAccent, backgroundColor: colors.primarySoft },
  filterText: { ...text.tiny, color: colors.textMuted },

  list: { padding: spacing.md, gap: spacing.md, paddingBottom: 100 },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardTop: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  thumb: { width: 56, height: 56, borderRadius: radius.md, backgroundColor: colors.surface2 },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  cardText: { flex: 1, gap: 2 },
  cardTitle: { ...text.bodyMed, color: colors.text },
  price: { ...text.small, color: colors.accent },
  status: { ...text.tiny },
  delete: { padding: spacing.xs },

  stock: {
    gap: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  stockToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.border,
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
    borderColor: colors.border,
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
  },
});
