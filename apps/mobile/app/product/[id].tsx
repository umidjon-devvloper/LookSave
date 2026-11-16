import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Dimensions, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { matches } from '../../src/ai/lookTray';
import { ApiError, api } from '../../src/api/client';
import { addFavorite, addToCart, removeFavorite, supportsAiTryon } from '../../src/api/endpoints';
import { Icon, type IconName } from '../../src/components/Icon';
import { Button, ErrorView, Loading, Screen } from '../../src/components/ui';
import { useI18n } from '../../src/i18n';
import { useLookStore } from '../../src/store/lookStore';
import { money } from '../../src/theme/format';
import { colors, radius, spacing, text } from '../../src/theme/tokens';
import { goBack } from '../../src/navigation/back';

/**
 * Product detail — Atelier editorial.
 *
 * Yuqorida to'liq rasm, pastda jurnalning oyoqligi kabi tartiblangan
 * tipografik blok. Dark overlay olib tashlandi: rasm ustida oq pill
 * tugmalar va krem fonga oqadigan pastki chekka. Narx serifda —
 * karta ichidagi eng muhim fakt.
 */
const SCREEN_WIDTH = Dimensions.get('window').width;
const IMAGE_HEIGHT = Math.round(SCREEN_WIDTH * 1.15);

// colors.bg = #F7F2EA — krem rangning rgba'si gradient'lar uchun
const CREAM_CLEAR = 'rgba(247,242,234,0)';
const CREAM_SOLID = 'rgba(247,242,234,1)';

/** Slotning texnik nomi → lug'atdagi yorliq (`t.look`). Notanish slot o'zicha ko'rsatiladi. */
const SLOT_LABEL: Record<
  string,
  'slotTop' | 'slotOuter' | 'slotBottom' | 'slotFeet' | 'slotWrist'
> = {
  top: 'slotTop',
  outer: 'slotOuter',
  bottom: 'slotBottom',
  feet: 'slotFeet',
  wrist: 'slotWrist',
};

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

