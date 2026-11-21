import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { Icon } from '../src/components/Icon';
import { Button, Screen } from '../src/components/ui';
import { goBack } from '../src/navigation/back';
import { colors, radius, spacing, text } from '../src/theme/tokens';

/**
 * Sovg'a (Hadya) qilish rejimi. Mahsulotni boshqa telefon raqamiga
 * sovg'a qilish; anonim rejimi ham bor. Tier 2 funksiyasi #18.
 *
 * Hozir UI tayyor, backend `POST /v1/gifts` orqali ishlaydi (keyingi
 * bosqich). Foydalanuvchi mahsulot sahifasida «Sovg'a qilish» tugmasini
 * bosib shu sahifaga tushadi.
 */
export default function Gift(): JSX.Element {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [anonymous, setAnonymous] = useState(false);

  const canSend = phone.trim().length >= 9 && name.trim().length > 0;

  return (
    <Screen>
      <View style={styles.head}>
        <Pressable onPress={() => goBack('/(tabs)')} hitSlop={10}>
          <Icon name="back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Sovg'a qilish</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.body}>
        <Text style={styles.lede}>
          Mahsulotni boshqa telefon raqamiga sovg'a qiling. Oluvchi ilovada
          xabar oladi va sovg'a kodini kiritib ochadi.
        </Text>

        <Field label="Oluvchining telefon raqami">
          <TextInput
            style={styles.input}
            placeholder="+998 __ ___ __ __"
            placeholderTextColor={colors.textDim}
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
          />
        </Field>

        <Field label="Oluvchining ismi">
          <TextInput
            style={styles.input}
            placeholder="Masalan: Shahzoda"
            placeholderTextColor={colors.textDim}
            value={name}
            onChangeText={setName}
          />
        </Field>

        <Field label="Qisqa xabar (ixtiyoriy)">
          <TextInput
            style={[styles.input, styles.inputArea]}
            placeholder="«Tug'ilgan kuningiz muborak!»"
            placeholderTextColor={colors.textDim}
            value={message}
            onChangeText={setMessage}
            multiline
            numberOfLines={3}
          />
        </Field>

        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.toggleLabel}>Anonim sovg'a</Text>
            <Text style={styles.toggleHint}>Oluvchiga sizning ismingiz ko'rinmaydi</Text>
          </View>
          <Switch value={anonymous} onValueChange={setAnonymous} />
        </View>

        <Button
          title={anonymous ? "Anonim yuborish" : "Sovg'a qilib yuborish"}
          onPress={() => {
            router.back();
          }}
          disabled={!canSend}
        />
      </View>
    </Screen>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
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
  body: { padding: spacing.md, gap: spacing.md },
  lede: { fontSize: 14, color: colors.textMuted, lineHeight: 20 },
  field: { gap: 6 },
  fieldLabel: {
    fontSize: 11,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  input: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 15,
  },
  inputArea: { minHeight: 80, textAlignVertical: 'top' },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
  },
  toggleLabel: { fontSize: 14, color: colors.text, fontWeight: '600' },
  toggleHint: { fontSize: 12, color: colors.textMuted },
});
