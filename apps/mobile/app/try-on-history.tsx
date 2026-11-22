import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getTryonHistory } from '../src/api/endpoints';
import { Icon } from '../src/components/Icon';
import { Screen } from '../src/components/ui';
import { goBack } from '../src/navigation/back';
import { colors, radius, spacing, text } from '../src/theme/tokens';

/**
 * Try-on tarixi — foydalanuvchining oldingi kiyintirishlar galereyasi.
 * Tier 3 funksiyasi #23. API endpoint allaqachon mavjud (`/v1/tryon/renders`).
 *
 * Har kartada kiyilgan mahsulot, sana, qayta ko'rish va do'stlarga ulashish
 * imkoni. Uzun press — o'chirish.
 */

function fmtDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (diffDays === 0) return 'Bugun';
  if (diffDays === 1) return 'Kecha';
  if (diffDays < 7) return `${diffDays} kun oldin`;
  return `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

export default function TryOnHistoryPage(): JSX.Element {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['tryon-history'],
    queryFn: () => getTryonHistory(60),
  });

  return (
    <Screen>
      <View style={[styles.head, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => goBack('/(tabs)')} hitSlop={10}>
          <Icon name="back" size={24} color={colors.text} />
        </Pressable>
        <View>
          <Text style={styles.title}>Try-on tarixi</Text>
          <Text style={styles.subtitle}>{data.length} ta kiyintirish</Text>
        </View>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={data}
        keyExtractor={(r) => r.render.id}
        numColumns={2}
        contentContainerStyle={styles.list}
        columnWrapperStyle={{ gap: spacing.sm }}
        refreshing={isLoading}
        onRefresh={() => void refetch()}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>👗</Text>
              <Text style={styles.emptyTitle}>Hali try-on yo'q</Text>
              <Text style={styles.emptyText}>
                Mahsulot sahifasida «Try-on» tugmasini bosib avatarda kiyib ko'ring —
                bu yerda tarixingiz saqlanadi.
              </Text>
              <Pressable
                style={styles.emptyCta}
                onPress={() => router.push('/(tabs)/marketplace' as any)}
              >
                <Text style={styles.emptyCtaText}>Katalogga o'tish</Text>
              </Pressable>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => router.push(`/looks?r=${item.render.id}` as any)}
          >
            {item.render.imageUrl ? (
              <Image
                source={{ uri: item.render.imageUrl }}
                style={styles.image}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.image, styles.imagePh]}>
                <Text style={{ fontSize: 48 }}>🧍</Text>
              </View>
            )}
            <Text style={styles.cardDate}>{fmtDate(item.completedAt)}</Text>
          </Pressable>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { ...text.h3, color: colors.text, textAlign: 'center' },
  subtitle: { fontSize: 11, color: colors.textMuted, textAlign: 'center' },
  list: { padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xl, flexGrow: 1 },
  empty: { alignItems: 'center', paddingVertical: 48, gap: spacing.sm, flex: 1, justifyContent: 'center' },
  emptyEmoji: { fontSize: 72, opacity: 0.4 },
  emptyTitle: { ...text.h3, color: colors.text },
  emptyText: { fontSize: 14, color: colors.textMuted, textAlign: 'center', paddingHorizontal: spacing.lg, lineHeight: 20 },
  emptyCta: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
  },
  emptyCtaText: { color: colors.textOnPrimary, fontWeight: '700' },
  card: {
    flex: 1,
    aspectRatio: 0.75,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  image: { flex: 1, backgroundColor: colors.surface2 },
  imagePh: { alignItems: 'center', justifyContent: 'center' },
  cardDate: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '700',
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
});