/** Rasm ustidagi oq doira tugma — orqaga, ulashish, sevimli */
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
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  // «Look» savati — bosh sahifadagi kartalar bilan BITTA ro'yxat (`lookStore`)
  const lookItems = useLookStore((state) => state.items);
  const addLook = useLookStore((state) => state.add);
  const removeLook = useLookStore((state) => state.remove);

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
   * ⚠️ SHART 3D EMAS, KIYIM SURATI VA SLOT. Kiyintirish AI orqali bo'ladi.
   * Model faqat kiyim uchun o'qitilgan, shuning uchun oyoq kiyim, soat va
   * sumkada tugma ko'rsatilmaydi.
   */
  const canTryOn = supportsAiTryon(data.slot) && Boolean(data.images[0]);

  const trust: Array<{ icon: IconName; label: string; hint: string }> = [
    { icon: 'authentic', label: t.product.trustOriginal, hint: t.product.trustOriginalHint },
    { icon: 'reset', label: t.product.trustReturn, hint: t.product.trustReturnHint },
    { icon: 'delivery', label: t.product.trustDelivery, hint: t.product.trustDeliveryHint },
  ];

  // Slot serverdan texnik nom bilan keladi («top») — foydalanuvchiga tarjimasi ko'rsatiladi
  const slotKey = data.slot ? SLOT_LABEL[data.slot] : undefined;
  const slotText = slotKey ? t.look[slotKey] : data.slot;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
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
                <Pressable
                  key={url}
                  accessibilityRole="button"
                  accessibilityLabel="Rasmni kattalashtirish"
                  onPress={() => setZoomedImage(url)}
                >
                  <Image source={{ uri: url }} style={styles.image} resizeMode="cover" />
                </Pressable>
              ))
            ) : (
              <View style={[styles.image, styles.imagePlaceholder]} />
            )}
          </ScrollView>

          {/*
            Atelier: status bar tagidagi fon — yorug' oq oqim bilan (dark
            overlay klişesi yo'q). Rasm yorug' bo'lsa status bar ikoni
            krem fonga qarshi o'qiladi, qora rasmda esa oq quti o'z-o'zidan
            yetarli ta'kid beradi.
          */}
          <LinearGradient
            colors={['rgba(255,255,255,0.75)', 'rgba(255,255,255,0.3)', CREAM_CLEAR]}
            locations={[0, 0.6, 1]}
            style={[styles.topFade, { height: insets.top + 80 }]}
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
                color={isFavorite ? colors.primary : colors.text}
                onPress={() => toggleFavorite.mutate(!isFavorite)}
              />
            </View>
          </View>

          {/* «Limited» — cheklangan seriya belgisi, pastki chap burchak. */}
          {data.isLimited ? (
            <View style={styles.premium}>
              <Icon name="premium" size={13} color={colors.primary} />
              <Text style={styles.premiumText}>{t.product.premium}</Text>
            </View>
          ) : null}

          {/* Nuqtalar — Atelier: ingichka dashlar */}
          {data.images.length > 1 ? (
            <View style={styles.dots}>
              {data.images.map((url, index) => (
                <View key={url} style={[styles.dot, index === imageIndex && styles.dotActive]} />
              ))}
            </View>
          ) : null}

          {/* Pastki chet — rasm krem fonga oqib tushadi, kesilgan chegara ko'rinmasin */}
          <LinearGradient
            colors={[CREAM_CLEAR, CREAM_SOLID]}
            style={styles.bottomFade}
            pointerEvents="none"
          />
        </View>

        {/* Kontent — rasmga biroz ustma-ust chiqadi; Atelier: kichik radius */}
        <View style={styles.body}>
          {/* Eyebrow — brand + slot (moda jurnali rukni) */}
          <View style={styles.eyebrowRow}>
            {data.brand?.name ? (
              <Text style={styles.brand}>{data.brand.name}</Text>
            ) : null}
            {slotText ? <Text style={styles.slot}>· {slotText}</Text> : null}
          </View>

          <View style={styles.headRow}>
            <View style={styles.headText}>
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
              <Icon name="shop" size={18} color={colors.primary} />
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

          {data.description ? (
            <>
              <View style={styles.rule} />
              <Text style={styles.description}>{data.description}</Text>
            </>
          ) : null}

          {data.variants.length > 1 ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>{t.product.color}</Text>
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

          <View style={styles.section}>
            <View style={styles.panelHead}>
              <Text style={styles.sectionLabel}>
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
                  <Text
                    style={[
                      styles.sizeCount,
                      size === item.size && styles.sizeCountActive,
                      !item.available && styles.sizeCountOut,
                    ]}
                  >
                    {item.available
                      ? t.product.stockCount.replace('{n}', String(item.stock))
                      : t.product.sizeSoldOut}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {cartError ? <Text style={styles.cartError}>{cartError}</Text> : null}

          {canTryOn && variant ? (() => {
            /*
             * Savatda AYNAN SHU RANG turibdimi.
             *
             * Bosh sahifadan qo'shilgan kiyimning rangi hali noma'lum —
             * u mahsulotning birinchi rangi deb hisoblanadi (primerka ham
             * shuni oladi). Boshqa rang tanlansa tugma yana «qo'shish»
             * bo'ladi: bosilganda savatdagi yozuv shu rangga almashadi,
             * ikkinchi nusxa qo'shilmaydi.
             */
            const inTray = lookItems.find((item) => matches(item, data.id));
            const inLook =
              inTray !== undefined &&
              (inTray.variantId === variant.id ||
                (inTray.variantId === null && variantIndex === 0));
            // Primerkani headerdagi va pastdagi AI tugmasi ochadi — u yerda
            // yig'ilgan kiyimlar birdaniga kiyib ko'riladi.
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={inLook ? t.tryon.removeFromLook : t.tryon.addToLook}
                accessibilityState={{ selected: inLook }}
                onPress={() => {
                  // Bosh sahifadagi karta bilan bir xil: qayta bosilsa olib tashlaydi
                  if (inLook) {
                    removeLook(data.id);
                    return;
                  }
                  addLook({
                    productId: data.id,
                    variantId: variant.id,
                    slot: data.slot,
                    title: data.title,
                    image: data.images[0] ?? null,
                    price: data.price,
                    currency: data.currency,
                  });
                }}
                style={({ pressed }) => [
                  styles.lookBtn,
                  inLook && { backgroundColor: colors.success },
                  pressed && !inLook && { backgroundColor: colors.primaryDim },
                ]}
              >
                <Icon
                  name={inLook ? 'check' : 'tryon'}
                  size={18}
                  color={colors.textOnPrimary}
                />
                <Text style={styles.lookBtnText}>
                  {inLook ? t.tryon.addedToLook : t.tryon.addToLook}
                </Text>
              </Pressable>
            );
          })() : null}

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

          {/* Trust — Atelier: hairline ustida tipografik qator */}
          <View style={styles.rule} />
          <View style={styles.trust}>
            {trust.map((item) => (
              <View key={item.label} style={styles.trustItem}>
                <Icon name={item.icon} size={16} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.trustText}>{item.label}</Text>
                  <Text style={styles.trustHint}>{item.hint}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/*
        Zoom modal — rasm ustiga bosilganda to'liq ekranga chiqadi.
        iOS ScrollView'ning tabiiy pinch-to-zoom'i orqali (maximumZoomScale),
        qo'shimcha kutubxonasiz. Fonda qora — rasm aniq ko'rinsin.
      */}
      <Modal
        visible={zoomedImage !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setZoomedImage(null)}
      >
        <View style={styles.zoomBackdrop}>
          <ScrollView
            style={StyleSheet.absoluteFill}
            contentContainerStyle={styles.zoomScroll}
            maximumZoomScale={4}
            minimumZoomScale={1}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            bouncesZoom
            centerContent
          >
            {zoomedImage ? (
              <Image source={{ uri: zoomedImage }} style={styles.zoomImage} resizeMode="contain" />
            ) : null}
          </ScrollView>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Yopish"
            onPress={() => setZoomedImage(null)}
            style={[styles.zoomClose, { top: insets.top + spacing.sm }]}
            hitSlop={12}
          >
            <Icon name="close" size={22} color="#FFFFFF" />
          </Pressable>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxl },

  hero: { position: 'relative' },
  image: { width: SCREEN_WIDTH, height: IMAGE_HEIGHT, backgroundColor: colors.surface2 },
  imagePlaceholder: { borderBottomWidth: 1, borderColor: colors.border },
  topFade: { position: 'absolute', left: 0, right: 0, top: 0 },
  bottomFade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 60 },

  heroBar: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroActions: { flexDirection: 'row', gap: spacing.sm },
  // Atelier: oq doira, ingichka chegara, ink ikonka. Dark overlay yo'q.
  roundButton: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderWidth: 1,
    borderColor: colors.border,
  },

  // Limited — Atelier: krem pill, anor matn
  premium: {
    position: 'absolute',
    left: spacing.md,
    bottom: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: 'rgba(247,242,234,0.94)',
  },
  premiumText: {
    ...text.eyebrow,
    color: colors.primary,
  },

  // Nuqtalar — ingichka dashlar, faol anor
  dots: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 36,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
  },
  dot: { width: 16, height: 2, backgroundColor: 'rgba(255,255,255,0.65)' },
  dotActive: { width: 28, backgroundColor: colors.primary, height: 3 },

  /*
   * ⚠️ MANFIY MARGIN — kontent rasmga biroz ustma-ust chiqadi.
   * Atelier: xxl radius o'rniga lg — toza, karta hissi emas.
   */
  body: {
    marginTop: -24,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    gap: spacing.md,
  },

  // Eyebrow qatori — brand + slot (moda jurnali rukni)
  eyebrowRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs },
  brand: { ...text.eyebrow, color: colors.primary },
  slot: { ...text.eyebrow, color: colors.textMuted },

  headRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  headText: { flex: 1, gap: spacing.sm },
  // Sarlavha — Fraunces hero (katta serif). Title tokeni h2 edi, bu yerda hero
  title: { ...text.h1, color: colors.text },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, marginTop: spacing.xs },
  // Narx — serif display, anor. "Moda jurnali tilini" eng muhim faktga beradi.
  price: { ...text.h2, color: colors.primary },
  oldPrice: { ...text.small, color: colors.textDim, textDecorationLine: 'line-through' },

  // Do'kon kartasi — Atelier: oq quti, hair-thin chegara
  storeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    maxWidth: '46%',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  storeText: { flexShrink: 1 },
  storeName: { ...text.small, color: colors.text, fontWeight: '600' },
  storeState: { ...text.eyebrow, color: colors.primary },

  // Soch-ingichka chiziq — Atelier bo'limlarni ajratadi
  rule: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xs },
  description: { ...text.body, color: colors.textMuted, lineHeight: 24 },

  // Panel o'rniga ochiq bo'lim — karta ko'rinishi emas. Atelier.
  section: { gap: spacing.sm, marginTop: spacing.xs },
  panelHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  sectionLabel: { ...text.eyebrow, color: colors.textMuted },
  panelHint: { ...text.eyebrow, color: colors.primary },

  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  colorDot: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.border,
  },
  colorDotActive: { borderColor: colors.primary },

  // Size chip — Atelier: oq quti, hair-thin. Faol holat anor fill + cream matn.
  sizeChip: {
    minWidth: 58,
    height: 54,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sizeChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  sizeChipDisabled: { opacity: 0.4 },
  sizeText: { ...text.bodyMed, color: colors.text },
  sizeTextActive: { color: colors.textOnPrimary },
  sizeCount: { ...text.tiny, color: colors.textDim, marginTop: 1 },
  sizeCountActive: { color: colors.textOnPrimary, opacity: 0.85 },
  sizeCountOut: { color: colors.danger },

  cartError: { ...text.small, color: colors.danger },

  actions: { flexDirection: 'row', alignItems: 'stretch', gap: spacing.sm },
  actionMain: { flex: 1 },
  askButton: {
    width: 60,
    borderRadius: radius.md,
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
  trustItem: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
  trustText: { ...text.eyebrow, color: colors.text },
  trustHint: { ...text.tiny, color: colors.textMuted, marginTop: 2 },

  // ── Zoom modal ──
  zoomBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.96)',
  },
  zoomScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * 1.4,
  },
  zoomClose: {
    position: 'absolute',
    right: spacing.md,
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },

  // "Lookga qo'shish" — Atelier: solid anor pill, gradient yo'q, glow yo'q
  lookBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  lookBtnText: { ...text.bodyMed, color: colors.textOnPrimary },
});
