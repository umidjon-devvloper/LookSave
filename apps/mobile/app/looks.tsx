import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Alert, FlatList, Image, Pressable, Share, StyleSheet, Text, View } from 'react-native';

import {
  deleteLook,
  getLooks,
  shareLook,
  sharedLookUrl,
  type Look,
} from '../src/api/endpoints';
import { Empty, ErrorView, Screen } from '../src/components/ui';
import { SignInRequired } from '../src/components/SignInRequired';
import { SkeletonList } from '../src/components/Skeleton';
import { useI18n } from '../src/i18n';
import { useAiFlowStore } from '../src/store/aiFlowStore';
import { useAuthStore } from '../src/store/authStore';
import { money } from '../src/theme/format';
import { colors, radius, spacing, text } from '../src/theme/tokens';

const SLOT_LABEL: Record<string, string> = {
  head: 'Bosh',
  face: "Ko'zoynak",
  neck: 'Sharf',
  top: 'Ustki',
  outer: 'Kurtka',
  bottom: 'Pastki',
  feet: 'Oyoq',
  wrist: 'Soat',
  bag: 'Sumka',
};

/** Komplekt narxi — barcha mahsulotlar yig'indisi, tiyin aniqligida. */
function totalPrice(look: Look): { amount: string; currency: string } {
  const cents = look.items.reduce((sum, item) => sum + Math.round(Number(item.price) * 100), 0);
  return {
    amount: (cents / 100).toFixed(2),
    currency: look.items[0]?.currency ?? 'UZS',
  };
}

