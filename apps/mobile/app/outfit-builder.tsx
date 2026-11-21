import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Icon } from '../src/components/Icon';
import { Button, Screen } from '../src/components/ui';
import { goBack } from '../src/navigation/back';
import { colors, radius, spacing, text } from '../src/theme/tokens';

/**
 * Outfit builder — bir vaqtda ko'p mahsulotli try-on. Foydalanuvchi
 * yuqori + pastki + poyafzal + aksessuar tanlaydi, avatarda birgalikda
 * ko'rinadi. Tier 1 funksiyasi #02.
 *
 * Hozir skelet UI — foydalanuvchi har slot uchun bo'sh joy ko'radi,
 * «Kiyim tanlash» tugmasi katalogga uzatadi. Keyingi bosqich: real
 * avatar render (hozir try-on faqat bitta mahsulot uchun ishlaydi).
 */

interface Slot {
  key: 'top' | 'bottom' | 'shoes' | 'accessory';
  label: string;
  emoji: string;
  category: string;
}

const SLOTS: Slot[] = [
  { key: 'top', label: 'Yuqori', emoji: '👕', category: 'tops' },
  { key: 'bottom', label: 'Pastki', emoji: '👖', category: 'bottoms' },
  { key: 'shoes', label: 'Poyafzal', emoji: '👟', category: 'shoes' },
  { key: 'accessory', label: 'Aksessuar', emoji: '👜', category: 'accessories' },
];

export default function OutfitBuilder(): JSX.Element {
  const router = useRouter();
  const [filled, setFilled] = useState<Record<string, boolean>>({});

  const count = Object.values(filled).filter(Boolean).length;

  return (
    <Screen>
      <View style={styles.head}>
        <Pressable onPress={() => goBack('/(tabs)')} hitSlop={10}>
          <Icon name="back" size={24} color={colors.text} />
        </Pressable>
        <View>
          <Text style={styles.title}>Outfit Builder</Text>
          <Text style={styles.subtitle}>{count}/4 ta kiyim tanlandi</Text>
        </View>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.avatarWrap}>
          <View style={styles.avatar}>
            <Text style={styles.avatarEmoji}>🧍</Text>
            {count > 0 ? (
              <View style={styles.piecesLayer}>
                {Object.entries(filled)
                  .filter(([, v]) => v)
                  .map(([k]) => {
                    const slot = SLOTS.find((s) => s.key === k);
                    return slot ? <Text key={k} style={styles.pieceEmoji}>{slot.emoji}</Text> : null;
                  })}
              </View>
            ) : null}
          </View>
          <Text style={styles.avatarHint}>
            {count === 0
              ? 'Pastdagi slotlardan kiyim tanlang'
              : count < 4
              ? `Yana ${4 - count} ta qo'shing`
              : 'To\'liq outfit tayyor!'}
          </Text>
        </View>

        <View style={styles.slots}>
          {SLOTS.map((s) => (
            <Pressable
              key={s.key}
              style={[styles.slot, filled[s.key] && styles.slotFilled]}
              onPress={() => setFilled((prev) => ({ ...prev, [s.key]: !prev[s.key] }))}
            >
              <Text style={styles.slotEmoji}>{s.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.slotLabel}>{s.label}</Text>
                <Text style={styles.slotHint}>
                  {filled[s.key] ? 'Tanlandi' : 'Bo\'sh — bosing'}
                </Text>
              </View>
              {filled[s.key] ? (
                <View style={styles.checkPill}>
                  <Text style={styles.check}>✓</Text>
                </View>
              ) : (
                <Text style={styles.plus}>+</Text>
              )}
            </Pressable>
          ))}
        </View>

        <View style={styles.actions}>
          <Button
            title={count === 4 ? "Outfit'ni saqlash" : "Katalogdan tanlash"}
            onPress={() => router.push('/(tabs)/marketplace' as any)}
            disabled={false}
          />
          <View style={{ height: spacing.sm }} />
          <Button
            title="AI stilist taklif qilsin"
            onPress={() => router.push('/stylist' as any)}
            variant="ghost"
          />
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Noyob funksiya</Text>
          <Text style={styles.infoText}>
            Oddiy try-on faqat bitta mahsulotni ko'rsatadi. Outfit builder esa
            yuqori + pastki + poyafzal + aksessuarni birga ko'rsatadi — to'liq
            outfit tasavvur qilasiz, sotib olishdan oldin.
          </Text>
        </View>
      </ScrollView>
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
  body: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  avatarWrap: { alignItems: 'center', gap: spacing.sm },
  avatar: {
    width: 180,
    height: 220,
    backgroundColor: colors.surface2,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarEmoji: { fontSize: 100, opacity: 0.6 },
  piecesLayer: {
    position: 'absolute',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    top: 10,
    right: 10,
  },
  pieceEmoji: { fontSize: 20 },
  avatarHint: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
  slots: { gap: spacing.sm, marginTop: spacing.sm },
  slot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  slotFilled: { borderColor: colors.primary, backgroundColor: colors.surface2 },
  slotEmoji: { fontSize: 28 },
  slotLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
  slotHint: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  checkPill: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  check: { color: colors.textOnPrimary, fontWeight: '700' },
  plus: { fontSize: 24, color: colors.textDim, fontWeight: '300' },
  actions: { marginTop: spacing.md },
  infoCard: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
  },
  infoTitle: { fontSize: 13, fontWeight: '700', color: colors.primary, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  infoText: { fontSize: 13, color: colors.text, lineHeight: 19 },
});
