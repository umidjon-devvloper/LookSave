import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { applyForStore, type StoreApplicationInput } from '../../src/api/endpoints';
import { ApiError, refreshSession } from '../../src/api/client';
import { SignInRequired } from '../../src/components/SignInRequired';
import { Button, Field, Screen } from '../../src/components/ui';
import { useAuthStore } from '../../src/store/authStore';
import { useLocationStore } from '../../src/store/locationStore';
import { colors, radius, spacing, text } from '../../src/theme/tokens';

/**
 * Do'kon arizasi — sotuvchi bo'lish.
 *
 * ⚠️ TASDIQLASH KUTILMAYDI. Ariza yuborilishi bilan foydalanuvchi
 * `store_owner` bo'ladi va panelga kira oladi. Do'kon esa `pending`
 * holatda qoladi, ya'ni katalogda KO'RINMAYDI. Shu bilan sotuvchi
 * kutish paytida mahsulotlarini tayyorlab qo'yadi va tasdiqlangan
 * kuni do'kon to'liq tayyor ishga tushadi.
 *
 * ⚠️ JOYLASHUV XARITADAN EMAS, QURILMADAN olinadi. Ariza bosqichida
 * xarita tanlagichi ortiqcha: manzil matn bilan yoziladi va aniq nuqta
 * keyinchalik panelda to'g'rilanadi. Xarita qo'shilsa ariza uzayadi va
 * ko'p sotuvchi shu yerda to'xtaydi.
 *
 * Kuniga 3 tadan ko'p ariza yuborib bo'lmaydi — server cheklaydi.
 */

interface FormState {
  name: string;
  description: string;
  phone: string;
  address: string;
  landmark: string;
  city: string;
}

const EMPTY: FormState = {
  name: '',
  description: '',
  phone: '+998',
  address: '',
  landmark: '',
  city: '',
};

export default function StoreApply(): JSX.Element {
  /*
   * ⚠️ Ildiz Stack bu bo'limda sarlavha chizmaydi (`headerShown: false`),
   * shuning uchun status paneli ostidagi bo'shliq QO'LDA qo'yiladi.
   * Aks holda sarlavha soat va batareya ustiga chiqib ketadi.
   */
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const signedIn = useAuthStore((state) => state.status) === 'signedIn';
  const refreshUser = useAuthStore((state) => state.restore);
  const coords = useLocationStore((state) => state.coords);

  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState<string | null>(null);

  const apply = useMutation({
    mutationFn: (input: StoreApplicationInput) => applyForStore(input),
    onSuccess: async () => {
      /*
       * ⚠️ TARTIB MUHIM: avval TOKEN, keyin profil.
       *
       * Rol va do'kon ro'yxati access token ichida yozilgan. Ariza
       * qabul qilingach bazada `store_owner` bo'ladi, lekin qo'ldagi
       * token hali `customer` deb turadi va panel so'rovlari 403
       * qaytaradi. Buni sinovda tekshirdim: ariza 200, dashboard 403.
       *
       * Tokenni yangilagach yangi rol ham, `storeIds` ham keladi.
       */
      await refreshSession();
      await refreshUser();
      await queryClient.invalidateQueries({ queryKey: ['profile'] });
      router.replace('/seller');
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'Ariza yuborilmadi');
    },
  });

  if (!signedIn) {
    return (
      <Screen>
        <SignInRequired hint="Do`kon ochish uchun avval akkaunt kerak." />
      </Screen>
    );
  }

  const set = (key: keyof FormState) => (value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = (): void => {
    setError(null);

    // Serverdagi sxemaga mos eng kam talablar — xatoni so'rovsiz ushlaymiz
    if (form.name.trim().length < 2) return setError('Do`kon nomini kiriting');
    if (!/^\+998\d{9}$/.test(form.phone.trim())) return setError('Telefon raqami to`liq emas');
    if (form.address.trim().length < 5) return setError('Manzilni to`liqroq yozing');
    if (form.city.trim().length < 2) return setError('Shaharni kiriting');

    apply.mutate({
      name: form.name.trim(),
      ...(form.description.trim() ? { description: form.description.trim() } : {}),
      phone: form.phone.trim(),
      address: form.address.trim(),
      ...(form.landmark.trim() ? { landmark: form.landmark.trim() } : {}),
      city: form.city.trim(),
      country: 'UZ',
      location: coords,
      currency: 'UZS',
      deliveryEnabled: true,
      pickupEnabled: true,
    });
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>Do`kon ochish</Text>
          <Text style={styles.lead}>
            Ariza yuborilgach panelga darhol kirasiz va mahsulotlaringizni tayyorlab qo`yasiz.
            Do`kon tasdiqlangandan keyin katalogda paydo bo`ladi.
          </Text>

          <View style={styles.form}>
            <Field
              label="Do`kon nomi"
              value={form.name}
              onChangeText={set('name')}
              placeholder="Chilonzor Fashion"
              autoCapitalize="words"
            />
            <Field
              label="Telefon"
              value={form.phone}
              onChangeText={set('phone')}
              keyboardType="phone-pad"
              placeholder="+998 90 123 45 67"
            />
            <Field
              label="Shahar"
              value={form.city}
              onChangeText={set('city')}
              placeholder="Toshkent"
              autoCapitalize="words"
            />
            <Field
              label="Manzil"
              value={form.address}
              onChangeText={set('address')}
              placeholder="Chilonzor 9-kvartal, 24-uy"
            />
            <Field
              label="Mo`ljal"
              value={form.landmark}
              onChangeText={set('landmark')}
              placeholder="Mehnat metrosi yonida"
            />
            <Field
              label="Qisqacha tavsif"
              value={form.description}
              onChangeText={set('description')}
              placeholder="Erkaklar va ayollar kiyimlari"
              multiline
            />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.note}>
            <Text style={styles.noteText}>
              Buyurtmalar ilovada keladi va shu yerda javob berasiz. Mahsulot qo`shish va analitika
              esa veb-panelda — u kompyuterda ancha qulay.
            </Text>
          </View>

          <Button title="Ariza yuborish" onPress={submit} loading={apply.isPending} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.sm },

  title: { ...text.h1, color: colors.text },
  lead: { ...text.small, color: colors.textMuted, marginBottom: spacing.md },

  form: { gap: 0 },

  error: { ...text.small, color: colors.danger, marginBottom: spacing.sm },

  note: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  noteText: { ...text.tiny, color: colors.textDim, lineHeight: 18 },
});