export default function Looks(): JSX.Element {
  const queryClient = useQueryClient();
  const router = useRouter();
  const t = useI18n((state) => state.t);
  const resetOutfit = useAiFlowStore((state) => state.resetOutfit);
  const wear = useAiFlowStore((state) => state.wear);
  const setLookFilter = useAiFlowStore((state) => state.setLookFilter);

  // Saqlangan lookni qayta kiyish — bir bosishda kiyintirish ekraniga.
  //
  // ⚠️ LOOK REJIMI (2026-11-05). Kiyintirish ochilganda faqat SHU LOOKDAGI
  // kiyimlar tasmada ko'rinadi — butun katalog yo'q. Foydalanuvchi uni
  // ko'rish uchun kirgan, boshqa narsalar chalg'itmaydi. "Boshqa kiyim
  // tanlash" bossa filtr tozalanadi va katalog ochiladi.
  //
  // Slot nomi category sifatida ishlatiladi: fitting ekrani barcha slot
  // nomlarini ham qabul qiladi (`CATEGORY_SLOT` fallback orqali), tabda
  // aniqrok mos kelmasligi mumkin, lekin avatarda to'liq ko'rinadi.
  const wearLook = (look: Look): void => {
    resetOutfit();
    look.items.forEach((piece) => {
      wear(piece.slot, piece.variantId);
    });
    setLookFilter(look.items.map((piece) => piece.variantId));
    router.push('/ai/fitting');
  };

  /*
   * ⚠️ QOROVUL BARCHA HOOKLARDAN KEYIN QAYTARADI, lekin holat SHU YERDA
   * o'qiladi: erta `return` hooklar tartibini buzadi va React qulaydi.
   */
  const signedIn = useAuthStore((state) => state.status) === 'signedIn';
  const looks = useQuery({ queryKey: ['looks'], queryFn: getLooks, enabled: signedIn });

  const remove = useMutation({
    mutationFn: deleteLook,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['looks'] });
    },
  });

  /*
   * ⚠️ AVVAL TASDIQ, KEYIN ULASHISH.
   *
   * Komplekt eskizi — foydalanuvchining AVATARI, ya'ni uning yuzi.
   * Havolani bilgan har kim ochadi, shuning uchun bu amal hech qachon
   * jimgina bajarilmaydi. Qaytarib olish `unshareLook` orqali.
   */
  const onShare = (look: Look): void => {
    Alert.alert(
      'Komplektni ulashish',
      'Havolani ochgan har kim bu komplektni va sizning avataringizni ko`radi. Ulashamizmi?',
      [
        { text: 'Bekor qilish', style: 'cancel' },
        {
          text: 'Ulashish',
          onPress: () => {
            void (async () => {
              try {
                await shareLook(look.id);
                await Share.share({
                  message: `${look.name ?? 'Mening komplektim'} — ${sharedLookUrl(look.id)}`,
                });
              } catch {
                Alert.alert('Ulashilmadi', 'Havolani tayyorlab bo`lmadi. Keyinroq urinib ko`ring.');
              }
            })();
          },
        },
      ],
    );
  };

  // Kirmagan foydalanuvchiga xato emas, sabab ko'rsatiladi
  if (!signedIn) {
    return (
      <Screen>
        <SignInRequired />
      </Screen>
    );
  }

  if (looks.isLoading) return <SkeletonList count={3} />;
  if (looks.isError) {
    return <ErrorView error={looks.error} onRetry={() => void looks.refetch()} />;
  }

  return (
    <Screen>
      <FlatList
        data={looks.data ?? []}
        keyExtractor={(look) => look.id}
        contentContainerStyle={styles.list}
        refreshing={looks.isFetching}
        onRefresh={() => void looks.refetch()}
        ListEmptyComponent={<Empty title={t.looks.emptyTitle} hint={t.looks.emptyHint} />}
        renderItem={({ item }) => {
          const total = totalPrice(item);

          return (
            <View style={styles.card}>
              <View style={styles.header}>
                <Pressable onPress={() => wearLook(item)} accessibilityRole="button">
                  {item.thumbnailUrl ? (
                    <Image source={{ uri: item.thumbnailUrl }} style={styles.thumb} />
                  ) : (
                    <View style={[styles.thumb, styles.thumbPlaceholder]} />
                  )}
                </Pressable>

                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.name ?? t.looks.unnamed}</Text>
                  <Text style={styles.meta}>
                    {item.items.length} {t.looks.pieces} ·{' '}
                    {new Date(item.createdAt).toLocaleDateString('uz-UZ')}
                  </Text>
                  <Text style={styles.total}>{money(total.amount, total.currency)}</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Komplektni qayta kiyib ko'rish"
                    onPress={() => wearLook(item)}
                    style={styles.wearBtn}
                  >
                    <Text style={styles.wearBtnText}>Qayta kiyib ko'r</Text>
                  </Pressable>
                </View>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Komplektni ulashish"
                  hitSlop={12}
                  onPress={() => onShare(item)}
                >
                  <Text style={styles.share}>Ulashish</Text>
                </Pressable>
                <Pressable
                  accessibilityLabel="Komplektni o'chirish"
                  hitSlop={12}
                  disabled={remove.isPending}
                  onPress={() => remove.mutate(item.id)}
                >
                  <Text style={styles.remove}>×</Text>
                </Pressable>
              </View>

              <View style={styles.items}>
                {item.items.map((piece) => (
                  <View key={`${piece.slot}-${piece.variantId}`} style={styles.item}>
                    <Text style={styles.slot}>{SLOT_LABEL[piece.slot] ?? piece.slot}</Text>
                    <Text style={styles.itemTitle} numberOfLines={1}>
                      {piece.title}
                      {piece.colorName ? ` · ${piece.colorName}` : ''}
                      {piece.size ? ` · ${piece.size}` : ''}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.md, gap: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  thumb: { width: 56, height: 72, borderRadius: radius.md, backgroundColor: colors.surface2 },
  thumbPlaceholder: { borderWidth: 1, borderColor: colors.border },
  name: { ...text.bodyMed, color: colors.text },
  meta: { ...text.small, color: colors.textDim },
  total: { ...text.bodyMed, color: colors.text, marginTop: 2 },
  share: { ...text.small, color: colors.accent },
  remove: { ...text.h3, color: colors.textDim, paddingHorizontal: spacing.sm },
  // Birlamchi harakat — binafsha chip, komplekt tez chaqiriladigan joy.
  wearBtn: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.borderAccent,
  },
  wearBtnText: { ...text.tiny, color: colors.text, fontWeight: '700' },
  items: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm, gap: 4 },
  item: { flexDirection: 'row', gap: spacing.sm },
  slot: { ...text.tiny, color: colors.textDim, width: 60 },
  itemTitle: { ...text.small, color: colors.textMuted, flex: 1 },
});
