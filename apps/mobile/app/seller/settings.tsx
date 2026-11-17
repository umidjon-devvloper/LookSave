import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import {
  getMyBrand,
  getStoreProfile,
  saveMyBrand,
  updateStoreProfile,
  uploadStoreImage,
  type StoreBrandInput,
  type WorkingHour,
} from '../../src/api/endpoints';
import { ApiError } from '../../src/api/client';
import { explainError } from '../../src/api/explainError';
import { Icon, type IconName } from '../../src/components/Icon';
import { Button, Empty, ErrorView, Field, Loading, Screen } from '../../src/components/ui';
import { useAuthStore } from '../../src/store/authStore';
import { useRouter } from 'expo-router';
import { useI18n, type Dictionary } from '../../src/i18n';
import { colors, radius, spacing, text } from '../../src/theme/tokens';
import { goBack } from '../../src/navigation/back';

const SETTINGS_GEAR = require('../../assets/seller-settings-gear-v1.png');

/**
 * Do'kon sozlamalari.
 *
 * Ish vaqti va yetkazish sozlamalari ham shu yerda tahrirlanadi — do'konchi
 * telefondan ishlaydi, veb-paneldan foydalanish kutilmaydi.
 */

const DAYS: { day: number; labelKey: keyof Dictionary['seller'] }[] = [
  { day: 1, labelKey: 'day1' },
  { day: 2, labelKey: 'day2' },
  { day: 3, labelKey: 'day3' },
  { day: 4, labelKey: 'day4' },
  { day: 5, labelKey: 'day5' },
  { day: 6, labelKey: 'day6' },
  { day: 7, labelKey: 'day7' },
];

function hoursToMap(hours: WorkingHour[]): Record<number, WorkingHour> {
  return Object.fromEntries(hours.map((hour) => [hour.day, hour]));
}

/**
 * "10:5" kabi qisqa yozuvni "10:05" ga aylantiradi va soat/daqiqa
 * chegarasidan tashqarini o'zgartiradi. Bo'sh qolsa `'00:00'` qaytaradi
 * — server bo'sh qatorni qabul qilmaydi.
 */
function normalizeTime(value: string): string {
  const digits = value
    .replace(/[^0-9]/g, '')
    .slice(0, 4)
    .padStart(4, '0');
  const hoursNum = Math.min(23, Number(digits.slice(0, 2)));
  const minutesNum = Math.min(59, Number(digits.slice(2, 4)));
  const pad = (n: number): string => n.toString().padStart(2, '0');
  return `${pad(hoursNum)}:${pad(minutesNum)}`;
}

/**
 * Yozayotganda ":" ni avtomatik qo'yadi: "1015" → "10:15". Foydalanuvchi
 * o'zi ":" tergan bo'lsa uni takrorlamaydi.
 */
