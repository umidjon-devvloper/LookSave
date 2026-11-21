import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Icon } from '../src/components/Icon';
import { Screen } from '../src/components/ui';
import { goBack } from '../src/navigation/back';
import { colors, radius, spacing, text } from '../src/theme/tokens';

/**
 * Vijdon kodi — do'konga borib mahsulot sotib olganda ilovadan QR kod
 * ko'rsatasan, sotuvchi skanlaydi va naqd chegirma beradi. Tier 2
 * funksiyasi #19. Oflayn + onlayn ko'prigi.
 *
 * Hozir mock QR kod — API `GET /v1/discount/me` endpoint tayyor bo'lgach
 * haqiqiy kod chiqadi (foydalanuvchiga biriktirilgan, har 10 daqiqada
 * yangilanadi).
 */

/** Mock QR kodi SVG o'rniga oddiy 21x21 grid */
function mockQRCells(): boolean[][] {
  // Faqat ko'rinish uchun. Kelajakda qrcode kutubxonasidan kelgan matritsa.
  const seed = 2026_11_21;
  const rows: boolean[][] = [];
  for (let r = 0; r < 21; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < 21; c++) {
      // Position squares — 7x7 corners
      const inCorner =
        (r < 7 && c < 7) || (r < 7 && c >= 14) || (r >= 14 && c < 7);
      if (inCorner) {
        const isEdge = r === 0 || r === 6 || c === 0 || c === 6 ||
                       r === 14 || r === 20 || c === 14 || c === 20;
        const isInner = (r >= 2 && r <= 4 && c >= 2 && c <= 4) ||
                        (r >= 2 && r <= 4 && c >= 16 && c <= 18) ||
                        (r >= 16 && r <= 18 && c >= 2 && c <= 4);
        row.push(isEdge || isInner);
      } else {
        // Oddiy noise
        row.push(((r * 7 + c * 13 + seed) % 3) === 0);
      }
    }
    rows.push(row);
  }
  return rows;
}

export default function DiscountCode(): JSX.Element {
  const router = useRouter();
  const cells = useMemo(mockQRCells, []);
  const code = 'LS-7F3K-9MQ';
  const discount = 15;

  return (
    <Screen>
      <View style={styles.head}>
        <Pressable onPress={() => goBack('/(tabs)')} hitSlop={10}>
          <Icon name="back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Vijdon kodi</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.lede}>
          Do'konga borganingizda ushbu QR kodni sotuvchiga ko'rsating — u skanlaydi
          va sizga qo'shimcha chegirma beradi.
        </Text>

        <View style={styles.qrCard}>
          <View style={styles.qrFrame}>
            {cells.map((row, r) => (
              <View key={r} style={styles.qrRow}>
                {row.map((on, c) => (
                  <View
                    key={c}
                    style={[styles.qrCell, on && styles.qrCellOn]}
                  />
                ))}
              </View>
            ))}
          </View>
          <Text style={styles.codeText}>{code}</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{discount}% chegirma</Text>
          </View>
          <Text style={styles.expires}>Amal qiladi: 10 daqiqa</Text>
        </View>

        <View style={styles.howItWorks}>
          <Text style={styles.sectionLabel}>Qanday ishlaydi</Text>
          <Step n={1} text="Do'konga boring va mahsulotni sotuvchiga ko'rsating" />
          <Step n={2} text="Sotuvchi ilovadan QR kodingizni skanlaydi" />
          <Step n={3} text="Chegirma avtomatik qo'llaniladi (ballar hisobga olinadi)" />
        </View>

        <View style={styles.tipCard}>
          <Text style={styles.tipTitle}>💡 Oflayn + onlayn ko'prik</Text>
          <Text style={styles.tipText}>
            Siz do'konga borib sotib olasiz — lekin ilova sotuvchi bilan sizni
            ulab turadi. Shuning uchun ballar, tarix va chegirmalar barcha joyda.
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

function Step({ n, text }: { n: number; text: string }): JSX.Element {
  return (
    <View style={styles.step}>
      <View style={styles.stepNum}>
        <Text style={styles.stepNumText}>{n}</Text>
      </View>
      <Text style={styles.stepText}>{text}</Text>
    </View>
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
  title: { ...text.h3, color: colors.text },
  body: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  lede: { fontSize: 14, color: colors.textMuted, lineHeight: 20 },
  qrCard: {
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  qrFrame: {
    width: 210,
    height: 210,
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: radius.md,
  },
  qrRow: { flexDirection: 'row' },
  qrCell: { width: 190 / 21, height: 190 / 21, backgroundColor: '#FFFFFF' },
  qrCellOn: { backgroundColor: '#15131E' },
  codeText: { fontSize: 16, fontWeight: '700', color: colors.text, letterSpacing: 2, fontFamily: 'Menlo' },
  badge: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
  },
  badgeText: { fontSize: 13, color: colors.textOnPrimary, fontWeight: '700' },
  expires: { fontSize: 11, color: colors.textMuted },
  howItWorks: { gap: spacing.sm },
  sectionLabel: {
    fontSize: 11,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '700',
  },
  step: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  stepNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  stepText: { flex: 1, fontSize: 14, color: colors.text, lineHeight: 20 },
  tipCard: {
    padding: spacing.md,
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
  },
  tipTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 4 },
  tipText: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },
});
