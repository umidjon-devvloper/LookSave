import { useQueries } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { api } from '../src/api/client';
import { Icon } from '../src/components/Icon';
import { Button, ErrorView, Loading, Screen } from '../src/components/ui';
import { goBack } from '../src/navigation/back';
import { money } from '../src/theme/format';
import { colors, radius, spacing, text } from '../src/theme/tokens';

/**
 * Ikki mahsulotni yonma-yon taqqoslash. URL: `/compare?a=<pid>&b=<pid>`.
 * Foydalanuvchi mahsulot sahifasida «Taqqoslash» tugmasini bosib shu
 * sahifaga keladi. ProductDetail tipini product/[id].tsx bilan bir xil
 * qilib, mahalliy ushlab turibmiz — API javobi shu shaklda.
 *
 * Tier 3 funksiyasi #22.
 */
interface ProductDetail {
  id: string;
  title: string;
  description: string | null;
  price: string;
  oldPrice: string | null;
  currency: string;
  images: string[];
  slot: string;
  isLimited: boolean;
  brand: { name: string | null } | null;
  store: { id: string; name: string; isOpen: boolean; distanceM: number | null };
  variants: Array<{
    id: string;
    colorHex: string | null;
    colorName: string;
    sizes: Array<{ size: string; available: boolean; stock: number }>;
  }>;
  isFavorite: boolean;
}

function getProduct(id: string): Promise<ProductDetail> {
  return api<ProductDetail>(`/products/${id}`);
}

function Row({ label, a, b, highlight }: { label: string; a: string; b: string; highlight?: 'a' | 'b' }): JSX.Element {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowValues}>
        <Text style={[styles.rowValue, highlight === 'a' && styles.rowValueWin]} numberOfLines={2}>{a}</Text>
        <View style={styles.vs}><Text style={styles.vsText}>·</Text></View>
        <Text style={[styles.rowValue, highlight === 'b' && styles.rowValueWin]} numberOfLines={2}>{b}</Text>
      </View>
    </View>
  );
}

function fmtDistance(m: number | null): string {
  if (m == null) return '—';
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

function allSizes(p: ProductDetail): string {
  const sizes = p.variants.flatMap((v) => v.sizes.map((s) => s.size));
  const uniq = Array.from(new Set(sizes));
  return uniq.join(', ') || '—';
}

function allColors(p: ProductDetail): string {
  const names = p.variants.map((v) => v.colorName).filter(Boolean);
  const uniq = Array.from(new Set(names));
  return uniq.join(', ') || '—';
}

export default function Compare(): JSX.Element {
  const router = useRouter();
  const { a, b } = useLocalSearchParams<{ a: string; b: string }>();

  const queries = useQueries({
    queries: [
      { queryKey: ['product', a], queryFn: () => getProduct(a!), enabled: Boolean(a) },
      { queryKey: ['product', b], queryFn: () => getProduct(b!), enabled: Boolean(b) },
    ],
  });

  const [qa, qb] = queries;
  const loading = qa.isLoading || qb.isLoading;

  if (loading) return <Loading />;
  if (!qa.data || !qb.data)
    return <ErrorView onRetry={() => queries.forEach((q) => q.refetch())} />;

  const pA = qa.data;
  const pB = qb.data;

  const priceA = Number(pA.price);
  const priceB = Number(pB.price);
  const cheaper = priceA < priceB ? 'a' : priceB < priceA ? 'b' : undefined;

  const closer = ((): 'a' | 'b' | undefined => {
    const dA = pA.store.distanceM;
    const dB = pB.store.distanceM;
    if (dA == null || dB == null) return undefined;
    if (dA < dB) return 'a';
    if (dB < dA) return 'b';
    return undefined;
  })();

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.head}>
          <Pressable onPress={() => goBack('/(tabs)')} hitSlop={10}>
            <Icon name="back" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>Taqqoslash</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.cards}>
          <View style={styles.card}>
            {pA.images[0] ? (
              <Image source={{ uri: pA.images[0] }} style={styles.image} resizeMode="contain" />
            ) : (
              <View style={[styles.image, styles.imagePh]} />
            )}
            <Text style={styles.name} numberOfLines={2}>{pA.title}</Text>
            <Text style={styles.store}>{pA.store.name}</Text>
          </View>

          <View style={styles.card}>
            {pB.images[0] ? (
              <Image source={{ uri: pB.images[0] }} style={styles.image} resizeMode="contain" />
            ) : (
              <View style={[styles.image, styles.imagePh]} />
            )}
            <Text style={styles.name} numberOfLines={2}>{pB.title}</Text>
            <Text style={styles.store}>{pB.store.name}</Text>
          </View>
        </View>

        <View style={styles.table}>
          <Row
            label="Narx"
            a={money(pA.price, pA.currency)}
            b={money(pB.price, pB.currency)}
            highlight={cheaper}
          />
          <Row label="Do'kon" a={pA.store.name} b={pB.store.name} />
          <Row
            label="Masofa"
            a={fmtDistance(pA.store.distanceM)}
            b={fmtDistance(pB.store.distanceM)}
            highlight={closer}
          />
          <Row
            label="Brend"
            a={pA.brand?.name ?? "Yo'q"}
            b={pB.brand?.name ?? "Yo'q"}
          />
          <Row label="O'lchamlar" a={allSizes(pA)} b={allSizes(pB)} />
          <Row label="Ranglar" a={allColors(pA)} b={allColors(pB)} />
        </View>

        <View style={styles.actions}>
          <Button
            title={`«${pA.title.slice(0, 18)}»`}
            onPress={() => router.push(`/product/${pA.id}` as any)}
          />
          <View style={{ height: spacing.sm }} />
          <Button
            title={`«${pB.title.slice(0, 18)}»`}
            onPress={() => router.push(`/product/${pB.id}` as any)}
            variant="ghost"
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.md, paddingBottom: spacing.xl },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  title: { ...text.h2, color: colors.text },
  cards: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  card: {
    flex: 1,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
  },
  image: {
    width: '100%',
    aspectRatio: 1,
    marginBottom: spacing.xs,
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
  },
  imagePh: { backgroundColor: colors.surface2 },
  name: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 2 },
  store: { fontSize: 11, color: colors.textMuted },
  table: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  row: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLabel: { fontSize: 11, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  rowValues: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  rowValue: { flex: 1, fontSize: 14, color: colors.text, fontWeight: '500' },
  rowValueWin: { color: colors.success, fontWeight: '700' },
  vs: { width: 16, alignItems: 'center', paddingTop: 2 },
  vsText: { color: colors.textDim },
  actions: { marginTop: spacing.sm },
});
