import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Dimensions, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ApiError, api } from '../../src/api/client';
import { addFavorite, addToCart, removeFavorite, supportsAiTryon } from '../../src/api/endpoints';
import { Icon } from '../../src/components/Icon';
import { Button, ErrorView, Loading, Screen } from '../../src/components/ui';
import { useI18n } from '../../src/i18n';
import { money } from '../../src/theme/format';
import { colors, radius, spacing, text } from '../../src/theme/tokens';

/**
 * Karusel sahifasining kengligi.
 *
 * ⚠️ Modul darajasida bir marta olinadi: `pagingEnabled` ekran kengligiga
 * to'xtaydi, ya'ni rasm ham AYNAN shuncha bo'lishi kerak. Aks holda har
 * sahifada siljish orta boradi.
 */
const SCREEN_WIDTH = Dimensions.get('window').width;

interface ProductDetail {
  id: string;
  title: string;
  description: string | null;
  price: string;
  oldPrice: string | null;
  currency: string;
  images: string[];
  /** Kiyim toifasi — AI kiyintirish shu bo'yicha qaror qiladi */
  slot: string;
  isLimited: boolean;
  brand: { name: string | null } | null;
  store: { id: string; name: string; isOpen: boolean; distanceM: number | null };
  variants: Array<{
    id: string;
    colorHex: string | null;
    colorName: string;
    sizes: Array<{ size: string; available: boolean; stock: number }>;
    asset3d: { status: string } | null;
  }>;
  sizeChart: { type: string; system: string | null } | null;
  isFavorite: boolean;
}

