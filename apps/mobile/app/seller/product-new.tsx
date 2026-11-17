import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GARMENT_STYLES, type GarmentStyle } from '@looksave/validation';

import {
  createStoreProduct,
  getCategories,
  getMyProduct,
  updateStoreProduct,
  uploadStoreImage,
  type Category,
} from '../../src/api/endpoints';
import { explainError } from '../../src/api/explainError';
import { Icon, type IconName } from '../../src/components/Icon';
import { Button, Empty, Screen } from '../../src/components/ui';
import { useI18n, type Dictionary } from '../../src/i18n';
import { useAuthStore } from '../../src/store/authStore';
import { colors, radius, spacing, text } from '../../src/theme/tokens';
import { goBack } from '../../src/navigation/back';

const SELLER_BAG = require('../../assets/seller-dashboard-bag-v2.png');

/**
 * Yangi mahsulot.
 *
 * ⚠️ IKKI XIL SAQLASH BOR VA ULAR BOSHQACHA TEKSHIRILADI:
 *
 *   `draft`   — qoralama. Rasm soni tekshirilmaydi, katalogda ko'rinmaydi.
 *               Sotuvchi ishni bo'lib-bo'lib qilishi mumkin.
 *   `pending` — moderatsiyaga yuboriladi. Server KAMIDA 3 RASM talab
 *               qiladi va bu talab shu yerda ham tekshiriladi, aks holda
 *               foydalanuvchi formani to'ldirib bo'lib xato olardi.
 *
 * ⚠️ O'LCHAMLAR OLDINDAN BERILGAN. Har o'lchamni qo'lda yozdirish uzoq va
 * xatoga moyil; sotuvchi faqat kerakligini belgilaydi va qoldiq kiritadi.
 */

/** Kiyim uchun standart o'lchamlar — eng ko'p ishlatiladigani. */
// Kiyim razmerlari (ustki/pastki/ustki qavat) — harf bilan.
const CLOTHING_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
// Oyoq kiyim razmerlari — SON bilan (EU), harf bilan EMAS (so'rovga ko'ra,
// 2026-11-16). `feet` slotli kategoriyada shu ro'yxat ko'rsatiladi.
const SHOE_SIZES = ['36', '37', '38', '39', '40', '41', '42', '43', '44', '45'];

const GENDERS: Array<'male' | 'female' | 'unisex'> = ['male', 'female'];

/** Daraxtdagi barcha kategoriyalarni yassi ro'yxatga aylantiradi. */
function flatten(list: Category[]): Category[] {
  return list.flatMap((item) => [item, ...flatten(item.children ?? [])]);
}

/**
 * Rasm uyachalari — tartib `GARMENT_ANGLE_ORDER` bilan AYNAN bir xil
 * bo'lishi shart (`packages/validation/src/store-products.ts`).
 * Kiyintirish burchakni shu indeks bo'yicha topadi.
 */
const IMAGE_SLOT_KEYS = ['slotFront', 'slotBack', 'slotSide'] as const satisfies ReadonlyArray<
  keyof Dictionary['seller']
>;

/** Slug bazada, ko'rinadigan nom i18n (`t.seller`) dan */
const STYLE_LABEL: Record<GarmentStyle, keyof Dictionary['seller']> = {
  casual: 'styleCasual',
  sport: 'styleSport',
  streetwear: 'styleStreetwear',
  classic: 'styleClassic',
  minimal: 'styleMinimal',
};

