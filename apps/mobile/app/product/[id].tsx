import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Dimensions, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError, api } from '../../src/api/client';
import { addFavorite, addToCart, removeFavorite, supportsAiTryon } from '../../src/api/endpoints';
import { Icon, type IconName } from '../../src/components/Icon';
import { Button, ErrorView, Loading, Screen } from '../../src/components/ui';
import { useI18n } from '../../src/i18n';
import { money } from '../../src/theme/format';
import { colors, radius, spacing, text } from '../../src/theme/tokens';
import { goBack } from '../../src/navigation/back';

/**
 * Karusel sahifasining kengligi.
 *
 * ⚠️ Modul darajasida bir marta olinadi: `pagingEnabled` ekran kengligiga
 * to'xtaydi, ya'ni rasm ham AYNAN shuncha bo'lishi kerak. Aks holda har
 * sahifada siljish orta boradi.
 */
const SCREEN_WIDTH = Dimensions.get('window').width;

/** Rasm balandligi — ekranning yarmidan sal ko'prog'i (maketdagi kompozitsiya) */
const IMAGE_HEIGHT = Math.round(SCREEN_WIDTH * 1.15);

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

/** Rasm ustidagi doira tugma — orqaga, ulashish, sevimli */
function RoundButton({
  icon,
  label,
  color,
  onPress,
}: {
  icon: IconName;
  label: string;
  color?: string;
  onPress: () => void;
}): JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.roundButton}
    >
      <Icon name={icon} size={20} color={color ?? colors.text} />
    </Pressable>
  );
}

