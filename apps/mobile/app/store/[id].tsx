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

  // ── Suzuvchi orqaga tugmasi — premium oq doira binafsha glow bilan ──
  backBtn: {
    position: 'absolute',
    left: spacing.md,
    zIndex: 10,
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(192, 132, 252, 0.3)',
    shadowColor: '#7C3AED',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },

  // ── Hero karta — premium: soft purple gradient fon + binafsha glow shadow ──
  heroCard: {
    overflow: 'hidden',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(192, 132, 252, 0.28)',
    backgroundColor: '#FBF7FF',
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.md,
    shadowColor: '#7C3AED',
    shadowOpacity: 0.12,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },

  heroTop: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.9)',
    shadowColor: '#A855F7',
    shadowOpacity: 0.5,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  avatarInitial: {
    ...text.h2,
    color: colors.textOnPrimary,
    fontSize: 26,
    fontWeight: '800',
  },
  heroIdentity: { flex: 1, minWidth: 0, gap: 3 },
  name: { ...text.h2, color: colors.text, letterSpacing: -0.4 },
  handle: { ...text.small, color: colors.accent, marginBottom: spacing.xs },

  statusPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
  statusDot: { width: 6, height: 6, borderRadius: radius.pill },
  statusText: { ...text.tiny, letterSpacing: 0.3 },

  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },

  // ── Meta qatorlar ──
  metaBlock: { gap: spacing.sm + 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2 },
  metaIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(168, 85, 247, 0.14)',
    marginTop: 1,
  },
  metaText: { ...text.body, color: colors.text, flex: 1, fontWeight: '500' },

  // ── Amallar ──
  actions: { flexDirection: 'row', gap: spacing.sm + 2 },
  actionFlex: { flex: 1 },

  // ── Delivery chip ── (premium: yashil soft fon + yoqimli border)
  deliveryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.22)',
  },
  deliveryText: { ...text.small, color: colors.text, flex: 1, fontWeight: '500' },

  // ── Mahsulotlar sarlavhasi — premium: katta title + binafsha pill count ──
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    marginTop: spacing.xs,
  },
  sectionTitle: { ...text.h2, color: colors.text, letterSpacing: -0.3 },
  sectionCount: {
    ...text.small,
    color: colors.textOnPrimary,
    fontWeight: '800',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    overflow: 'hidden',
  },

  // ── Mahsulot kartasi — premium: oq karta + binafsha soft shadow ──
  card: {
    flex: 1,
    gap: 2,
    marginBottom: spacing.md,
    padding: spacing.xs,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    shadowColor: '#5B21B6',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  image: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: radius.md,
    backgroundColor: colors.surface2,
  },
  imagePlaceholder: { borderWidth: 1, borderColor: colors.border },
  cardTitle: {
    ...text.small,
    color: colors.text,
    marginTop: spacing.sm,
    paddingHorizontal: 4,
  },
  price: {
    ...text.price,
    color: colors.text,
    fontSize: 17,
    lineHeight: 22,
    paddingHorizontal: 4,
    paddingBottom: 2,
  },
});