export default function NewProduct(): JSX.Element {
  /*
   * ⚠️ Ildiz Stack bu bo'limda sarlavha chizmaydi (`headerShown: false`),
   * shuning uchun status paneli ostidagi bo'shliq QO'LDA qo'yiladi.
   * Aks holda sarlavha soat va batareya ustiga chiqib ketadi.
   */
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const t = useI18n((state) => state.t);
  // Edit mode — `?id=xxx` orqali kelsa mahsulot ma'lumotlari oldindan to'ldiriladi.
  // id yo'q bo'lsa oddiy yangi mahsulot formasi.
  const { id: editId } = useLocalSearchParams<{ id?: string }>();
  const isEdit = Boolean(editId);
  // Admin ham do'kon yuritishi mumkin — `seller/settings` va `seller/orders` bilan bir xil shart
  const role = useAuthStore((state) => state.user?.role);
  const isSeller = role === 'store_owner' || role === 'admin';

  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'unisex'>('male');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [style, setStyle] = useState<GarmentStyle | null>(null);
  /*
   * ⚠️ FIXED-LENGTH, null-padded. Oldin `string[]` edi va `filter(Boolean)`
   * bo'sh slotlarni siqib tashlardi — natijada sotuvchi "Orqa" (indeks 1)
   * ni tanlasa, rasm indeks 0 ga ko'chib "Old" deb yorliqlanardi. Server
   * ham, UI ham noto'g'ri burchakni ko'rsatardi. Endi slot pozitsiyasi
   * saqlanadi; submit vaqtida siqib yuboriladi (gap bo'lsa xato).
   */
  const [images, setImages] = useState<(string | null)[]>([null, null, null]);
  const [sizes, setSizes] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categories = useQuery({ queryKey: ['categories'], queryFn: getCategories });
  const options = flatten(categories.data ?? []).filter((item) => item.slot !== null);

  // Tanlangan kategoriya slotiga qarab razmer ro'yxati: oyoq kiyim (`feet`)
  // → sonli EU, qolgani → harfli (XS–XXL).
  const selectedSlot = options.find((item) => item.id === categoryId)?.slot ?? null;
  const sizePresets = selectedSlot === 'feet' ? SHOE_SIZES : CLOTHING_SIZES;

  // Edit mode: mahsulotni serverdan olib, formadagi barcha maydonlarni to'ldiramiz
  const existing = useQuery({
    queryKey: ['store', 'product', editId],
    queryFn: () => getMyProduct(editId!),
    enabled: isEdit && isSeller,
  });
  useEffect(() => {
    if (!existing.data) return;
    const data = existing.data;
    setTitle(data.title);
    setPrice(data.price);
    setDescription(data.description ?? '');
    setGender(data.gender);
    setCategoryId(data.categoryId);
    // Styles are stored in tags array — pick the first known one
    const knownStyle = (data.tags ?? []).find((tag) =>
      (GARMENT_STYLES as readonly string[]).includes(tag),
    ) as GarmentStyle | undefined;
    setStyle(knownStyle ?? null);
    // Images: null-padded to 3 slots
    const padded: (string | null)[] = [null, null, null];
    data.images.slice(0, 3).forEach((url, idx) => {
      padded[idx] = url;
    });
    setImages(padded);
    // Sizes: variantlardan birinchisining o'lchamlari
    const firstVariant = data.variants[0];
    if (firstVariant) {
      const next: Record<string, string> = {};
      firstVariant.sizes.forEach((s) => {
        next[s.size] = String(s.stock);
      });
      setSizes(next);
    }
  }, [existing.data]);

  const create = useMutation({
    mutationFn: createStoreProduct,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['store', 'products'] });
      router.replace('/seller/products');
    },
    onError: (err) => setError(explainError(err, t)),
  });

  // Edit mode uchun — faqat asosiy maydonlar yangilanadi (variantlar/o'lchamlar
  // alohida `updateVariantStock` orqali). Shu bois formadagi size ro'yxati
  // edit holatida faqat ko'rsatma — qoldiq alohida ekrandan tahrirlanadi.
  const update = useMutation({
    mutationFn: (status: 'draft' | 'pending') => {
      const filledImages = images.filter((item): item is string => Boolean(item));
      return updateStoreProduct(editId!, {
        title: title.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
        categoryId: categoryId!,
        gender,
        basePrice: Number(price).toFixed(2),
        tags: style ? [style] : [],
        images: filledImages,
        status,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['store', 'products'] });
      await queryClient.invalidateQueries({ queryKey: ['store', 'product', editId] });
      router.replace('/seller/products');
    },
    onError: (err) => setError(explainError(err, t)),
  });

  /** Suratni AYNAN o'z slotiga qo'yadi — pozitsiyani SAQLAYDI (null-padded). */
  const putAt = (slot: number, url: string): void =>
    setImages((current) => {
      const next = [...current];
      next[slot] = url;
      return next;
    });

  /*
   * ⚠️ UYACHA INDEKSI UZATILADI — massiv oxiriga qo'shilmaydi.
   *
   * `images` tartibi MA'NOGA EGA: [0] old, [1] orqa, [2] yon
   * (`packages/validation` — `GARMENT_ANGLE_ORDER`). Kiyintirish burchak
   * bo'yicha shu tartibdan o'qiydi, shuning uchun surat qaysi uyachaga
   * tanlangan bo'lsa, o'sha o'ringa tushishi kerak.
   */
  const pickImage = async (slot: number): Promise<void> => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t.photo.permissionTitle, t.seller.imgPermBody);
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;

    setUploading(true);
    try {
      const url = await uploadStoreImage(result.assets[0].uri);

      /*
       * ⚠️ AI FON TOZALASH MAJBURIY EMAS. Ilgari har rasm uchun
       * `prepareGarmentImage` chaqirilib, sotuvchi uchun 5–15 sek kutish
       * va "Toza/Asl" dialogi chiqardi — bu product qo'shish jarayonini
       * sekinlashtirardi. Endi sotuvchi istalgan rasmni qo'yaveradi;
       * fon tozalash kerak bo'lsa, kelajakda alohida tugma orqali
       * ixtiyoriy ravishda ishga tushiriladi.
       */
      putAt(slot, url);
    } catch {
      Alert.alert(t.seller.uploadFailedTitle, t.seller.imgUploadFailedBody);
    } finally {
      setUploading(false);
    }
  };

  const toggleSize = (size: string): void =>
    setSizes((current) => {
      const next = { ...current };
      if (size in next) delete next[size];
      else next[size] = '1';
      return next;
    });

  const submit = (status: 'draft' | 'pending'): void => {
    setError(null);

    if (title.trim().length < 2) return setError(t.seller.errTitle);
    if (!categoryId) return setError(t.seller.errCategory);
    if (!/^\d+(\.\d{1,2})?$/.test(price.trim())) return setError(t.seller.errPrice);

    const chosen = Object.entries(sizes);
    if (chosen.length === 0) return setError(t.seller.errSize);

    /*
     * Slot pozitsiyasi ma'noga ega: [0] old, [1] orqa, [2] yon.
     * Oraliqda bo'sh slot bo'lsa (masalan: old va yon tanlangan, orqa yo'q)
     * — serverga yuborilsa, yon suratini orqa deb yorliqlab qo'yardi.
     * Gap bo'lsa to'xtatamiz va aniq xato ko'rsatamiz.
     */
    const firstEmpty = images.findIndex((item) => !item);
    const lastFilled = images.reduce((max, item, i) => (item ? i : max), -1);
    if (firstEmpty !== -1 && lastFilled > firstEmpty) {
      return setError(t.seller.err3Images);
    }
    const filledImages = images.filter((item): item is string => Boolean(item));

    // Nashr qilish uchun kamida bitta rasm (odatda old tomon) kerak.
    // Orqa va yon ixtiyoriy: bo'lmasa AI kiyintirish barcha burchak uchun
    // oldi suratini ishlatadi.
    if (status === 'pending' && filledImages.length < 1) {
      return setError(t.seller.err3Images);
    }

    // Edit mode: variantlar alohida tahrirlanadi, bu yerda faqat asosiy maydon
    if (isEdit) {
      update.mutate(status);
      return;
    }

    create.mutate({
      title: title.trim(),
      ...(description.trim() ? { description: description.trim() } : {}),
      categoryId,
      gender,
      /*
       * ⚠️ USLUB `tags` GA TUSHADI, alohida ustunga emas.
       *
       * Massiv allaqachon bor va erkin — do'kon o'z belgilarini ham
       * qo'shishi mumkin. Kiyintirishdagi uslub filtri kesishma bilan
       * ishlaydi, shuning uchun qo'shimcha belgilar unga xalaqit bermaydi.
       */
      tags: style ? [style] : [],
      basePrice: Number(price).toFixed(2),
      images: filledImages,
      status,
      variants: [
        {
          sizes: chosen.map(([size, stock]) => ({
            size,
            stock: Math.max(0, Number.parseInt(stock, 10) || 0),
          })),
        },
      ],
    });
  };

  /*
   * Do'koni yo'q odamga forma emas, ariza taklifi — boshqa sotuvchi
   * ekranlaridagidek. Ilgari bu ekran havola orqali xaridorga ham ochilardi:
   * forma to'ldirilardi, yuborilganda esa server rad etardi.
   * ⚠️ Shart barcha hooklardan KEYIN turadi — hooklar tartibi buzilmasin.
   */
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
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topbar}>
            <Pressable style={styles.roundButton} onPress={() => goBack('/seller/products')}>
              <Icon name="back" size={25} color={colors.text} />
            </Pressable>
            <Text style={styles.wordmark} numberOfLines={1}>
              LOOK<Text style={styles.wordmarkAccent}>SAVE</Text>
              <Text style={styles.wordmarkSeller}> · SELLER</Text>
            </Text>
            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.hero}>
            <View style={styles.heroCopy}>
              <Text style={styles.heroTitle}>
                {isEdit ? t.seller.editTitle : t.seller.newTitle}
              </Text>
              <Text style={styles.heroSubtitle}>
                {isEdit ? t.seller.editSubtitle : t.seller.newSubtitle}
              </Text>
            </View>
            <View style={styles.heroBagWrap}>
              <Image source={SELLER_BAG} style={styles.heroBag} resizeMode="contain" />
              <View style={styles.heroPlus}>
                <Text style={styles.heroPlusText}>+</Text>
              </View>
            </View>
          </View>

          {/* Rasmlar */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHead}>
              <Icon name="compare" size={22} color={colors.primary} />
              <View style={styles.sectionHeadCopy}>
                <Text style={styles.sectionTitle}>{t.seller.imagesLabel}</Text>
                <Text style={styles.hint}>{t.seller.imagesHint}</Text>
              </View>
            </View>
            {/*
            ⚠️ UCHTA BELGILANGAN UYACHA, umumiy gallereya EMAS.

            Ilgari oddiy massiv edi: sotuvchi uchta rasm qo'yardi, lekin
            qaysi biri qaysi tomon ekani noma'lum qolardi. Natijada odam
            yon tomonga burilganda modelga baribir OLD surat berilardi va
            u yon ko'rinishni o'zidan o'ylab topardi.

            Tartib `GARMENT_ANGLE_ORDER` bilan bir xil: old, orqa, yon.
          */}
            <View style={styles.images}>
              {IMAGE_SLOT_KEYS.map((slotKey, index) => {
                const url = images[index];
                const slotLabel = t.seller[slotKey];
                return (
                  <View key={slotKey} style={styles.imageWrap}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={slotLabel}
                      onPress={() => void pickImage(index)}
                      disabled={uploading}
                      style={styles.imageAdd}
                    >
                      {url ? (
                        <Image source={{ uri: url }} style={styles.image} resizeMode="cover" />
                      ) : (
                        <Icon
                          name="camera"
                          size={22}
                          color={uploading ? colors.textDim : colors.accent}
                        />
                      )}
                    </Pressable>

                    {url ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={slotLabel}
                        onPress={() =>
                          setImages((current) => {
                            const next = [...current];
                            next[index] = null;
                            return next;
                          })
                        }
                        style={styles.imageRemove}
                      >
                        <Icon name="close" size={12} color={colors.text} />
                      </Pressable>
                    ) : null}

                    <Text style={styles.slotLabel}>{slotLabel}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          <ProductField
            icon="limited"
            label={t.seller.nameLabel}
            value={title}
            onChangeText={setTitle}
            placeholder={t.seller.phProductName}
          />
          <ProductField
            icon="orders"
            label={t.seller.priceField}
            value={price}
            onChangeText={(value) => setPrice(value.replace(/[^0-9.]/g, ''))}
            keyboardType="decimal-pad"
            placeholder="150000"
          />

          {/* Kategoriya */}
          <View style={styles.sectionCard}>
            <View style={styles.inlineTitle}>
              <Icon name="looks" size={22} color={colors.primary} />
              <Text style={styles.sectionTitle}>{t.seller.categoryLabel}</Text>
            </View>
            <View style={styles.chips}>
              {options.map((item) => (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  onPress={() => {
                    // Oyoq kiyim ↔ kiyim orasida almashsa, razmer turi
                    // o'zgaradi (son ↔ harf) — eski tanlovni tozalaymiz.
                    if ((item.slot === 'feet') !== (selectedSlot === 'feet')) setSizes({});
                    setCategoryId(item.id);
                  }}
                  style={[styles.chip, categoryId === item.id && styles.chipActive]}
                >
                  <Text style={[styles.chipText, categoryId === item.id && { color: colors.text }]}>
                    {item.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Jins */}
          <View style={styles.sectionCard}>
            <View style={styles.inlineTitle}>
              <Icon name="profile" size={22} color={colors.primary} />
              <Text style={styles.sectionTitle}>{t.seller.genderLabel}</Text>
            </View>
            <View style={styles.chips}>
              {GENDERS.map((key) => {
                const label =
                  key === 'male'
                    ? t.avatar.male
                    : key === 'female'
                      ? t.avatar.female
                      : t.seller.unisex;
                return (
                  <Pressable
                    key={key}
                    accessibilityRole="button"
                    onPress={() => setGender(key)}
                    style={[styles.chip, gender === key && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, gender === key && { color: colors.text }]}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Uslub */}
          <View style={styles.sectionCard}>
            <View style={styles.inlineTitle}>
              <Icon name="logo" size={22} color={colors.primary} />
              <View>
                <Text style={styles.sectionTitle}>{t.ai.styleLabel}</Text>
                <Text style={styles.hint}>{t.seller.styleHint}</Text>
              </View>
            </View>
            <View style={styles.chips}>
              {GARMENT_STYLES.map((item) => (
                <Pressable
                  key={item}
                  accessibilityRole="button"
                  // Qayta bosilsa bekor bo'ladi — uslub majburiy emas
                  onPress={() => setStyle((current) => (current === item ? null : item))}
                  style={[styles.chip, style === item && styles.chipActive]}
                >
                  <Text style={[styles.chipText, style === item && { color: colors.text }]}>
                    {t.seller[STYLE_LABEL[item]]}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* O'lchamlar */}
          <View style={styles.sectionCard}>
            <View style={styles.inlineTitle}>
              <Icon name="slotTop" size={22} color={colors.primary} />
              <Text style={styles.sectionTitle}>{t.seller.sizesLabel}</Text>
            </View>
            <View style={styles.chips}>
              {sizePresets.map((size) => (
                <Pressable
                  key={size}
                  accessibilityRole="button"
                  onPress={() => toggleSize(size)}
                  style={[styles.chip, size in sizes && styles.chipActive]}
                >
                  <Text style={[styles.chipText, size in sizes && { color: colors.text }]}>
                    {size}
                  </Text>
                </Pressable>
              ))}
            </View>

            {Object.keys(sizes).length > 0 ? (
              <View style={styles.stockList}>
                {Object.keys(sizes).map((size) => (
                  <View key={size} style={styles.stockRow}>
                    <Text style={styles.stockSize}>{size}</Text>
                    <TextInput
                      value={sizes[size] ?? ''}
                      onChangeText={(value) =>
                        setSizes((current) => ({
                          ...current,
                          [size]: value.replace(/[^0-9]/g, ''),
                        }))
                      }
                      keyboardType="number-pad"
                      placeholder={t.seller.phPcs}
                      placeholderTextColor={colors.textDim}
                      style={styles.stockInput}
                    />
                  </View>
                ))}
              </View>
            ) : null}
          </View>

          <ProductField
            icon="list"
            label={t.seller.descLabel}
            value={description}
            onChangeText={setDescription}
            placeholder={t.seller.phDescDetail}
            multiline
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.actions}>
            <Pressable
              disabled={create.isPending || update.isPending}
              onPress={() => submit('pending')}
            >
              <LinearGradient
                colors={[colors.accent, colors.primaryDim]}
                style={styles.submitButton}
              >
                <View style={styles.submitIcon}>
                  <Text style={styles.submitIconText}>+</Text>
                </View>
                <Text style={styles.submitText}>
                  {isEdit ? t.measurements.save : t.seller.submitReview}
                </Text>
              </LinearGradient>
            </Pressable>
            <Pressable
              disabled={create.isPending || update.isPending}
              onPress={() => submit('draft')}
              style={styles.draftButton}
            >
              <Text style={styles.draftText}>{t.seller.saveDraft}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function ProductField({
  icon,
  label,
  multiline,
  ...props
}: TextInputProps & { icon: IconName; label: string }): JSX.Element {
  return (
    <View style={styles.fieldCard}>
      <View style={styles.inlineTitle}>
        <Icon name={icon} size={22} color={colors.primary} />
        <Text style={styles.sectionTitle}>{label}</Text>
      </View>
      <TextInput
        {...props}
        multiline={multiline}
        placeholderTextColor={colors.textDim}
        style={[styles.fieldInput, multiline && styles.fieldInputMultiline]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: spacing.md, paddingBottom: 126, gap: 12 },
  topbar: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  roundButton: {
    width: 46,
    height: 46,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1,
    borderColor: '#E8DFF7',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6D28D9',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  headerSpacer: { width: 46 },
  wordmark: {
    ...text.bodyMed,
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  wordmarkAccent: { color: colors.accent },
  wordmarkSeller: { color: colors.textMuted, fontWeight: '600' },
  hero: { height: 128, justifyContent: 'center', overflow: 'hidden' },
  heroCopy: { zIndex: 2, maxWidth: '65%' },
  heroTitle: { ...text.h1, color: colors.text, fontSize: 31, lineHeight: 37 },
  heroSubtitle: { ...text.body, color: colors.textMuted, marginTop: 3 },
  heroBagWrap: { position: 'absolute', right: -4, top: -12, width: 145, height: 145 },
  heroBag: { width: 145, height: 145 },
  heroPlus: {
    position: 'absolute',
    right: 28,
    top: 50,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: '#DDBBFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroPlusText: { color: colors.textOnPrimary, fontSize: 30, lineHeight: 31 },
  sectionCard: {
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderWidth: 1,
    borderColor: '#E5D8F6',
    borderRadius: radius.xl,
    padding: spacing.md,
    shadowColor: '#6D28D9',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
  },
  fieldCard: {
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderWidth: 1,
    borderColor: '#E5D8F6',
    borderRadius: radius.xl,
    padding: 12,
    shadowColor: '#6D28D9',
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: 12,
  },
  sectionHeadCopy: { flex: 1 },
  inlineTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  sectionTitle: { ...text.h3, color: colors.text, fontWeight: '700' },
  hint: { ...text.tiny, color: colors.textMuted, marginTop: 2 },
  fieldInput: {
    minHeight: 44,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#DCCEF0',
    backgroundColor: 'rgba(255,255,255,0.85)',
    paddingHorizontal: 13,
    ...text.body,
    color: colors.text,
  },
  fieldInputMultiline: {
    minHeight: 66,
    borderRadius: radius.md,
    paddingTop: 10,
    textAlignVertical: 'top',
  },

  images: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  imageWrap: { position: 'relative', alignItems: 'center', gap: spacing.xs },
  slotLabel: { ...text.small, color: colors.text },
  image: { width: 90, height: 92, borderRadius: radius.lg, backgroundColor: colors.surface2 },
  imageRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageAdd: {
    width: 90,
    height: 92,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: {
    minWidth: 66,
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: '#DCCEF0',
    alignItems: 'center',
  },
  chipActive: { borderColor: colors.primary, backgroundColor: '#F0E3FF' },
  chipText: { ...text.small, color: colors.textMuted },

  stockList: { gap: 0, marginBottom: spacing.sm },
  stockRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  stockSize: { ...text.bodyMed, color: colors.text, width: 44 },
  stockInput: {
    width: 92,
    height: 42,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#DCCEF0',
    backgroundColor: colors.surface2,
    textAlign: 'center',
    ...text.bodyMed,
    color: colors.text,
  },

  error: { ...text.small, color: colors.danger, marginBottom: spacing.sm },
  actions: { gap: spacing.sm, marginTop: spacing.md },
  submitButton: {
    height: 58,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    shadowColor: colors.primary,
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 9 },
  },
  submitIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitIconText: { color: colors.textOnPrimary, fontSize: 27, lineHeight: 29 },
  submitText: { ...text.h3, color: colors.textOnPrimary },
  draftButton: { height: 44, alignItems: 'center', justifyContent: 'center' },
  draftText: { ...text.bodyMed, color: colors.primary },
});
