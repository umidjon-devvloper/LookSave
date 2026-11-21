import { useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '../src/components/Icon';
import { Screen } from '../src/components/ui';
import { goBack } from '../src/navigation/back';
import { colors, radius, spacing, text } from '../src/theme/tokens';

/**
 * Trend radar — bu hafta Toshkentda eng ko'p qidirilgan 10 mahsulot va
 * ko'tarilib borayotgan ranglar/fasonlar. Tier 1 funksiyasi #09.
 *
 * Hozir mock ma'lumotlar, backend `GET /v1/trends/weekly` qo'shilgach
 * jonli bo'ladi.
 */

interface Trend {
  rank: number;
  title: string;
  category: string;
  growth: number; // %
  city: string;
}

const MOCK: Trend[] = [
  { rank: 1, title: 'Oversize paxta ko\'ylak', category: 'Ko\'ylak', growth: 184, city: 'Toshkent' },
  { rank: 2, title: 'Kardigan yumshoq jun', category: 'Trikotaj', growth: 142, city: 'Toshkent' },
  { rank: 3, title: 'Baggy jinslar', category: 'Shim', growth: 128, city: 'Toshkent' },
  { rank: 4, title: 'Krasovka mono oq', category: 'Poyafzal', growth: 98, city: 'Toshkent' },
  { rank: 5, title: 'Charm kurtka', category: 'Ustki kiyim', growth: 87, city: 'Toshkent' },
  { rank: 6, title: 'Trench palto bej', category: 'Ustki kiyim', growth: 76, city: 'Samarqand' },
  { rank: 7, title: 'Ikat ko\'ylak', category: 'Ko\'ylak', growth: 65, city: 'Samarqand' },
  { rank: 8, title: 'Shoyi ro\'mol', category: 'Aksessuar', growth: 54, city: 'Toshkent' },
  { rank: 9, title: 'Wide leg paxta', category: 'Shim', growth: 48, city: 'Toshkent' },
  { rank: 10, title: 'Oksford botinka', category: 'Poyafzal', growth: 42, city: 'Toshkent' },
];

const COLORS = [
  { name: 'Pista yashil', hex: '#A3C585', growth: 215 },
  { name: 'Qovun rangi', hex: '#F4B650', growth: 168 },
  { name: 'Terrakota', hex: '#C97C5D', growth: 134 },
  { name: 'Shaftoli', hex: '#F5C4AA', growth: 92 },
];

export default function Trends(): JSX.Element {
  const router = useRouter();

  return (
    <Screen>
      <View style={styles.head}>
        <Pressable onPress={() => goBack('/(tabs)')} hitSlop={10}>
          <Icon name="back" size={24} color={colors.text} />
        </Pressable>
        <View>
          <Text style={styles.title}>Trend radar</Text>
          <Text style={styles.subtitle}>Bu hafta · Toshkent va Samarqand</Text>
        </View>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={MOCK}
        keyExtractor={(t) => String(t.rank)}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.colorsBlock}>
            <Text style={styles.sectionLabel}>Ko'tarilayotgan ranglar</Text>
            <View style={styles.colorsRow}>
              {COLORS.map((c) => (
                <View key={c.name} style={styles.colorTile}>
                  <View style={[styles.swatch, { backgroundColor: c.hex }]} />
                  <Text style={styles.colorName}>{c.name}</Text>
                  <Text style={styles.colorGrowth}>+{c.growth}%</Text>
                </View>
              ))}
            </View>
            <Text style={styles.sectionLabel}>Eng ko'p qidirilgan 10 mahsulot</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.rank}>{item.rank}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{item.title}</Text>
              <Text style={styles.rowMeta}>
                {item.category} · {item.city}
              </Text>
            </View>
            <Text style={styles.growth}>+{item.growth}%</Text>
          </View>
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
  list: { padding: spacing.md, gap: spacing.sm },
  colorsBlock: { gap: spacing.sm, marginBottom: spacing.md },
  sectionLabel: {
    fontSize: 11,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
    marginTop: spacing.sm,
  },
  colorsRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  colorTile: {
    flex: 1,
    minWidth: 80,
    backgroundColor: colors.bgElevated,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    gap: 4,
  },
  swatch: { width: 36, height: 36, borderRadius: 18 },
  colorName: { fontSize: 11, color: colors.text, fontWeight: '600' },
  colorGrowth: { fontSize: 11, color: colors.success, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rank: {
    width: 28,
    textAlign: 'center',
    fontFamily: text.h3.fontFamily,
    fontSize: 20,
    color: colors.primary,
    fontWeight: '700',
  },
  rowTitle: { fontSize: 14, color: colors.text, fontWeight: '600' },
  rowMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  growth: { fontSize: 13, color: colors.success, fontWeight: '700' },
});