export default function Product(): JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const t = useI18n((state) => state.t);
  const [variantIndex, setVariantIndex] = useState(0);
  const [size, setSize] = useState<string | null>(null);
  const [cartError, setCartError] = useState<string | null>(null);
  const [favorite, setFavorite] = useState<boolean | null>(null);
  const [imageIndex, setImageIndex] = useState(0);

  const product = useQuery({
    queryKey: ['product', id],
    queryFn: () => api<ProductDetail>(`/products/${id}`),
    enabled: Boolean(id),
  });

  const add = useMutation({
    mutationFn: () => {
      if (!variant || size === null) throw new Error("O'lcham tanlanmagan");
      return addToCart(variant.id, size);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['cart'] });
      router.push('/(tabs)/cart');
    },
    onError: (err) => {
      setCartError(
        err instanceof ApiError && err.code === 'OUT_OF_STOCK'
          ? t.product.outOfStock
          : err instanceof ApiError && err.code === 'UNAUTHORIZED'
            ? t.product.signInFirst
            : t.errors.generic,
      );
    },
  });

  /**
   * Sevimli holati darhol o'zgaradi (optimistik) — tarmoq javobini
   * kutish yurak tugmasini sekin ko'rsatadi. Xato bo'lsa qaytariladi.
   */
  const toggleFavorite = useMutation({
    mutationFn: (next: boolean) => (next ? addFavorite(id) : removeFavorite(id)),
    onMutate: (next) => {
      setFavorite(next);
      return { previous: !next };
    },
    onError: (_err, _next, context) => {
      if (context) setFavorite(context.previous);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['favorites'] });
    },
  });

  if (product.isLoading) return <Loading />;
  if (product.isError || !product.data) {
    return <ErrorView error={product.error} onRetry={() => void product.refetch()} />;
  }

  const data = product.data;
  const variant = data.variants[variantIndex];
  /*
   * ⚠️ SHART 3D EMAS, KIYIM SURATI VA SLOT.
   *
   * Ilgari bu `asset3d.status === 'ready'` edi va tugma 3D ekranga olib
   * borardi — u endi ishlamaydi. Kiyintirish AI orqali bo'ladi va unga
   * 3D umuman kerak emas: kiyimning oddiy surati yetarli.
   *
   * Model faqat kiyim uchun o'qitilgan, shuning uchun oyoq kiyim, soat va
   * sumkada tugma ko'rsatilmaydi — natija ishonchsiz chiqardi.
   */
  const canTryOn = supportsAiTryon(data.slot) && Boolean(data.images[0]);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        {/*
          Rasm karuseli.

          ⚠️ KENGLIK EKRANDAN OLINADI, qattiq yozilmaydi. Ilgari u 360
          piksel edi va bu hech bir zamonaviy iPhone kengligiga to'g'ri
          kelmasdi: keyingi rasm chetdan ko'rinib turardi, `pagingEnabled`
          esa EKRAN kengligiga tayanib to'xtardi — natijada har sahifada
          siljish orta borardi va rasmlar qiyshiq to'xtardi.
        */}
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={(event) =>
            setImageIndex(Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH))
          }
          scrollEventThrottle={16}
        >
          {data.images.map((url) => (
            <Image key={url} source={{ uri: url }} style={styles.image} resizeMode="cover" />
          ))}
        </ScrollView>

        {/* Nuqtalar — bir nechta rasm borligini bildiradi */}
        {data.images.length > 1 ? (
          <View style={styles.dots}>
            {data.images.map((url, index) => (
              <View key={url} style={[styles.dot, index === imageIndex && styles.dotActive]} />
            ))}
          </View>
        ) : null}

        <View style={styles.body}>
          <View style={styles.titleRow}>
            <View style={{ flex: 1 }}>
              {data.brand?.name ? <Text style={styles.brand}>{data.brand.name}</Text> : null}
              <Text style={styles.title}>{data.title}</Text>
            </View>

            <Pressable
              accessibilityLabel="Sevimlilarga qo`shish"
              hitSlop={12}
              onPress={() => toggleFavorite.mutate(!(favorite ?? data.isFavorite))}
            >
              <Icon
                name={(favorite ?? data.isFavorite) ? 'favoriteOn' : 'favorite'}
                size={22}
                color={(favorite ?? data.isFavorite) ? colors.danger : colors.textMuted}
              />
            </Pressable>
          </View>

          <View style={styles.priceRow}>
            <Text style={styles.price}>{money(data.price, data.currency)}</Text>
            {data.oldPrice ? (
              <Text style={styles.oldPrice}>{money(data.oldPrice, data.currency)}</Text>
            ) : null}
          </View>

          <Text style={styles.store}>
            {data.store.name} · {data.store.isOpen ? t.stores.open : t.stores.closed}
          </Text>

          {data.variants.length > 1 ? (
            <>
              <Text style={styles.label}>{t.product.color}</Text>
              <View style={styles.row}>
                {data.variants.map((item, index) => (
                  <Pressable
                    key={item.id}
                    onPress={() => {
                      setVariantIndex(index);
                      setSize(null);
                    }}
                    style={[
                      styles.colorDot,
                      { backgroundColor: item.colorHex ?? colors.surface2 },
                      index === variantIndex && styles.colorDotActive,
                    ]}
                  />
                ))}
              </View>
            </>
          ) : null}

          <Text style={styles.label}>
            {t.product.size}
            {data.sizeChart?.system ? ` (${data.sizeChart.system})` : ''}
          </Text>
          <View style={styles.row}>
            {(variant?.sizes ?? []).map((item) => (
              <Pressable
                key={item.size}
                disabled={!item.available}
                onPress={() => setSize(item.size)}
                style={[
                  styles.sizeChip,
                  size === item.size && styles.sizeChipActive,
                  !item.available && styles.sizeChipDisabled,
                ]}
              >
                <Text
                  style={[
                    styles.sizeText,
                    size === item.size && { color: colors.text },
                    !item.available && { color: colors.textDim },
                  ]}
                >
                  {item.size}
                </Text>
              </Pressable>
            ))}
          </View>

          {data.description ? <Text style={styles.description}>{data.description}</Text> : null}

          {cartError ? <Text style={styles.cartError}>{cartError}</Text> : null}

          <View style={styles.actions}>
            {canTryOn ? (
              <Button title={t.product.tryOn} variant="ghost" onPress={() => router.push('/ai')} />
            ) : null}
            <Button
              title={size === null ? t.product.selectSize : t.product.addToCart}
              disabled={size === null}
              loading={add.isPending}
              onPress={() => {
                setCartError(null);
                add.mutate();
              }}
            />
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxl },
  image: { width: SCREEN_WIDTH, aspectRatio: 3 / 4, backgroundColor: colors.surface },

  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border },
  dotActive: { backgroundColor: colors.accent, width: 18 },
  body: { padding: spacing.md, gap: spacing.xs },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  brand: { ...text.label, color: colors.textDim },
  title: { ...text.h2, color: colors.text },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  price: { ...text.h3, color: colors.text },
  oldPrice: { ...text.small, color: colors.textDim, textDecorationLine: 'line-through' },
  store: { ...text.small, color: colors.textMuted },
  label: { ...text.label, color: colors.textDim, marginTop: spacing.md },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  colorDot: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: colors.border,
  },
  colorDotActive: { borderColor: colors.primary },
  sizeChip: {
    minWidth: 52,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  sizeChipActive: { borderColor: colors.primary, backgroundColor: colors.surface2 },
  sizeChipDisabled: { opacity: 0.4 },
  sizeText: { ...text.bodyMed, color: colors.textMuted },
  description: { ...text.body, color: colors.textMuted, marginTop: spacing.md },
  actions: { gap: spacing.sm, marginTop: spacing.lg },
  cartError: { ...text.small, color: colors.danger, marginTop: spacing.md },
});
