import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FlatList, Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getStore, getStoreProducts } from '../../src/api/endpoints';
import { Icon } from '../../src/components/Icon';
import { Button, Empty, ErrorView, Loading, Screen } from '../../src/components/ui';
import { useI18n } from '../../src/i18n';
import { goBack } from '../../src/navigation/back';
import { money } from '../../src/theme/format';
import { colors, radius, spacing, text } from '../../src/theme/tokens';

/**
 * Do'kon sahifasi — premium ko'rinish.
 *
 * ⚠️ ILGARI YASSI ZANJIR EDI: nom, status, manzil, mo'ljal, tugmalar va
 * yetkazib berish qatori — hammasi bir xil og'irlikdagi matn qatorlari
 * sifatida ketma-ket turardi va «ariza namunasi» tuyg'usi berardi.
 * Endi butun ma'lumot bitta ko'tarilgan karta ichida: chapda do'kon
 * tamg'asi (initsial + gradient), o'ngda nom va status pili, pastroqda
 * ikonkali qatorlar, oxirida gradientli asosiy tugma va delivery chip.
 */
export default function Store(): JSX.Element {
  const t = useI18n((state) => state.t);
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const store = useQuery({
    queryKey: ['store', id],
    queryFn: () => getStore(id),
    enabled: Boolean(id),
  });
  const products = useQuery({
    queryKey: ['store', id, 'products'],
    queryFn: () => getStoreProducts(id),
    enabled: Boolean(id),
  });

  if (store.isLoading) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }
  if (store.isError || !store.data) {
    return (
      <Screen>
        <ErrorView message={t.common.notFound} onRetry={() => void store.refetch()} />
      </Screen>
    );
  }

  const data = store.data;
  const initial = (data.name ?? '?').trim().charAt(0).toUpperCase() || '?';
  const items = products.data?.items ?? [];

  const statusText = data.isOpen
    ? data.closesAt
      ? t.stores.openUntil.replace('{time}', data.closesAt)
      : t.stores.open
    : data.opensAt
      ? t.stores.closedOpensAt.replace('{time}', data.opensAt)
      : t.stores.closed;
  const statusColor = data.isOpen ? colors.success : colors.textDim;

  return (
    <Screen>
      {/* Suzuvchi orqaga tugmasi — karta ustida turadi, ekran chetiga yopishgan */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t.common.back ?? 'Orqaga'}
        onPress={() => goBack('/stores')}
        hitSlop={10}
        style={[styles.backBtn, { top: insets.top + spacing.sm }]}
      >
        <Icon name="back" size={20} color={colors.text} />
      </Pressable>

      <FlatList
        data={items}
        keyExtractor={(product) => product.id}
        numColumns={2}
        columnWrapperStyle={{ gap: spacing.sm }}
        contentContainerStyle={[styles.list, { paddingTop: insets.top + 56 }]}
        ListHeaderComponent={
          <View>
            {/*
              Hero karta — binafsha chekka va yumshoq ichki yorug'lik bilan
              «premium» hissi beradi. LinearGradient fonda tungi binafsha
              o'tishini chizadi, chekkaga esa accent chegara yopishgan.
            */}
            <View style={styles.heroCard}>
              <LinearGradient
                colors={[colors.primarySoft, 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />

              {/* Yuqori qator: tamg'a + nom + handle + status pili */}
              <View style={styles.heroTop}>
                <LinearGradient
                  colors={[colors.primary, colors.primaryDark]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.avatar}
                >
                  <Text style={styles.avatarInitial}>{initial}</Text>
                </LinearGradient>

                <View style={styles.heroIdentity}>
                  <Text style={styles.name} numberOfLines={1}>
                    {data.name}
                  </Text>
                  {data.username ? (
                    <Text style={styles.handle} numberOfLines={1}>
                      @{data.username}
                    </Text>
                  ) : null}
                  <View style={[styles.statusPill, { borderColor: statusColor + '55' }]}>
                    <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                    <Text style={[styles.statusText, { color: statusColor }]} numberOfLines={1}>
                      {statusText}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.divider} />

              {/* Ikonkali meta qatorlar */}
              <View style={styles.metaBlock}>
                {data.address ? (
                  <View style={styles.metaRow}>
                    <View style={styles.metaIcon}>
                      <Icon name="stores" size={14} color={colors.accent} />
                    </View>
                    <Text style={styles.metaText} numberOfLines={2}>
                      {data.address}
                    </Text>
                  </View>
                ) : null}
                {data.landmark ? (
                  <View style={styles.metaRow}>
                    <View style={styles.metaIcon}>
                      <Icon name="location" size={14} color={colors.accent} />
                    </View>
                    <Text style={styles.metaText} numberOfLines={2}>
                      {t.stores.landmarkLine.replace('{x}', data.landmark)}
                    </Text>
                  </View>
                ) : null}
                {data.avgResponseMin !== null ? (
                  <View style={styles.metaRow}>
                    <View style={styles.metaIcon}>
                      <Icon name="clock" size={14} color={colors.accent} />
                    </View>
                    <Text style={styles.metaText} numberOfLines={1}>
                      {t.stores.respondsIn.replace('{n}', String(data.avgResponseMin))}
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* Asosiy amallar — chapda gradient primary, o'ngda ghost */}
              <View style={styles.actions}>
                <View style={styles.actionFlex}>
                  <Button
                    title={t.stores.call}
                    icon="phone"
                    onPress={() => void Linking.openURL(`tel:${data.phone}`)}
                  />
                </View>
                <View style={styles.actionFlex}>
                  <Button
                    title={t.stores.directions}
                    icon="location"
                    variant="ghost"
                    onPress={() =>
                      void Linking.openURL(
                        `https://maps.google.com/?q=${data.location.lat},${data.location.lng}`,
                      )
                    }
                  />
                </View>
              </View>

              {/* Yetkazib berish chip */}
              <View style={styles.deliveryChip}>
                <Icon
                  name="delivery"
                  size={14}
                  color={data.delivery.enabled ? colors.success : colors.textDim}
                />
                <Text style={styles.deliveryText}>
                  {data.delivery.enabled
                    ? `${t.stores.deliveryUpTo.replace('{km}', (data.delivery.radiusM / 1000).toFixed(0))} · ${
                        Number(data.delivery.fee) === 0
                          ? t.stores.deliveryFree
                          : money(data.delivery.fee, data.currency)
                      }${
                        data.delivery.freeFrom
                          ? ` · ${t.stores.freeFrom.replace('{x}', money(data.delivery.freeFrom, data.currency))}`
                          : ''
                      }`
                    : t.stores.pickupOnly}
                </Text>
              </View>
            </View>

            {/* Mahsulotlar sarlavhasi */}
            {items.length > 0 ? (
              <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle}>{t.catalog.title.toUpperCase()}</Text>
                <Text style={styles.sectionCount}>{items.length}</Text>
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => router.push(`/product/${item.id}`)}>
            {item.image ? (
              <Image source={{ uri: item.image }} style={styles.image} resizeMode="cover" />
            ) : (
              <View style={[styles.image, styles.imagePlaceholder]} />
            )}
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.price}>{money(item.price, item.currency)}</Text>
          </Pressable>
        )}
        ListEmptyComponent={
          products.isLoading ? <Loading /> : <Empty title={t.stores.noProducts} />
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: spacing.md, gap: spacing.sm, paddingBottom: spacing.xl },

  // ── Suzuvchi orqaga tugmasi ──
  backBtn: {
    position: 'absolute',
    left: spacing.md,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10,10,15,0.72)',
    borderWidth: 1,
    borderColor: colors.border,
  },

  // ── Hero karta ──
  heroCard: {
    overflow: 'hidden',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.md,
  },

  heroTop: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderAccent,
  },
  avatarInitial: {
    ...text.h2,
    color: colors.textOnPrimary,
    fontSize: 24,
  },
  heroIdentity: { flex: 1, minWidth: 0, gap: 2 },
  name: { ...text.h2, color: colors.text },
  handle: { ...text.small, color: colors.accent, marginBottom: spacing.xs },

  statusPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
    backgroundColor: 'rgba(10,10,15,0.5)',
  },
  statusDot: { width: 6, height: 6, borderRadius: radius.pill },
  statusText: { ...text.tiny, letterSpacing: 0.3 },

  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },

  // ── Meta qatorlar ──
  metaBlock: { gap: spacing.sm },
  metaRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  metaIcon: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
    marginTop: 1,
  },
  metaText: { ...text.body, color: colors.textMuted, flex: 1 },

  // ── Amallar ──
  actions: { flexDirection: 'row', gap: spacing.sm },
  actionFlex: { flex: 1 },

  // ── Delivery chip ──
  deliveryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  deliveryText: { ...text.small, color: colors.textMuted, flex: 1 },

  // ── Mahsulotlar sarlavhasi ──
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  sectionTitle: { ...text.label, color: colors.text },
  sectionCount: { ...text.small, color: colors.accent },

  // ── Mahsulot kartasi ──
  card: { flex: 1, gap: 2, marginBottom: spacing.md },
  image: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  imagePlaceholder: { borderWidth: 1, borderColor: colors.border },
  cardTitle: { ...text.bodyMed, color: colors.text, marginTop: spacing.sm },
  price: { ...text.bodyMed, color: colors.text },
});
