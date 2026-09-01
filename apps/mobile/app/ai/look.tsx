import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError } from '../../src/api/client';
import {
  addToCart,
  createLook,
  getFullProfile,
  suggestLooks,
  type Garment,
  type SuggestedLook,
} from '../../src/api/endpoints';
import { Icon, type IconName } from '../../src/components/Icon';
import { SignInRequired } from '../../src/components/SignInRequired';
import { Button, Empty, ErrorView, Screen } from '../../src/components/ui';
import { recommendSize } from '../../src/sizing';
import { useAuthStore } from '../../src/store/authStore';
import { useAiFlowStore } from '../../src/store/aiFlowStore';
import { money } from '../../src/theme/format';
import { colors, radius, spacing, text } from '../../src/theme/tokens';
import { goBack } from '../../src/navigation/back';

/**
 * AI Designer — yasalgan komplektlar (deck 06-slayd).
 *
 * Foydalanuvchi tadbir, uslub va kayfiyatni `/ai` da tanlaydi, bu yerda
 * esa uchta to'liq komplektni ko'radi va yoqqanini saqlaydi yoki
 * to'lig'icha savatga soladi.
 *
 * ⚠️ TAKLIF BEPUL, KIYINTIRISH PULLIK. Komplekt katalog ustidagi tanlov
 * bilan yig'iladi (`api/src/tryon/suggest.ts`) — ekran ochilishi bilan
 * so'ralishi mumkin. Komplektni O'ZINGDA ko'rish esa alohida ish va u
 * kiyintirish ekranida, har buyum uchun alohida so'raladi.
 *
 * ⚠️ NEGA HAR BUYUM UCHUN RENDER YASALMAYDI. Beshta buyumli uchta
 * komplekt = o'n beshta AI chaqiruvi, foydalanuvchi hech narsa
 * tanlamasdan turib. Shuning uchun bu yerda mahsulot suratlari
 * ko'rsatiladi va kiyintirish tanlangandan keyin bo'ladi.
 */

/** Slot nomlari — deckdagi tartibda: ustki → tashqi → pastki → oyoq → aksessuar */
const SLOT_LABEL: Record<string, { label: string; icon: IconName }> = {
  top: { label: 'Ustki', icon: 'slotTop' },
  outer: { label: 'Kurtka', icon: 'slotOuter' },
  bottom: { label: 'Pastki', icon: 'slotBottom' },
  feet: { label: 'Oyoq kiyim', icon: 'slotFeet' },
  wrist: { label: 'Aksessuar', icon: 'premium' },
};

const { width: SCREEN } = Dimensions.get('window');
const CARD_GAP = spacing.md;

