import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, FlatList, Image, Pressable, Share, StyleSheet, Text, View } from 'react-native';

import {
  deleteLook,
  getLooks,
  shareLook,
  sharedLookUrl,
  supportsAiTryon,
  type Look,
} from '../src/api/endpoints';
import { Button, Empty, ErrorView, Screen } from '../src/components/ui';
import { SignInRequired } from '../src/components/SignInRequired';
import { SkeletonList } from '../src/components/Skeleton';
import { useI18n, type Dictionary } from '../src/i18n';
import { useAuthStore } from '../src/store/authStore';
import { useLookStore } from '../src/store/lookStore';
import { money, shortDate } from '../src/theme/format';
import { colors, radius, spacing, text } from '../src/theme/tokens';

/** Slot nomi qurilma tilida; notanish slot xom ko'rinishda qoladi. */
function slotLabel(t: Dictionary, slot: string): string {
  switch (slot) {
    case 'head':
      return t.looks.slotHead;
    case 'face':
      return t.looks.slotFace;
    case 'neck':
      return t.looks.slotNeck;
    case 'top':
      return t.look.slotTop;
    case 'outer':
      return t.look.slotOuter;
    case 'bottom':
      return t.look.slotBottom;
    case 'feet':
      return t.look.slotFeet;
    case 'wrist':
      return t.looks.slotWatch;
    case 'bag':
      return t.looks.slotBag;
    default:
      return slot;
  }
}

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
  const locale = useI18n((state) => state.locale);
  const wearOnly = useLookStore((state) => state.wearOnly);

  // Ko'p tanlash — bir nechta Look'ni birga kiyintirish uchun (2026-11-05).
  // Set null bo'lsa — tanlov rejimi o'chik, bitta Look bossang darhol ochiladi.
  // Bo'sh Set bo'lsa — rejim yoqilgan, hali hech narsa tanlanmagan.
  const [selected, setSelected] = useState<Set<string> | null>(null);

  /**
   * Bir nechta Look'ni birga kiyintirish: hamma kiyimlar bitta komplektga
   * yig'iladi. Bir slotga ikki Look'da narsa bo'lsa — keyingi Look yutadi
   * (ro'yxatdagi tartibda, pastdan yuqoriga).
   */
  const wearLooks = (chosen: Look[]): void => {
    /*
     * Komplekt kiyimlari «Look» savatiga tushadi va yoqiladi; savatdagi
     * qolgan kiyimlar o'chadi, lekin yo'qolmaydi. Primerka ekrani ularni
     * bitta so'rov bilan kiyintiradi.
     *
     * ⚠️ FAQAT AI KIYDIRA OLADIGANLARI. Komplektda soat yoki sumka bo'lishi
     * mumkin — ular kiyib ko'rilmaydi, savatda esa bosib bo'lmaydigan
     * karta bo'lib turardi.
     */
    wearOnly(
      chosen.flatMap((look) =>
        look.items
          .filter((piece) => supportsAiTryon(piece.slot))
          .map((piece) => ({
            productId: null,
            variantId: piece.variantId,
            slot: piece.slot,
            title: piece.title,
            price: piece.price,
            currency: piece.currency,
          })),
      ),
    );
    setSelected(null);
    router.push('/ai/fitting');
  };

  // Bitta Look (eski oqim)
  const wearLook = (look: Look): void => wearLooks([look]);

  const toggleSelect = (id: string): void => {
    setSelected((prev) => {
      const next = new Set(prev ?? []);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
      t.looks.shareTitle,
      t.looks.shareConfirm,
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.looks.share,
          onPress: () => {
            void (async () => {
              try {
                await shareLook(look.id);
                await Share.share({
                  message: `${look.name ?? t.looks.myLook} — ${sharedLookUrl(look.id)}`,
                });
              } catch {
                Alert.alert(t.looks.shareFailedTitle, t.looks.shareFailedBody);
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

  const allLooks = looks.data ?? [];
  const selectedList = selected ? allLooks.filter((l) => selected.has(l.id)) : [];
  const selectionMode = selected !== null;

  return (
    <Screen>
      <FlatList
        data={allLooks}
        keyExtractor={(look) => look.id}
        contentContainerStyle={[
          styles.list,
          selectedList.length > 0 ? styles.listWithBar : null,
        ]}
        refreshing={looks.isFetching}
        onRefresh={() => void looks.refetch()}
        ListEmptyComponent={
          <Empty
            title={t.looks.emptyTitle}
            hint={t.looks.emptyHint}
            icon="looks"
            action={
              <Button
                title={t.marketplace.title}
                onPress={() => router.push('/(tabs)/marketplace')}
              />
            }
          />
        }
        renderItem={({ item }) => {
          const total = totalPrice(item);
          const isSelected = selected?.has(item.id) ?? false;

          // Tanlov rejimida butun karta tanlash/olib tashlashni almashtiradi.
          // Oddiy rejimda rasm/tugma bitta Look'ni darhol ochadi.
          const cardPress = selectionMode ? () => toggleSelect(item.id) : undefined;

          return (
            <Pressable
              style={[styles.card, isSelected && styles.cardSelected]}
              onPress={cardPress}
              onLongPress={() => {
                if (!selectionMode) setSelected(new Set([item.id]));
              }}
            >
              <View style={styles.header}>
                <Pressable
                  onPress={() => (selectionMode ? toggleSelect(item.id) : wearLook(item))}
                  accessibilityRole="button"
                >
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
                    {shortDate(item.createdAt, locale)}
                  </Text>
                  <Text style={styles.total}>{money(total.amount, total.currency)}</Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t.looks.wearAgain}
                      onPress={() => wearLook(item)}
                      style={styles.wearBtn}
                    >
                      <Text style={styles.wearBtnText}>{t.looks.wearAgain}</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={isSelected ? t.looks.picked : t.looks.pickTogether}
                      onPress={() => toggleSelect(item.id)}
                      style={[styles.pickBtn, isSelected && styles.pickBtnActive]}
                    >
                      <Text style={styles.pickBtnText}>
                        {isSelected ? t.looks.picked : t.looks.pickTogether}
                      </Text>
                    </Pressable>
                  </View>
                </View>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t.looks.shareTitle}
                  hitSlop={12}
                  onPress={() => onShare(item)}
                >
                  <Text style={styles.share}>{t.looks.share}</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t.looks.deleteAria}
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
                    <Text style={styles.slot}>{slotLabel(t, piece.slot)}</Text>
                    <Text style={styles.itemTitle} numberOfLines={1}>
                      {piece.title}
                      {piece.colorName ? ` · ${piece.colorName}` : ''}
                      {piece.size ? ` · ${piece.size}` : ''}
                    </Text>
                  </View>
                ))}
              </View>
            </Pressable>
          );
        }}
      />

      {selectedList.length > 0 ? (
        <View style={styles.bar}>
          <View style={{ flex: 1 }}>
            <Text style={styles.barTitle}>
              {t.looks.selectedCount.replace('{n}', String(selectedList.length))}
            </Text>
            <Text style={styles.barHint}>{t.looks.selectedHint}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => setSelected(null)}
            style={styles.barCancel}
            hitSlop={8}
          >
            <Text style={styles.barCancelText}>{t.common.cancel}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.looks.wearSelected}
            onPress={() => wearLooks(selectedList)}
            style={styles.barGo}
          >
            <Text style={styles.barGoText}>{t.looks.wearSelected}</Text>
          </Pressable>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.md, gap: spacing.md },
  // Pastda floating bar bo'lsa ro'yxat ostida bo'sh joy qoldirish — oxirgi
  // karta tugma ostida ko'rinmay qolmasin
  listWithBar: { paddingBottom: 120 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardSelected: { borderColor: colors.accent, borderWidth: 2 },
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
  pickBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pickBtnActive: { backgroundColor: colors.primarySoft, borderColor: colors.borderAccent },
  pickBtnText: { ...text.tiny, color: colors.text, fontWeight: '700' },
  items: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm, gap: 4 },
  item: { flexDirection: 'row', gap: spacing.sm },
  slot: { ...text.tiny, color: colors.textDim, width: 60 },
  itemTitle: { ...text.small, color: colors.textMuted, flex: 1 },

  // Floating bar — ko'p Look tanlanganda pastda qotib turadi
  bar: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  barTitle: { ...text.bodyMed, color: colors.text, fontWeight: '700' },
  barHint: { ...text.tiny, color: colors.textDim, marginTop: 2 },
  barCancel: { paddingHorizontal: 10, paddingVertical: 8 },
  barCancelText: { ...text.small, color: colors.textDim },
  barGo: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  barGoText: { ...text.bodyMed, color: colors.text, fontWeight: '700' },
});
