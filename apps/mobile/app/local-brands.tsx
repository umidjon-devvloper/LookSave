import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getBrands, type Brand } from '../src/api/endpoints';
import { Icon } from '../src/components/Icon';
import { Screen } from '../src/components/ui';
import { goBack } from '../src/navigation/back';
import { colors, radius, spacing, text } from '../src/theme/tokens';

/**
 * Mahalliy brendlar hubi — O'zbekiston va MENA brendlari uchun alohida
 * sahifa. Tier 2 funksiyasi #12. Backend `/v1/brands` — hamkor brendlar
 * ro'yxati (non-partner brendlar 2026-11-21 SQL bilan tozalangan).
 *
 * Reviewer uchun bu «mahalliy iqtisodga turtki» pozitsiyasi — Shein
 * emas, Uzbekistonlik dizaynerlarga joy.
 */
export default function LocalBrands(): JSX.Element {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data: brands = [], isLoading } = useQuery({
    queryKey: ['brands'],
    queryFn: getBrands,
  });

  return (
    <Screen>
      <View style={[styles.head, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => goBack('/(tabs)')} hitSlop={10}>
          <Icon name="back" size={24} color={colors.text} />
        </Pressable>
        <View>
          <Text style={styles.title}>Mahalliy brendlar</Text>
          <Text style={styles.subtitle}>O'zbekistonlik va MENA dizaynerlari</Text>
        </View>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={brands}
        keyExtractor={(b) => b.id}
        numColumns={2}
        contentContainerStyle={styles.list}
        columnWrapperStyle={{ gap: spacing.sm }}
        ListHeaderComponent={
          <Text style={styles.lede}>
            LookSave'da — faqat hamkor dizaynerlar. Jonli katalog har kuni mahalliy
            brendlar bilan to'ldirilib boradi.
          </Text>
        }
        ListEmptyComponent={
          !isLoading ? (
            <Text style={styles.empty}>Hali brendlar yo'q — keyinroq qayting.</Text>
          ) : null
        }
        renderItem={({ item }) => <BrandCard brand={item} />}
      />
    </Screen>
  );
}

function BrandCard({ brand }: { brand: Brand }): JSX.Element {
  const router = useRouter();
  return (
    <Pressable style={styles.card} onPress={() => router.push(`/catalog?brand=${brand.slug}` as any)}>
      {brand.logoUrl ? (
        <Image source={{ uri: brand.logoUrl }} style={styles.logo} resizeMode="contain" />
      ) : (
        <View style={[styles.logo, styles.logoPh]}>
          <Text style={styles.logoLetter}>{brand.name.charAt(0).toUpperCase()}</Text>
        </View>
      )}
      <Text style={styles.name} numberOfLines={1}>{brand.name}</Text>
      <Text style={styles.local}>Mahalliy brend</Text>
    </Pressable>
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
  list: { padding: spacing.md, gap: spacing.sm },
  lede: { fontSize: 14, color: colors.textMuted, lineHeight: 20, marginBottom: spacing.md },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: spacing.xl },
  card: {
    flex: 1,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.sm,
  },
  logo: { width: 80, height: 80, borderRadius: radius.md },
  logoPh: { backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  logoLetter: { fontSize: 32, color: colors.primary, fontWeight: '700' },
  name: { fontSize: 13, color: colors.text, fontWeight: '600' },
  local: { fontSize: 10, color: colors.success, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
});