export default function AiLookScreen(): JSX.Element {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const signedIn = useAuthStore((state) => state.status) === 'signedIn';

  const occasion = useAiFlowStore((state) => state.occasion);
  const style = useAiFlowStore((state) => state.style);

  const [index, setIndex] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  const profile = useQuery({ queryKey: ['profile'], queryFn: getFullProfile, enabled: signedIn });

  const looks = useQuery({
    // Tadbir va uslub kalitda — o'zgarsa yangi komplektlar so'raladi
    queryKey: ['suggest', occasion, style],
    queryFn: () => suggestLooks({ occasion, style }),
    enabled: signedIn,
  });

  const save = useMutation({
    mutationFn: (look: SuggestedLook) =>
      createLook({
        name: `${occasion} · ${style}`,
        occasion,
        items: look.items.map((item) => ({
          slot: item.slot,
          variantId: item.variantId,
          size: pickSize(item, profile.data?.measurements) ?? undefined,
        })),
      }),
    onSuccess: () => {
      setNotice('Komplekt saqlandi');
      void queryClient.invalidateQueries({ queryKey: ['looks'] });
    },
    onError: (err) => setNotice(err instanceof ApiError ? err.message : 'Saqlanmadi'),
  });

  const buy = useMutation({
    mutationFn: async (look: SuggestedLook) => {
      /*
       * ⚠️ KETMA-KET, PARALLEL EMAS. Savat bir foydalanuvchi uchun bitta
       * qator to'plami va bir vaqtda yozilsa ombor bandligi noto'g'ri
       * hisoblanishi mumkin. Buyum kam (5 tagacha), sekinligi sezilmaydi.
       */
      for (const item of look.items) {
        const size = pickSize(item, profile.data?.measurements);
        if (!size) continue;
        await addToCart(item.variantId, size);
      }
    },
    onSuccess: () => {
      setNotice('Komplekt savatga qo`shildi');
      void queryClient.invalidateQueries({ queryKey: ['cart'] });
    },
    onError: (err) => setNotice(err instanceof ApiError ? err.message : 'Qo`shilmadi'),
  });

  if (!signedIn) {
    return (
      <Screen>
        <SignInRequired hint="AI komplekt sizning o`lchamlaringizga qarab yig`iladi." />
      </Screen>
    );
  }

  if (looks.isLoading) {
    return (
      <Screen>
        <View style={styles.loading}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.loadingText}>AI komplekt yig`moqda…</Text>
          <Text style={styles.loadingHint}>
            {occasion} · {style}
          </Text>
        </View>
      </Screen>
    );
  }

  if (looks.isError) {
    return (
      <Screen>
        <ErrorView message="Komplekt yasalmadi" onRetry={() => void looks.refetch()} />
      </Screen>
    );
  }

  const list = looks.data ?? [];

  if (list.length === 0) {
    return (
      <Screen>
        <Empty
          icon="looks"
          title="Bu tanlovga komplekt topilmadi"
          hint="Katalogda ustki va pastki kiyim yetarli emas. Boshqa tadbir yoki uslubni tanlab ko`ring."
          action={<Button title="Tanlovni o`zgartirish" onPress={() => goBack('/ai')} />}
        />
      </Screen>
    );
  }

  const current = list[Math.min(index, list.length - 1)];

  return (
    <Screen>
      <View style={[styles.header, { paddingTop: insets.top + spacing.xs }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Orqaga"
          hitSlop={10}
          onPress={() => goBack('/ai')}
          style={styles.headerButton}
        >
          <Icon name="back" size={20} color={colors.text} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>AI komplektlar</Text>
          <Text style={styles.headerHint}>
            {occasion} · {style}
          </Text>
        </View>
        <View style={styles.headerButton} />
      </View>

      {/*
        Komplektlar yonma-yon — svayp bilan almashadi.

        ⚠️ `pagingEnabled` KARTA KENGLIGIGA BOG'LIQ EMAS: `snapToInterval`
        ishlatiladi, chunki kartalar orasida bo'shliq bor va sahifa
        kengligi ekran kengligiga teng emas.
      */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={SCREEN - spacing.md * 2 + CARD_GAP}
        decelerationRate="fast"
        contentContainerStyle={styles.pager}
        onMomentumScrollEnd={(event) => {
          const page = Math.round(
            event.nativeEvent.contentOffset.x / (SCREEN - spacing.md * 2 + CARD_GAP),
          );
          setIndex(page);
          setNotice(null);
        }}
      >
        {list.map((look) => (
          <View key={look.key} style={styles.card}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.items}>
              {look.items.map((item) => (
                <LookRow key={item.variantId} item={item} />
              ))}
            </ScrollView>
          </View>
        ))}
      </ScrollView>

      {/* Nechanchi komplekt — nuqtalar */}
      {list.length > 1 ? (
        <View style={styles.dots}>
          {list.map((look, position) => (
            <View key={look.key} style={[styles.dot, position === index && styles.dotActive]} />
          ))}
        </View>
      ) : null}

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Komplekt narxi</Text>
          <Text style={styles.total}>{current ? money(current.total, current.currency) : '—'}</Text>
        </View>

        <Button
          title="Savatga qo`shish"
          loading={buy.isPending}
          onPress={() => current && buy.mutate(current)}
        />
        <Button
          title="Keyinga saqlash"
          variant="ghost"
          loading={save.isPending}
          onPress={() => current && save.mutate(current)}
        />
      </View>
    </Screen>
  );
}

/** Komplektdagi bitta buyum. */
function LookRow({ item }: { item: Garment }): JSX.Element {
  const meta = SLOT_LABEL[item.slot] ?? { label: item.slot, icon: 'looks' as IconName };

  return (
    <View style={styles.row}>
      <Image source={{ uri: item.image }} style={styles.thumb} resizeMode="cover" />

      <View style={styles.rowText}>
        <View style={styles.rowSlot}>
          <Icon name={meta.icon} size={13} color={colors.accent} />
          <Text style={styles.slotLabel}>{meta.label}</Text>
        </View>
        <Text style={styles.rowTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={styles.rowStore} numberOfLines={1}>
          {item.store.name}
        </Text>
      </View>

      <Text style={styles.rowPrice}>{money(item.price, item.currency)}</Text>
    </View>
  );
}

/**
 * Buyum uchun o'lcham tanlaydi.
 *
 * ⚠️ TAVSIYA OMBORDA BO'LMASA BIRINCHISI OLINADI. Aks holda komplekt
 * savatga qo'shilmay qolardi va foydalanuvchi sababini bilmasdi.
 */
function pickSize(item: Garment, measurements: Parameters<typeof recommendSize>[1] | undefined) {
  if (item.sizes.length === 0) return null;
  const recommended = measurements ? recommendSize(item.slot, measurements) : null;
  if (recommended && item.sizes.includes(recommended)) return recommended;
  return item.sizes[0] ?? null;
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm },
  headerButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1, alignItems: 'center' },
  headerTitle: { ...text.h3, color: colors.text },
  headerHint: { ...text.tiny, color: colors.accent },

  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  loadingText: { ...text.bodyMed, color: colors.text },
  loadingHint: { ...text.tiny, color: colors.accent },

  pager: { paddingHorizontal: spacing.md, gap: CARD_GAP },
  card: {
    width: SCREEN - spacing.md * 2,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  items: { padding: spacing.sm, gap: spacing.sm },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface2,
  },
  thumb: { width: 56, height: 72, borderRadius: radius.sm, backgroundColor: colors.surface3 },
  rowText: { flex: 1, gap: 2 },
  rowSlot: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  slotLabel: { ...text.tiny, color: colors.accent },
  rowTitle: { ...text.bodyMed, color: colors.text },
  rowStore: { ...text.tiny, color: colors.textDim },
  rowPrice: { ...text.small, color: colors.textMuted },

  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingVertical: spacing.md },
  dot: { width: 6, height: 6, borderRadius: radius.pill, backgroundColor: colors.border },
  dotActive: { backgroundColor: colors.accent, width: 18 },

  footer: { paddingHorizontal: spacing.md, gap: spacing.sm },
  totalRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  totalLabel: { ...text.small, color: colors.textMuted },
  total: { ...text.h3, color: colors.text },
  notice: { ...text.small, color: colors.accent, textAlign: 'center' },
});
