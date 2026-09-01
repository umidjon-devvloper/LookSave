import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  createStoreProduct,
  getCategories,
  prepareGarmentImage,
  uploadStoreImage,
  type Category,
} from '../../src/api/endpoints';
import { ApiError } from '../../src/api/client';
import { Icon } from '../../src/components/Icon';
import { Button, Field, Screen } from '../../src/components/ui';
import { colors, radius, spacing, text } from '../../src/theme/tokens';
import { goBack } from '../../src/navigation/back';

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
const SIZE_PRESETS = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

const GENDERS: Array<{ key: 'male' | 'female' | 'unisex'; label: string }> = [
  { key: 'male', label: 'Erkak' },
  { key: 'female', label: 'Ayol' },
  { key: 'unisex', label: 'Uniseks' },
];

/** Daraxtdagi barcha kategoriyalarni yassi ro'yxatga aylantiradi. */
function flatten(list: Category[]): Category[] {
  return list.flatMap((item) => [item, ...flatten(item.children ?? [])]);
}

export default function NewProduct(): JSX.Element {
  /*
   * ⚠️ Ildiz Stack bu bo'limda sarlavha chizmaydi (`headerShown: false`),
   * shuning uchun status paneli ostidagi bo'shliq QO'LDA qo'yiladi.
   * Aks holda sarlavha soat va batareya ustiga chiqib ketadi.
   */
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'unisex'>('unisex');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [sizes, setSizes] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categories = useQuery({ queryKey: ['categories'], queryFn: getCategories });
  const options = flatten(categories.data ?? []).filter((item) => item.slot !== null);

  const create = useMutation({
    mutationFn: createStoreProduct,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['store', 'products'] });
      router.replace('/seller/products');
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Saqlanmadi'),
  });

  const pickImage = async (): Promise<void> => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Ruxsat kerak', 'Rasm tanlash uchun galereyaga ruxsat bering.');
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
       * ⚠️ FON OLIB TASHLANADI, LEKIN MAJBURAN EMAS.
       *
       * AI kiyintirish natijasi to'g'ridan-to'g'ri kiyim suratiga bog'liq:
       * ilgich, maneken yoki tartibsiz fon bo'lsa model ularni ham kiyimning
       * qismi deb qabul qiladi va natija buziladi.
       *
       * Lekin tanlovni DO'KONCHI qiladi — ba'zan asl surat yaxshiroq
       * chiqadi (masalan kiyim oq bo'lsa va fon bilan qo'shilib ketsa).
       * Avtomatik almashtirsak, u nima o'zgarganini bilmay qolardi.
       */
      let finalUrl = url;
      try {
        const prepared = await prepareGarmentImage(url);

        if (prepared.warning) {
          Alert.alert('Surat mos kelmasligi mumkin', prepared.warning, [
            { text: 'Baribir qo`shish', onPress: () => setImages((c) => [...c, url]) },
            { text: 'Bekor qilish', style: 'cancel' },
          ]);
          return;
        }

        finalUrl = await new Promise<string>((resolve) => {
          Alert.alert(
            'Fon olib tashlandi',
            'Kiyintirish uchun oq fonli variant yaxshiroq natija beradi. Qaysinisini qo`shamiz?',
            [
              { text: 'Tozalangani', onPress: () => resolve(prepared.cleanedUrl) },
              { text: 'Asl surat', onPress: () => resolve(url) },
            ],
          );
        });
      } catch {
        // Ishlov bermasa asl surat qoladi — yuklash bekor qilinmaydi
      }

      setImages((current) => [...current, finalUrl]);
    } catch {
      Alert.alert('Yuklanmadi', 'Rasmni yuklab bo`lmadi. Internetni tekshiring.');
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

    if (title.trim().length < 2) return setError('Mahsulot nomini kiriting');
    if (!categoryId) return setError('Kategoriyani tanlang');
    if (!/^\d+(\.\d{1,2})?$/.test(price.trim())) return setError('Narxni raqam bilan kiriting');

    const chosen = Object.entries(sizes);
    if (chosen.length === 0) return setError('Kamida bitta o`lcham tanlang');

    // Serverdagi qoida — moderatsiyaga kamida 3 rasm
    if (status === 'pending' && images.length < 3) {
      return setError('Tekshiruvga yuborish uchun kamida 3 ta rasm kerak');
    }

    create.mutate({
      title: title.trim(),
      ...(description.trim() ? { description: description.trim() } : {}),
      categoryId,
      gender,
      basePrice: Number(price).toFixed(2),
      images,
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

  return (
    <Screen>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Orqaga"
          hitSlop={10}
          onPress={() => goBack('/seller/products')}
          style={styles.back}
        >
          <Icon name="back" size={20} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Yangi mahsulot</Text>
        <View style={styles.back} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Rasmlar */}
          <Text style={styles.label}>Rasmlar</Text>
          <Text style={styles.hint}>Tekshiruvga yuborish uchun kamida 3 ta kerak</Text>
          <View style={styles.images}>
            {images.map((url, index) => (
              <View key={url} style={styles.imageWrap}>
                <Image source={{ uri: url }} style={styles.image} resizeMode="cover" />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Rasmni olib tashlash"
                  onPress={() => setImages((current) => current.filter((_, i) => i !== index))}
                  style={styles.imageRemove}
                >
                  <Icon name="close" size={12} color={colors.text} />
                </Pressable>
              </View>
            ))}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Rasm qo`shish"
              onPress={() => void pickImage()}
              disabled={uploading}
              style={styles.imageAdd}
            >
              <Icon name="camera" size={22} color={uploading ? colors.textDim : colors.accent} />
            </Pressable>
          </View>

          <Field label="Nomi" value={title} onChangeText={setTitle} placeholder="Oq futbolka" />
          <Field
            label="Narxi"
            value={price}
            onChangeText={(value) => setPrice(value.replace(/[^0-9.]/g, ''))}
            keyboardType="decimal-pad"
            placeholder="150000"
          />

          {/* Kategoriya */}
          <Text style={styles.label}>Kategoriya</Text>
          <View style={styles.chips}>
            {options.map((item) => (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                onPress={() => setCategoryId(item.id)}
                style={[styles.chip, categoryId === item.id && styles.chipActive]}
              >
                <Text style={[styles.chipText, categoryId === item.id && { color: colors.text }]}>
                  {item.name}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Jins */}
          <Text style={styles.label}>Kimga</Text>
          <View style={styles.chips}>
            {GENDERS.map((item) => (
              <Pressable
                key={item.key}
                accessibilityRole="button"
                onPress={() => setGender(item.key)}
                style={[styles.chip, gender === item.key && styles.chipActive]}
              >
                <Text style={[styles.chipText, gender === item.key && { color: colors.text }]}>
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* O'lchamlar */}
          <Text style={styles.label}>O`lchamlar va qoldiq</Text>
          <View style={styles.chips}>
            {SIZE_PRESETS.map((size) => (
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
                  <Field
                    value={sizes[size] ?? ''}
                    onChangeText={(value) =>
                      setSizes((current) => ({ ...current, [size]: value.replace(/[^0-9]/g, '') }))
                    }
                    keyboardType="number-pad"
                    placeholder="dona"
                  />
                </View>
              ))}
            </View>
          ) : null}

          <Field
            label="Tavsif"
            value={description}
            onChangeText={setDescription}
            placeholder="Mato, kelib chiqishi, parvarish"
            multiline
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.actions}>
            <Button
              title="Tekshiruvga yuborish"
              onPress={() => submit('pending')}
              loading={create.isPending}
            />
            <Button
              title="Qoralama sifatida saqlash"
              variant="ghost"
              onPress={() => submit('draft')}
              disabled={create.isPending}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
  },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...text.h3, color: colors.text, flex: 1, textAlign: 'center' },

  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.xs },

  label: { ...text.label, color: colors.textDim, marginTop: spacing.md },
  hint: { ...text.tiny, color: colors.textDim, marginBottom: spacing.xs },

  images: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  imageWrap: { position: 'relative' },
  image: { width: 84, height: 84, borderRadius: radius.md, backgroundColor: colors.surface2 },
  imageRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageAdd: {
    width: 84,
    height: 84,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { borderColor: colors.borderAccent, backgroundColor: colors.primarySoft },
  chipText: { ...text.small, color: colors.textMuted },

  stockList: { gap: 0, marginBottom: spacing.sm },
  stockRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stockSize: { ...text.bodyMed, color: colors.text, width: 44 },

  error: { ...text.small, color: colors.danger, marginBottom: spacing.sm },
  actions: { gap: spacing.sm, marginTop: spacing.md },
});