export default function Product(): JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const t = useI18n((state) => state.t);
  const insets = useSafeAreaInsets();
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
  const isFavorite = favorite ?? data.isFavorite;

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

  const trust: Array<{ icon: IconName; label: string }> = [
    { icon: 'authentic', label: t.product.trustOriginal },
    { icon: 'reset', label: t.product.trustReturn },
    { icon: 'delivery', label: t.product.trustDelivery },
  ];

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/*
          Rasm bloki — status bar OSTIGA chiqadi (`headerShown: false`).
          Boshqaruv tugmalari rasm ustida suzadi, maketdagidek.
        */}
        <View style={styles.hero}>
          {/*
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
            {data.images.length > 0 ? (
              data.images.map((url) => (
                <Image key={url} source={{ uri: url }} style={styles.image} resizeMode="cover" />
              ))
            ) : (
              <View style={[styles.image, styles.imagePlaceholder]} />
            )}
          </ScrollView>

          {/*
            Tepa qorong'ilashuv — ikki qatlam.

            ⚠️ NEGA IKKITA. Bitta yumshoq gradient yetmasdi: yorug' rasmda
            (sharshara, osmon) soat, batareya va tugmalar bir-biriga
            qo'shilib ketardi — ekranda ular BIR QATORDA turgandek
            ko'rinardi va o'qib bo'lmasdi.

            Pastki qatlam — status bar sohasi bo'ylab QUYUQ fon, uning
            ostida esa yumshoq gradient rasmga singib ketadi.
          */}
          <LinearGradient
            colors={['rgba(6,5,10,0.95)', 'rgba(6,5,10,0.72)']}
            style={[styles.statusFade, { height: insets.top }]}
            pointerEvents="none"
          />
          <LinearGradient
            colors={['rgba(6,5,10,0.72)', 'rgba(10,10,15,0)']}
            style={[styles.topFade, { top: insets.top }]}
            pointerEvents="none"
          />

          <View style={[styles.heroBar, { top: insets.top + spacing.md }]}>
            <RoundButton
              icon="back"
              label={t.common.close}
              onPress={() => goBack('/marketplace')}
            />

            <View style={styles.heroActions}>
              <RoundButton
                icon="share"
                label={t.product.askStore}
                onPress={() => router.push(`/store/${data.store.id}`)}
              />
              <RoundButton
                icon={isFavorite ? 'favoriteOn' : 'favorite'}
                label={t.profile.myFavorites}
                color={isFavorite ? colors.accent : colors.text}
                onPress={() => toggleFavorite.mutate(!isFavorite)}
              />
            </View>
          </View>

          {/* «Premium» — cheklangan seriya belgisi, maketdagi o'ng past burchak */}
          {data.isLimited ? (
            <View style={styles.premium}>
              <Icon name="premium" size={15} color={colors.accent} />
              <Text style={styles.premiumText}>{t.product.premium}</Text>
            </View>
          ) : null}

          {/* Nuqtalar RASM USTIDA — ilgari ular rasmdan keyin alohida qatorda edi */}
          {data.images.length > 1 ? (
            <View style={styles.dots}>
              {data.images.map((url, index) => (
                <View key={url} style={[styles.dot, index === imageIndex && styles.dotActive]} />
              ))}
            </View>
          ) : null}
        </View>

        {/* Kontent rasmga ustma-ust chiqadi — yumaloq burchak bilan */}
        <View style={styles.body}>
          <View style={styles.headRow}>
            <View style={styles.headText}>
              {data.brand?.name ? <Text style={styles.brand}>{data.brand.name}</Text> : null}
              <Text style={styles.title}>{data.title}</Text>

              <View style={styles.priceRow}>
                <Text style={styles.price}>{money(data.price, data.currency)}</Text>
                {data.oldPrice ? (
                  <Text style={styles.oldPrice}>{money(data.oldPrice, data.currency)}</Text>
                ) : null}
              </View>
            </View>

            {/* Do'kon kartasi — nom va ish holati, maketdagi o'ng blok */}
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push(`/store/${data.store.id}`)}
              style={styles.storeCard}
            >
              <Icon name="shop" size={20} color={colors.accent} />
              <View style={styles.storeText}>
                <Text style={styles.storeName} numberOfLines={1}>
                  {data.store.name}
                </Text>
                <Text style={[styles.storeState, data.store.isOpen && { color: colors.success }]}>
                  {data.store.isOpen ? t.stores.open : t.stores.closed}
                </Text>
              </View>
            </Pressable>
          </View>

          {data.description ? <Text style={styles.description}>{data.description}</Text> : null}

          {data.variants.length > 1 ? (
            <View style={styles.panel}>
              <Text style={styles.panelLabel}>{t.product.color}</Text>
              <View style={styles.row}>
                {data.variants.map((item, index) => (
                  <Pressable
                    key={item.id}
                    accessibilityRole="button"
                    accessibilityLabel={item.colorName}
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
            </View>
          ) : null}

          <View style={styles.panel}>
            <View style={styles.panelHead}>
              <Text style={styles.panelLabel}>
                {t.product.size}
                {data.sizeChart?.system ? ` (${data.sizeChart.system})` : ''}
              </Text>
              {size === null ? <Text style={styles.panelHint}>{t.product.selectSize}</Text> : null}
            </View>

            <View style={styles.row}>
              {(variant?.sizes ?? []).map((item) => (
                <Pressable
                  key={item.size}
                  disabled={!item.available}
                  accessibilityRole="button"
                  accessibilityState={{ selected: size === item.size, disabled: !item.available }}
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
                      size === item.size && styles.sizeTextActive,
                      !item.available && { color: colors.textDim },
                    ]}
                  >
                    {item.size}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {cartError ? <Text style={styles.cartError}>{cartError}</Text> : null}

          {canTryOn ? (
            <Button title={t.product.tryOn} variant="ghost" onPress={() => router.push('/tryon')} />
          ) : null}

          {/* Asosiy amal va do'kon bilan bog'lanish — maketdagi juft */}
          <View style={styles.actions}>
            <View style={styles.actionMain}>
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
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t.product.askStore}
              onPress={() => router.push(`/store/${data.store.id}`)}
              style={styles.askButton}
            >
              <Icon name="chat" size={20} color={colors.text} />
            </Pressable>
          </View>

          <View style={styles.trust}>
            {trust.map((item) => (
              <View key={item.label} style={styles.trustItem}>
                <Icon name={item.icon} size={18} color={colors.accent} />
                <Text style={styles.trustText}>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxl },

  hero: { position: 'relative' },
  image: { width: SCREEN_WIDTH, height: IMAGE_HEIGHT, backgroundColor: colors.surface },
  imagePlaceholder: { borderBottomWidth: 1, borderColor: colors.border },
  statusFade: { position: 'absolute', left: 0, right: 0, top: 0 },
  topFade: { position: 'absolute', left: 0, right: 0, height: 150 },

  heroBar: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroActions: { flexDirection: 'row', gap: spacing.sm },
  roundButton: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10,10,15,0.5)',
  },

  premium: {
    position: 'absolute',
    right: spacing.md,
    // Kontent bloki rasmga 28 px ustma-ust chiqadi — belgi undan yuqorida turadi
    bottom: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    backgroundColor: 'rgba(10,10,15,0.72)',
  },
  premiumText: { ...text.small, color: colors.text, fontWeight: '600' },

  dots: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 44,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs + 2,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.35)' },
  dotActive: { width: 22, backgroundColor: colors.primary },

  /*
   * ⚠️ MANFIY MARGIN — kontent rasmga ustma-ust chiqadi. Maketdagi
   * yumaloq burchak aynan shu bilan hosil bo'ladi; usiz blok rasmdan
   * keyin boshlanardi va chegara tekis chiziq bo'lib qolardi.
   */
  body: {
    marginTop: -28,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    gap: spacing.md,
  },

  headRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  headText: { flex: 1, gap: 2 },
  brand: { ...text.tiny, color: colors.textDim, letterSpacing: 1.2 },
  title: { ...text.h2, color: colors.text },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, marginTop: 2 },
  price: { ...text.h2, color: colors.accent },
  oldPrice: { ...text.small, color: colors.textDim, textDecorationLine: 'line-through' },

  storeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    maxWidth: '46%',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  storeText: { flexShrink: 1 },
  storeName: { ...text.small, color: colors.text, fontWeight: '600' },
  storeState: { ...text.tiny, color: colors.accent },

  description: { ...text.body, color: colors.textMuted },

  panel: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm,
  },
  panelHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  panelLabel: { ...text.label, color: colors.accent },
  panelHint: { ...text.small, color: colors.textDim },

  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  colorDot: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorDotActive: { borderColor: colors.accent },

  // Kvadrat tugmalar — maketdagidek, doira emas
  sizeChip: {
    minWidth: 58,
    height: 54,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sizeChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  sizeChipDisabled: { opacity: 0.4 },
  sizeText: { ...text.bodyMed, color: colors.textMuted },
  sizeTextActive: { color: colors.text },

  cartError: { ...text.small, color: colors.danger },

  actions: { flexDirection: 'row', alignItems: 'stretch', gap: spacing.sm },
  actionMain: { flex: 1 },
  askButton: {
    width: 60,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },

  trust: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  trustItem: { flex: 1, alignItems: 'center', gap: spacing.xs },
  trustText: { ...text.tiny, color: colors.textMuted, textAlign: 'center' },
});