function formatWhileTyping(value: string): string {
  const digits = value.replace(/[^0-9]/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

export default function StoreSettings(): JSX.Element {
  /*
   * ⚠️ Ildiz Stack bu bo'limda sarlavha chizmaydi (`headerShown: false`),
   * shuning uchun status paneli ostidagi bo'shliq QO'LDA qo'yiladi.
   * Aks holda sarlavha soat va batareya ustiga chiqib ketadi.
   */
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const t = useI18n((state) => state.t);

  const profile = useQuery({ queryKey: ['store', 'profile'], queryFn: getStoreProfile });

  const [form, setForm] = useState({
    name: '',
    phone: '',
    address: '',
    landmark: '',
    city: '',
    district: '',
    description: '',
    logoUrl: null as string | null,
  });
  const [hours, setHours] = useState<Record<number, WorkingHour>>({});
  const [delivery, setDelivery] = useState({
    enabled: false,
    pickup: true,
    radiusKm: '15',
    fee: '0',
    freeFrom: '' as string,
    nationwide: false,
  });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!profile.data) return;
    setForm({
      name: profile.data.name,
      phone: profile.data.phone,
      address: profile.data.address,
      landmark: profile.data.landmark ?? '',
      city: profile.data.city,
      district: profile.data.district ?? '',
      description: profile.data.description ?? '',
      logoUrl: profile.data.logoUrl,
    });
    setHours(hoursToMap(profile.data.workingHours ?? []));
    setDelivery({
      enabled: profile.data.delivery.enabled,
      pickup: profile.data.pickupEnabled,
      radiusKm: (profile.data.delivery.radiusM / 1000).toString(),
      fee: profile.data.delivery.fee,
      freeFrom: profile.data.delivery.freeFrom ?? '',
      nationwide: profile.data.nationwide,
    });
  }, [profile.data]);

  const pickLogo = async (): Promise<void> => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t.photo.permissionTitle, t.seller.logoPermBody);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;

    setUploading(true);
    setError(null);
    try {
      const url = await uploadStoreImage(result.assets[0].uri);
      setForm((prev) => ({ ...prev, logoUrl: url }));
      setSaved(false);
    } catch {
      setError(t.seller.logoUploadFailed);
    } finally {
      setUploading(false);
    }
  };

  const save = useMutation({
    mutationFn: () => {
      const workingHours = DAYS.map(({ day }) => {
        const hour = hours[day];
        return {
          day,
          open: normalizeTime(hour?.open ?? '10:00'),
          close: normalizeTime(hour?.close ?? '20:00'),
          closed: hour?.closed ?? false,
        };
      });

      const radiusM = Math.round(Math.max(0.5, Number(delivery.radiusKm) || 0) * 1000);
      const feeAmount = delivery.fee.trim() === '' ? '0' : delivery.fee.trim();
      const freeFromAmount = delivery.freeFrom.trim() === '' ? null : delivery.freeFrom.trim();

      return updateStoreProfile({
        name: form.name.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
        landmark: form.landmark.trim() || null,
        city: form.city.trim(),
        district: form.district.trim() || null,
        description: form.description.trim() || null,
        logoUrl: form.logoUrl,
        workingHours,
        deliveryEnabled: delivery.enabled,
        pickupEnabled: delivery.pickup,
        deliveryRadiusM: radiusM,
        deliveryFee: feeAmount,
        freeDeliveryFrom: freeFromAmount,
        nationwide: delivery.nationwide,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['store'] });
      setSaved(true);
      setError(null);
    },
    onError: (err) => setError(explainError(err, t)),
  });

  // ── Mening brendim (@username bilan) — do'kondan alohida yozuv, alohida saqlash ──
  const brand = useQuery({ queryKey: ['store', 'brand'], queryFn: getMyBrand });
  const [brandForm, setBrandForm] = useState({
    name: '',
    username: '',
    description: '',
    logoUrl: null as string | null,
  });
  const [brandUploading, setBrandUploading] = useState(false);
  const [brandSaved, setBrandSaved] = useState(false);
  const [brandError, setBrandError] = useState<string | null>(null);

  useEffect(() => {
    if (brand.data === undefined) return;
    setBrandForm({
      name: brand.data?.name ?? '',
      username: brand.data?.username ?? '',
      description: brand.data?.description ?? '',
      logoUrl: brand.data?.logoUrl ?? null,
    });
  }, [brand.data]);

  const setBrand = (key: keyof typeof brandForm) => (value: string) => {
    setBrandSaved(false);
    setBrandForm((current) => ({ ...current, [key]: value }));
  };

  const pickBrandLogo = async (): Promise<void> => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t.photo.permissionTitle, t.seller.logoPermBody);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;

    setBrandUploading(true);
    setBrandError(null);
    try {
      const url = await uploadStoreImage(result.assets[0].uri);
      setBrandForm((prev) => ({ ...prev, logoUrl: url }));
      setBrandSaved(false);
    } catch {
      setBrandError(t.seller.logoUploadFailed);
    } finally {
      setBrandUploading(false);
    }
  };

  const saveBrand = useMutation({
    mutationFn: (input: StoreBrandInput) => saveMyBrand(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['store', 'brand'] });
      setBrandSaved(true);
      setBrandError(null);
    },
    /*
     * Serverning o'z matni o'zbekcha — ekranga kod bo'yicha tarjima chiqadi.
     * `ALREADY_EXISTS` bu yerda yagona tushunarli sabab: @username yoki nom band.
     */
    onError: (err) =>
      setBrandError(
        err instanceof ApiError && err.code === 'ALREADY_EXISTS'
          ? t.seller.brandTaken
          : explainError(err, t),
      ),
  });

  const brandUsername = brandForm.username.trim().replace(/^@/, '').toLowerCase();
  const brandValid = brandForm.name.trim().length >= 2 && brandUsername.length >= 3;

  const role = useAuthStore((state) => state.user?.role);
  const isSeller = role === 'store_owner' || role === 'admin';
  const router = useRouter();

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

  if (profile.isLoading) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }
  if (profile.isError || !profile.data) {
    return (
      <Screen>
        <ErrorView error={profile.error} onRetry={() => void profile.refetch()} />
      </Screen>
    );
  }

  const store = profile.data;

  const set = (key: keyof typeof form) => (value: string) => {
    setSaved(false);
    setForm((current) => ({ ...current, [key]: value }));
  };

  const setHour = (day: number, patch: Partial<WorkingHour>): void => {
    setSaved(false);
    setHours((prev) => ({
      ...prev,
      [day]: {
        day,
        open: prev[day]?.open ?? '10:00',
        close: prev[day]?.close ?? '20:00',
        closed: prev[day]?.closed ?? false,
        ...patch,
      },
    }));
  };

  const setDeliveryField = <K extends keyof typeof delivery>(
    key: K,
    value: (typeof delivery)[K],
  ) => {
    setSaved(false);
    setDelivery((prev) => ({ ...prev, [key]: value }));
  };

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
            <Pressable style={styles.roundButton} onPress={() => goBack('/seller')}>
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
              <Text style={styles.heroTitle}>{t.seller.settingsTitle}</Text>
              <Text style={styles.heroSubtitle}>{t.seller.settingsSubtitle}</Text>
            </View>
            <Image source={SETTINGS_GEAR} style={styles.gearArt} resizeMode="contain" />
          </View>

          <View style={styles.statusCard}>
            <View style={styles.statusIcon}>
              <Icon name="shop" size={27} color={colors.success} />
            </View>
            <View style={styles.statusCardText}>
              <Text style={styles.statusLabel}>{t.seller.statusLabel}</Text>
              <Text style={styles.statusValue}>
                {store.status === 'active' ? t.seller.statusActiveFull : store.status}
              </Text>
            </View>
            <View
              style={[
                styles.statusBadge,
                store.status === 'active' ? styles.statusBadgeOn : styles.statusBadgeOff,
              ]}
            >
              <View
                style={[
                  styles.statusBadgeDot,
                  { backgroundColor: store.status === 'active' ? colors.success : colors.textDim },
                ]}
              />
              <Text
                style={[
                  styles.statusBadgeText,
                  { color: store.status === 'active' ? colors.success : colors.textMuted },
                ]}
              >
                {store.status === 'active' ? t.seller.statusActive : t.seller.statusInactive}
              </Text>
            </View>
            <Icon name="next" size={19} color={colors.text} />
          </View>

          <View style={styles.logoRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t.seller.pickLogo}
              onPress={() => void pickLogo()}
              disabled={uploading}
              style={styles.logoBox}
            >
              {uploading ? (
                <ActivityIndicator color={colors.accent} />
              ) : form.logoUrl ? (
                <Image source={{ uri: form.logoUrl }} style={styles.logoImage} resizeMode="cover" />
              ) : (
                <Icon name="shop" size={26} color={colors.textDim} />
              )}
            </Pressable>
            <View style={styles.logoCopy}>
              <Text style={styles.logoTitle}>{t.seller.logoLabel}</Text>
              <Text style={styles.logoHint}>{t.seller.logoPickHint}</Text>
            </View>
            <Pressable style={styles.logoPick} onPress={() => void pickLogo()} disabled={uploading}>
              <Icon name="compare" size={18} color={colors.primary} />
              <Text style={styles.logoPickText}>
                {form.logoUrl ? t.seller.changeLogo : t.seller.pickLogo}
              </Text>
            </Pressable>
          </View>

          <View style={styles.fieldsCard}>
            <SettingsField
              icon="shop"
              label={t.seller.fieldName}
              value={form.name}
              onChangeText={set('name')}
            />
            <SettingsField
              icon="phone"
              label={t.auth.phone}
              value={form.phone}
              onChangeText={set('phone')}
              keyboardType="phone-pad"
            />
            <SettingsField
              icon="chat"
              label={t.checkout.address}
              value={form.address}
              onChangeText={set('address')}
            />
            <SettingsField
              icon="locate"
              label={t.checkout.landmark}
              value={form.landmark}
              onChangeText={set('landmark')}
            />
            <SettingsField
              icon="stores"
              label={t.catalog.city}
              value={form.city}
              onChangeText={set('city')}
            />
            <SettingsField
              icon="location"
              label={t.catalog.district}
              value={form.district}
              onChangeText={set('district')}
            />
            <SettingsField
              icon="list"
              label={t.seller.descLabel}
              value={form.description}
              onChangeText={set('description')}
              multiline
            />
          </View>

          {/* Ish vaqti */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Icon name="clock" size={18} color={colors.accent} />
              <Text style={styles.sectionTitle}>{t.seller.workingHours}</Text>
            </View>
            <Text style={styles.sectionHint}>{t.seller.hoursHint}</Text>

            {DAYS.map(({ day, labelKey }) => {
              const hour = hours[day];
              const closed = hour?.closed ?? false;
              return (
                <View key={day} style={styles.hourRow}>
                  <Text style={styles.dayLabel}>{t.seller[labelKey]}</Text>
                  <TextInput
                    editable={!closed}
                    value={hour?.open ?? '10:00'}
                    onChangeText={(value) => setHour(day, { open: formatWhileTyping(value) })}
                    onBlur={() => setHour(day, { open: normalizeTime(hour?.open ?? '10:00') })}
                    keyboardType="number-pad"
                    maxLength={5}
                    placeholder="10:00"
                    placeholderTextColor={colors.textDim}
                    style={[styles.timeInput, closed && styles.timeInputDisabled]}
                  />
                  <Text style={styles.dash}>—</Text>
                  <TextInput
                    editable={!closed}
                    value={hour?.close ?? '20:00'}
                    onChangeText={(value) => setHour(day, { close: formatWhileTyping(value) })}
                    onBlur={() => setHour(day, { close: normalizeTime(hour?.close ?? '20:00') })}
                    keyboardType="number-pad"
                    maxLength={5}
                    placeholder="20:00"
                    placeholderTextColor={colors.textDim}
                    style={[styles.timeInput, closed && styles.timeInputDisabled]}
                  />
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: closed }}
                    onPress={() => setHour(day, { closed: !closed })}
                    hitSlop={6}
                    style={styles.dayOff}
                  >
                    <View style={[styles.checkbox, closed && styles.checkboxOn]}>
                      {closed ? <Text style={styles.checkboxMark}>✓</Text> : null}
                    </View>
                    <Text style={styles.dayOffLabel}>{t.seller.dayOff}</Text>
                  </Pressable>
                </View>
              );
            })}
          </View>

          {/* Yetkazib berish */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Icon name="delivery" size={18} color={colors.accent} />
              <Text style={styles.sectionTitle}>{t.cart.delivery}</Text>
            </View>

            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: delivery.enabled }}
              onPress={() => setDeliveryField('enabled', !delivery.enabled)}
              style={styles.toggleRow}
            >
              <View style={[styles.checkbox, delivery.enabled && styles.checkboxOn]}>
                {delivery.enabled ? <Text style={styles.checkboxMark}>✓</Text> : null}
              </View>
              <Text style={styles.toggleLabel}>{t.seller.deliverOn}</Text>
            </Pressable>

            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: delivery.pickup }}
              onPress={() => setDeliveryField('pickup', !delivery.pickup)}
              style={styles.toggleRow}
            >
              <View style={[styles.checkbox, delivery.pickup && styles.checkboxOn]}>
                {delivery.pickup ? <Text style={styles.checkboxMark}>✓</Text> : null}
              </View>
              <Text style={styles.toggleLabel}>{t.seller.pickupOn}</Text>
            </Pressable>

            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: delivery.nationwide }}
              onPress={() => setDeliveryField('nationwide', !delivery.nationwide)}
              style={styles.toggleRow}
            >
              <View style={[styles.checkbox, delivery.nationwide && styles.checkboxOn]}>
                {delivery.nationwide ? <Text style={styles.checkboxMark}>✓</Text> : null}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleLabel}>{t.seller.nationwide}</Text>
                <Text style={[styles.toggleLabel, { opacity: 0.6, fontSize: 12 }]}>
                  {t.seller.nationwideHint}
                </Text>
              </View>
            </Pressable>

            {delivery.enabled ? (
              <View style={styles.deliveryGrid}>
                <View style={styles.deliveryCell}>
                  <Text style={styles.fieldLabel}>{t.seller.radiusLabel}</Text>
                  <TextInput
                    value={delivery.radiusKm}
                    onChangeText={(value) =>
                      setDeliveryField('radiusKm', value.replace(/[^0-9.]/g, ''))
                    }
                    keyboardType="decimal-pad"
                    placeholder="15"
                    placeholderTextColor={colors.textDim}
                    style={styles.numericInput}
                  />
                </View>
                <View style={styles.deliveryCell}>
                  <Text style={styles.fieldLabel}>{t.seller.priceLabel}</Text>
                  <TextInput
                    value={delivery.fee}
                    onChangeText={(value) => setDeliveryField('fee', value)}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor={colors.textDim}
                    style={styles.numericInput}
                  />
                </View>
                <View style={styles.deliveryCell}>
                  <Text style={styles.fieldLabel}>{t.seller.freeThreshold}</Text>
                  <TextInput
                    value={delivery.freeFrom}
                    onChangeText={(value) => setDeliveryField('freeFrom', value)}
                    keyboardType="decimal-pad"
                    placeholder={t.seller.phNone}
                    placeholderTextColor={colors.textDim}
                    style={styles.numericInput}
                  />
                </View>
              </View>
            ) : null}
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {saved ? <Text style={styles.saved}>{t.measurements.saved}</Text> : null}

          <Pressable disabled={save.isPending} onPress={() => save.mutate()}>
            <LinearGradient colors={[colors.accent, colors.primaryDim]} style={styles.saveButton}>
              {save.isPending ? (
                <ActivityIndicator color={colors.textOnPrimary} />
              ) : (
                <>
                  <View style={styles.saveIcon}>
                    <Icon name="check" size={21} color={colors.textOnPrimary} />
                  </View>
                  <Text style={styles.saveText}>{t.measurements.save}</Text>
                </>
              )}
            </LinearGradient>
          </Pressable>

          {/* ── Mening brendim (@username bilan) — alohida saqlash ── */}
          <View style={styles.brandDivider} />
          <Text style={styles.brandTitle}>{t.seller.brandTitle}</Text>
          <Text style={styles.brandHint}>{t.seller.brandHint}</Text>

          <Text style={styles.fieldLabel}>{t.seller.brandLogoLabel}</Text>
          <View style={styles.logoRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t.seller.brandLogoLabel}
              onPress={() => void pickBrandLogo()}
              disabled={brandUploading}
              style={styles.logoBox}
            >
              {brandUploading ? (
                <ActivityIndicator color={colors.accent} />
              ) : brandForm.logoUrl ? (
                <Image
                  source={{ uri: brandForm.logoUrl }}
                  style={styles.logoImage}
                  resizeMode="cover"
                />
              ) : (
                <Icon name="shop" size={26} color={colors.textDim} />
              )}
            </Pressable>
            <View style={styles.logoActions}>
              <Button
                title={brandForm.logoUrl ? t.seller.changeLogo : t.seller.pickLogo}
                variant="ghost"
                loading={brandUploading}
                onPress={() => void pickBrandLogo()}
              />
            </View>
          </View>

          <Field label={t.seller.brandName} value={brandForm.name} onChangeText={setBrand('name')} />
          <Field
            label={t.auth.username}
            value={brandForm.username}
            onChangeText={setBrand('username')}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="@chilonzor_moda"
          />
          <Text style={styles.brandHint}>{t.seller.brandUsernameHint}</Text>
          <Field
            label={t.seller.brandDescription}
            value={brandForm.description}
            onChangeText={setBrand('description')}
            multiline
          />

          {brandError ? <Text style={styles.error}>{brandError}</Text> : null}
          {brandSaved ? (
            <Text style={styles.saved}>
              {t.seller.brandSaved.replace('{username}', brandUsername)}
            </Text>
          ) : null}

          <Button
            title={brand.data ? t.seller.brandSave : t.seller.brandCreate}
            loading={saveBrand.isPending}
            disabled={!brandValid}
            onPress={() =>
              saveBrand.mutate({
                name: brandForm.name.trim(),
                username: brandUsername,
                description: brandForm.description.trim() || null,
                logoUrl: brandForm.logoUrl,
              })
            }
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function SettingsField({
  icon,
  label,
  multiline,
  ...props
}: TextInputProps & { icon: IconName; label: string }): JSX.Element {
  return (
    <View style={[styles.settingsField, multiline && styles.settingsFieldMultiline]}>
      <View style={styles.settingsFieldLabel}>
        <Icon name={icon} size={18} color={colors.primary} />
        <Text style={styles.settingsFieldLabelText}>{label}</Text>
      </View>
      <TextInput
        {...props}
        multiline={multiline}
        placeholderTextColor={colors.textDim}
        style={[styles.settingsInput, multiline && styles.settingsInputMultiline]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: spacing.md, paddingBottom: 126 },
  topbar: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  roundButton: {
    width: 48,
    height: 48,
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
  wordmark: {
    ...text.bodyMed,
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  wordmarkAccent: { color: colors.accent },
  wordmarkSeller: { color: colors.textMuted, fontWeight: '600' },
  hero: { height: 132, justifyContent: 'center', overflow: 'visible' },
  heroCopy: { zIndex: 2, maxWidth: '64%' },
  heroTitle: { ...text.h1, color: colors.text, fontSize: 32, lineHeight: 38 },
  heroSubtitle: { ...text.body, color: colors.textMuted, marginTop: 4, fontSize: 16 },
  gearArt: { position: 'absolute', width: 150, height: 150, right: -2, top: -12 },

  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    backgroundColor: '#F1FFF8',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: '#C5F0D8',
    padding: 12,
    marginBottom: spacing.md,
    shadowColor: colors.success,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
  },
  statusIcon: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: '#D6F8E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusCardText: { flex: 1, gap: 2 },
  statusLabel: { ...text.small, color: colors.text, fontWeight: '700' },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  statusBadgeOn: { borderColor: 'rgba(34,197,94,0.35)', backgroundColor: 'rgba(34,197,94,0.1)' },
  statusBadgeOff: { borderColor: colors.border, backgroundColor: colors.surface2 },
  statusBadgeDot: { width: 6, height: 6, borderRadius: radius.pill },
  statusBadgeText: { ...text.small, fontWeight: '700' },
  fieldLabel: {
    ...text.tiny,
    color: colors.textDim,
    letterSpacing: 1,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderWidth: 1,
    borderColor: '#E8DDF7',
    borderRadius: radius.xl,
    padding: 10,
    shadowColor: '#6D28D9',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  logoBox: {
    width: 54,
    height: 54,
    borderRadius: radius.md,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoImage: { width: '100%', height: '100%' },
  logoCopy: { flex: 1, minWidth: 0 },
  logoTitle: { ...text.bodyMed, color: colors.text, fontWeight: '700' },
  logoHint: { ...text.small, color: colors.textMuted },
  logoPick: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: '#F3E9FF',
    borderWidth: 1,
    borderColor: '#DCC5FA',
  },
  logoPickText: { ...text.tiny, color: colors.primary, fontWeight: '700' },
  logoActions: { flex: 1, gap: spacing.xs },
  logoRemove: { ...text.small, color: colors.danger, paddingVertical: spacing.xs },
  statusValue: { ...text.bodyMed, color: colors.success, marginTop: 2 },
  fieldsCard: { marginBottom: spacing.sm },
  settingsField: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE8F7',
  },
  settingsFieldMultiline: { alignItems: 'flex-start', paddingVertical: 5 },
  settingsFieldLabel: { width: 112, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  settingsFieldLabelText: { ...text.small, color: colors.text, flexShrink: 1 },
  settingsInput: {
    flex: 1,
    minHeight: 38,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: '#DCCFF1',
    backgroundColor: 'rgba(255,255,255,0.82)',
    paddingHorizontal: 12,
    ...text.small,
    color: colors.text,
  },
  settingsInputMultiline: {
    minHeight: 54,
    borderRadius: radius.md,
    paddingTop: 9,
    textAlignVertical: 'top',
  },

  section: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: '#E5D9F5',
    shadowColor: '#6D28D9',
    shadowOpacity: 0.07,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sectionTitle: { ...text.h3, color: colors.text },
  sectionHint: {
    ...text.small,
    color: colors.textDim,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },

  hourRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  dayLabel: { ...text.small, color: colors.text, width: 78 },
  timeInput: {
    ...text.bodyMed,
    color: colors.text,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    width: 64,
    textAlign: 'center',
  },
  timeInputDisabled: { opacity: 0.4 },
  dash: { color: colors.textDim, paddingHorizontal: 2 },
  dayOff: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginLeft: 'auto' },
  dayOffLabel: { ...text.tiny, color: colors.textDim },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  toggleLabel: { ...text.bodyMed, color: colors.text },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkboxMark: { color: colors.textOnPrimary, fontSize: 12, lineHeight: 14, fontWeight: '700' },

  deliveryGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  deliveryCell: { flex: 1 },
  numericInput: {
    ...text.bodyMed,
    color: colors.text,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    textAlign: 'center',
  },
  saveButton: {
    height: 56,
    borderRadius: radius.pill,
    marginTop: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    shadowColor: colors.primary,
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 9 },
  },
  saveIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: { ...text.h3, color: colors.textOnPrimary },

  error: { ...text.small, color: colors.danger, marginTop: spacing.md, marginBottom: spacing.sm },
  saved: { ...text.small, color: colors.success, marginTop: spacing.md, marginBottom: spacing.sm },
  brandDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  brandTitle: { ...text.h3, color: colors.text, marginBottom: spacing.xs },
  brandHint: { ...text.small, color: colors.textDim, marginBottom: spacing.sm },
});
